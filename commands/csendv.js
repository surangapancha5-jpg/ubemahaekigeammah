// ════════════════ IMPORTS ════════════════════════
const yts = require("yt-search");

// ════════════════ SESSION HELPERS ════════════════════════
if (!global.csendVideoSessions) global.csendVideoSessions = new Map();

const INTERVAL_MS = 3 * 60 * 1000;
const MAX_ITEMS = 30;

function searchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function stopSession(key) {
  const old = global.csendVideoSessions.get(key);
  if (old?.timer) clearTimeout(old.timer);
  global.csendVideoSessions.delete(key);
}

function categoryText(category) {
  if (category === "songs") return "DJ / Slowed / Remix Songs";
  if (category === "cartoons") return "Sinhala Cartoons";
  return "Teledrama Episodes";
}

// ════════════════ COMMAND ════════════════════════
module.exports = {
  name: "csendvideo",
  alias: ["csvideo", "sendvideo"],
  desc: "Send YouTube search links every 3 minutes",
  category: "media",
  use: ".csendvideo",

  async execute(sock, msg, args, from, ctx = {}) {
    const reply = ctx.reply || (async (text) => sock.sendMessage(from, { text }, { quoted: msg }));
    const key = ctx.sessionKey || `${from}:${ctx.senderClean || ctx.sender || "unknown"}`;
    const input = String(args.join(" ") || ctx.cleanBody || "").trim();
    const session = global.csendVideoSessions.get(key);

    // Stop an active auto-send session.
    if (/^(stop|cancel|නවත්වන්න)$/i.test(input) || /\.csendvideo\s+(stop|cancel)$/i.test(input)) {
      if (!global.csendVideoSessions.has(key)) return reply("ℹ️ Active csendvideo session එකක් නැහැ.");
      stopSession(key);
      return reply("✅ csendvideo auto-send session එක නතර කළා.");
    }

    // Handle replies to the interactive steps.
    if (ctx.isSessionReply && session) {
      if (session.state === "category") {
        const choices = { "1": "songs", "2": "cartoons", "3": "drama" };
        const selected = choices[input];
        if (!selected) return reply("❌ 1, 2 හෝ 3 තෝරන්න.");
        session.category = selected;
        session.state = "name";
        return reply(selected === "songs"
          ? "🎵 සොයන්න ඕන DJ / Slowed / Remix song එකේ නම එවන්න."
          : selected === "cartoons"
            ? "🎨 Sinhala cartoon එකේ නම හෝ topic එක එවන්න."
            : "📺 Teledrama එකේ නම එවන්න. Episodes අංක පිළිවෙළට search links යවනු ලැබේ.");
      }

      if (session.state === "name") {
        if (input.length < 2 || input.length > 120) return reply("❌ කරුණාකර වලංගු නමක් එවන්න.");
        session.query = input;
        session.state = "running";
        session.count = 0;
        session.episode = 1;
        await reply(`✅ *${categoryText(session.category)}* සකස් කළා.\n🔎 Search: ${input}\n⏱️ සෑම විනාඩි 3කට වරක් YouTube search link එකක් යවනු ඇත.\n⛔ නතර කිරීමට: *.csendvideo stop*`);
        await this.sendNext(sock, from, key, msg, reply);
        return;
      }
    }

    // Start a new session. Only the owner/developer can start automated sending.
    if (!ctx.isOwner && !ctx.isDev) return reply("❌ මෙම command එක භාවිත කළ හැක්කේ bot owner ට පමණයි.");
    if (session) stopSession(key);

    global.csendVideoSessions.set(key, {
      state: "category",
      category: null,
      query: "",
      count: 0,
      episode: 1,
      timer: null,
      startedAt: Date.now()
    });

    return reply(
      "╭━━〔 🎬 CSEND VIDEO 〕━━╮\n" +
      "┃\n" +
      "┃ 1️⃣ 🎵 Songs (DJ / Slowed / Remix)\n" +
      "┃ 2️⃣ 🎨 Sinhala Cartoons\n" +
      "┃ 3️⃣ 📺 Teledrama Episodes\n" +
      "┃\n" +
      "╰━━━━━━━━━━━━━━━━━━╯\n" +
      "අංකයක් reply කරන්න. නතර කිරීමට *.csendvideo stop* යොදන්න."
    );
  },

  // ════════════════ AUTO SEND NEXT SEARCH LINK ════════════════════════
  async sendNext(sock, from, key, quoted, reply) {
    const session = global.csendVideoSessions.get(key);
    if (!session || session.state !== "running") return;
    if (session.count >= MAX_ITEMS) {
      stopSession(key);
      return reply(`✅ Auto-send අවසන්. Search links ${MAX_ITEMS}ක් යැව්වා.`);
    }

    let query;
    if (session.category === "songs") {
      query = `${session.query} DJ slowed remix song`;
    } else if (session.category === "cartoons") {
      query = `${session.query} Sinhala cartoon`;
    } else {
      query = `${session.query} episode ${session.episode}`;
    }

    try {
      // Validate that YouTube returns search results, then share a search URL.
      const result = await yts(query);
      if (!result?.videos?.length) {
        await reply(`⚠️ "${query}" සඳහා YouTube results හමු වුණේ නැහැ.`);
      } else {
        const first = result.videos[0];
        const link = searchUrl(query);
        const label = session.category === "drama" ? `Episode ${session.episode}` : `Result ${session.count + 1}`;
        await sock.sendMessage(from, {
          text: `╭━━〔 🎬 ${label} 〕━━╮\n│ 📌 ${session.query}\n│ 🔎 ${query}\n│\n│ ▶️ YouTube Search:\n${link}\n╰━━━━━━━━━━━━━━━━━━╯\n> Search result preview: ${first.title}\n> Auto-send interval: 3 minutes\n> Stop: .csendvideo stop`
        }, { quoted: quoted || undefined });
      }
      session.count++;
      if (session.category === "drama") session.episode++;
      session.timer = setTimeout(() => {
        this.sendNext(sock, from, key, null, reply).catch((err) => {
          console.error("[CSENDVIDEO] Timer error:", err.message);
          stopSession(key);
        });
      }, INTERVAL_MS);
    } catch (err) {
      await reply(`❌ YouTube search error: ${err.message}`);
      stopSession(key);
    }
  }
};

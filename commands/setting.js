const { updateBotSettings } = require("../lib/settingsHelper");

const bool = (v) => ["on", "yes", "true", "1", "enable", "enabled"].includes(String(v || "").toLowerCase());

module.exports = {
  name: "setting",
  alias: ["settings", "config", "set"],
  category: "owner",
  desc: "Configure bot settings",
  async execute(sock, msg, args, from, ctx = {}) {
    const { reply = async (t) => sock.sendMessage(from, { text: String(t) }, { quoted: msg }), isOwner, isDev, currentBotNumber, settings = {} } = ctx;
    if (!(isOwner || isDev)) return reply("⛔ මේ command එක bot owner/developer ට පමණයි.");

    const key = String(args[0] || "").toLowerCase();
    const value = args.slice(1).join(" ").trim();
    const help = `╭───〔 ⚙️ ZANTA-XMD SETTINGS 〕───╮
│
│ .setting                 — සියලු settings
│ .setting name <නම>
│ .setting logo <image URL>
│ .setting prefix <symbol>
│ .setting workmode public/private/groups/inbox
│ .setting presence off/typing/recording
│ .setting statusseen on/off
│ .setting statusreact <emoji/off>
│ .setting antiview me/from
│ .setting antidelete me/from
│
╰──────────────────────────────╯

Current values:
Name: ${settings.botName || "ZANTA-XMD"}
Prefix: ${settings.prefix || "."}
Work mode: ${settings.workMode || "public"}
Presence: ${settings.presence || "off"}
Status seen: ${settings.statusSeen ? "on" : "off"}
Status react: ${settings.statusReact || "off"}
Anti-view route: ${settings.antiViewRoute || "me"}
Anti-delete route: ${settings.antiDeleteRoute || "me"}`;

    if (!key || key === "help" || key === "menu") return reply(help);
    if (!currentBotNumber) return reply("❌ Bot number එක හඳුනාගන්න බැහැ.");
    if (!value) return reply(`❌ Value එක දෙන්න.\nඋදා: .setting ${key} ${key === "prefix" ? "!" : "on"}`);

    const updates = {};
    switch (key) {
      case "name":
      case "botname":
        if (value.length > 40) return reply("❌ Bot name එක අකුරු 40ට අඩු විය යුතුයි.");
        updates.botName = value;
        break;
      case "logo":
      case "botlogo":
        if (!/^https?:\/\//i.test(value)) return reply("❌ Logo එකට http:// හෝ https:// URL එකක් දෙන්න.");
        updates.botLogo = value;
        break;
      case "prefix":
        if (value.length > 3 || /\s/.test(value)) return reply("❌ Prefix එක space නැති අකුරු 1–3ක් විය යුතුයි.");
        updates.prefix = value;
        break;
      case "workmode":
      case "mode": {
        const v = value.toLowerCase();
        if (!["public", "private", "groups", "inbox"].includes(v)) return reply("❌ Work mode: public / private / groups / inbox");
        updates.workMode = v;
        break;
      }
      case "presence": {
        const v = value.toLowerCase();
        if (!["off", "typing", "recording"].includes(v)) return reply("❌ Presence: off / typing / recording");
        updates.presence = v;
        break;
      }
      case "statusseen":
      case "status_seen":
        if (!["on", "off", "yes", "no", "true", "false", "1", "0", "enable", "disable", "enabled", "disabled"].includes(value.toLowerCase())) return reply("❌ on හෝ off භාවිතා කරන්න.");
        updates.statusSeen = bool(value);
        break;
      case "statusreact":
      case "status_react":
        updates.statusReact = value.slice(0, 12);
        break;
      case "antiview":
      case "antiviewroute":
        if (!["me", "from"].includes(value.toLowerCase())) return reply("❌ Anti-view route: me / from");
        updates.antiViewRoute = value.toLowerCase();
        break;
      case "antidelete":
      case "antideleteroute":
        if (!["me", "from"].includes(value.toLowerCase())) return reply("❌ Anti-delete route: me / from");
        updates.antiDeleteRoute = value.toLowerCase();
        break;
      default:
        return reply("❌ නොදන්නා setting එකක්. .setting ලෙස යවලා help බලන්න.");
    }

    try {
      const saved = await updateBotSettings(currentBotNumber, updates);
      return reply(`✅ Setting update වුණා!\n${key}: ${value}\n\nඅලුත් settings cache එකටත් save කළා.`);
    } catch (err) {
      console.error("SETTING UPDATE ERROR:", err);
      return reply("❌ Settings save කරන්න බැරි වුණා. MongoDB connection එක පරීක්ෂා කරන්න.");
    }
  }
};

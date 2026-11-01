const { updateBotSettings } = require("../lib/settingsHelper");

function box(title, lines = []) {
  return `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n` +
    `┃◈╭─────────────·๏\n┃◈┃ 🎙️ ${title}\n┃◈┃\n` +
    lines.map(line => `┃◈┃ ${line}\n`).join("") +
    `┃◈└───────────┈⊷\n╰──────────────┈⊷\n> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;
}

module.exports = {
  name: "voicechat",
  alias: ["voicetotext", "stt"],
  desc: "Enable or disable Supun AI voice-to-text",
  category: "settings",
  use: ".voicechat on/off/status",
  async execute(sock, msg, args, from, context = {}) {
    const { reply, isOwner, isDev, currentBotNumber, settings } = context;
    if (!isOwner && !isDev) return reply(box("ACCESS DENIED", ["මෙම සැකසුම වෙනස් කළ හැක්කේ Bot Ownerට පමණයි."]));
    const action = String(args?.[0] || "status").toLowerCase();
    if (action === "on" || action === "enable") {
      await updateBotSettings(currentBotNumber, { voiceToTextEnabled: true });
      return reply(box("VOICE TO TEXT ENABLED", ["Supun AI voice transcription සක්‍රියයි.", "Voice note එකක් එවලා පරීක්ෂා කරන්න."]));
    }
    if (action === "off" || action === "disable") {
      await updateBotSettings(currentBotNumber, { voiceToTextEnabled: false });
      return reply(box("VOICE TO TEXT DISABLED", ["Supun AI voice transcription අක්‍රිය කළා."]));
    }
    if (action !== "status") return reply(box("USAGE", [".voicechat on", ".voicechat off", ".voicechat status"]));
    const enabled = settings?.voiceToTextEnabled !== false;
    return reply(box("VOICE TO TEXT STATUS", [
      `Status: ${enabled ? "ON ✅" : "OFF ❌"}`,
      `Supun STT API: ${process.env.SUPUN_STT_API_URL ? "Configured" : "Not configured ⚠️"}`
    ]));
  }
};

// ════════════════ AUTO REPLY COMMAND ════════════════════════
const { updateBotSettings } = require("../lib/settingsHelper");

module.exports = {
  name: "autoreply",
  alias: ["autoresponse", "autogreet"],
  desc: "Enable or disable automatic replies",
  category: "settings",
  use: ".autoreply on/off",

  async execute(sock, msg, args, from, { reply, settings, isOwner }) {
    if (!isOwner) return reply("❌ Owner Only Command!");
    const action = String(args[0] || "").toLowerCase();
    if (!["on", "off"].includes(action)) {
      return reply(`╭━━〔 🤖 AUTO REPLY 〕━━╮\n┃ Status: ${(settings?.autoReplyEnabled !== false) ? "ON ✅" : "OFF ❌"}\n┃\n┃ .autoreply on\n┃ .autoreply off\n╰━━━━━━━━━━━━━━━━━━╯`);
    }
    const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
    await updateBotSettings(botNumber, { autoReplyEnabled: action === "on" });
    return reply(action === "on" ? "✅ Auto Reply Enabled!\n\ngm / mk / hi / bye / hmm" : "❌ Auto Reply Disabled!");
  }
};

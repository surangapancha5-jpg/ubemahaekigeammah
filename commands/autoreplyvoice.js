const { updateBotSettings } = require("../lib/settingsHelper");

// ════════════════ AUTO REPLY AI VOICE CONTROL ════════════════════════
module.exports = {
  name: "autoreplyvoice",
  alias: ["arvoice", "autovoice"],
  desc: "Enable or disable AI voice for automatic replies",
  category: "settings",
  use: ".autoreplyvoice on/off",
  async execute(sock, msg, args, from, { reply, settings, isOwner }) {
    if (!isOwner) return reply("❌ Owner Only Command!");
    const action = String(args[0] || "").toLowerCase();
    if (!["on", "off"].includes(action)) {
      return reply(`🎙️ Auto Reply Voice: ${settings?.autoReplyVoiceEnabled !== false ? "ON" : "OFF"}\n\n.autoreplyvoice on\n.autoreplyvoice off`);
    }
    const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
    await updateBotSettings(botNumber, { autoReplyVoiceEnabled: action === "on" });
    return reply(action === "on" ? "✅ Auto Reply AI Voice ON" : "🔇 Auto Reply AI Voice OFF");
  }
};

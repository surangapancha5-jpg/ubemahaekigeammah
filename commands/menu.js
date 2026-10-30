const fs = require("fs");
const path = require("path");

module.exports = {
    name: "resetsettings",
    alias: ["resetsetting", "resetconfig"],
    desc: "Reset all bot settings",
    category: "owner",
    use: ".resetsettings",

    async execute(sock, msg, args, from, { reply, isOwner }) {

        try {

            // Owner Check
            if (!isOwner) {
                return reply("❌ This command is only for the owner!");
            }

            const settingsPath = path.join(
                process.cwd(),
                "settings.json"
            );

            // Default Settings
            const defaultSettings = {
                botName: "ZANTA-XMD",
                prefix: ".",
                mode: "public",
                presence: "available",
                autoReply: false,
                autoRead: false,
                autoTyping: false,
                logo: "",
                ownerName: "Owner"
            };

            // Confirmation Message
            await sock.sendMessage(from, {
                text: "⚙️ *ZANTA-XMD SETTINGS RESETTING...*\n\n⏳ Please wait!"
            }, { quoted: msg });

            // Reset Settings
            fs.writeFileSync(
                settingsPath,
                JSON.stringify(defaultSettings, null, 2)
            );

            // Success Message
            await sock.sendMessage(from, {
                text: `
╭━━〔 ⚙️ SETTINGS RESET 〕━━╮
┃
┃ ✅ Settings Reset Successful!
┃
┃ ◈ Bot Name : ZANTA-XMD
┃ ◈ Prefix : .
┃ ◈ Mode : Public
┃ ◈ Presence : Available
┃ ◈ Auto Reply : OFF
┃ ◈ Auto Read : OFF
┃ ◈ Auto Typing : OFF
┃
┃ 🔄 Restart bot to apply all changes.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

> © ZANTA-XMD MINI 💫
`
            }, { quoted: msg });

        } catch (error) {

            console.error("RESET SETTINGS ERROR:", error);

            await reply("❌ Settings reset failed!");

        }
    }
};
// ════════════════ FORWARD COMMAND ═════════════════════════

module.exports = {
    name: "forward",
    alias: ["fwd"],
    desc: "Forward a replied message to another chat",
    category: "tools",
    use: ".forward 947XXXXXXXX",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // ════════════════ GET TARGET NUMBER ═════════════

            const number = (args[0] || "").replace(/\D/g, "");

            if (!number || number.length < 10 || number.length > 15) {
                return reply(
`╭━━〔 📤 FORWARD 〕━━╮
┃
┃ Usage:
┃ .forward 947XXXXXXXX
┃
┃ පළමුව message එකකට
┃ Reply කරලා command එක ගහන්න.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            // ════════════════ GET QUOTED MESSAGE ════════════

            const context =
                msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo ||
                msg.message?.videoMessage?.contextInfo;

            const quotedMessage = context?.quotedMessage;

            if (!quotedMessage) {
                return reply("❌ Forward කරන්න අවශ්‍ය message එකට Reply කරන්න.");
            }

            const targetJid = `${number}@s.whatsapp.net`;

            if (targetJid === from) {
                return reply("❌ මේ chat එකටම forward කරන්න බැහැ.");
            }

            // ════════════════ BUILD ORIGINAL MESSAGE ════════

            const { generateWAMessageFromContent } =
                require("@whiskeysockets/baileys");

            const forwardMessage = await generateWAMessageFromContent(
                targetJid,
                quotedMessage,
                {}
            );

            // ════════════════ SEND FORWARDED MESSAGE ════════

            await sock.relayMessage(
                targetJid,
                forwardMessage.message,
                { messageId: forwardMessage.key.id }
            );

            return reply(
`╭━━〔 ✅ FORWARDED 〕━━╮
┃
┃ 📤 To : +${number}
┃
┃ Message එක සාර්ථකව
┃ forward කළා.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            );

        } catch (error) {
            console.error("[FORWARD ERROR]", error);
            return reply(`❌ Forward Error: ${error.message}`);
        }
    }
};
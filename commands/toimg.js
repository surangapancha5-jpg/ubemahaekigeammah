// ════════════════ STICKER TO IMAGE COMMAND ════════════════════════
// Sticker එකක් PNG image එකක් බවට පරිවර්තනය කරයි.

const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
    name: "toimg",
    alias: ["toimage", "sticker2img"],
    desc: "Convert Sticker to Image",
    category: "convert",
    use: ".toimg (Reply to a sticker)",

    async execute(sock, msg, args, from, { reply }) {
        try {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!quoted?.stickerMessage) {
                return reply("❌ Sticker එකකට Reply කරලා `.toimg` යවන්න.");
            }

            const quotedMsg = {
                key: {
                    remoteJid: from,
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: msg.message.extendedTextMessage.contextInfo.participant
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(
                quotedMsg,
                "buffer",
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || !buffer.length) {
                return reply("❌ Sticker එක Download කරගන්න බැරි වුණා.");
            }

            await sock.sendMessage(from, {
                image: buffer,
                mimetype: "image/png",
                caption: "✅ Sticker converted to image!"
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("TOIMG ERROR:", error);
            return reply("❌ Sticker එක Image එකක් කරන්න බැරි වුණා.\n\n" + error.message);
        }
    }
};
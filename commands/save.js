module.exports = {
    name: "save",
    alias: ["savestatus", "statussave"],
    desc: "Download WhatsApp Status",
    category: "download",
    use: ".save (reply to status)",

    async execute(sock, msg, args, from, { reply }) {

        try {

            // Get Quoted Message
            const quoted =
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!quoted) {
                return reply(
                    "❌ Please reply to a WhatsApp Status with .save"
                );
            }

            // Status Message Data
            const status =
                quoted.imageMessage ||
                quoted.videoMessage;

            if (!status) {
                return reply(
                    "❌ Only image and video statuses are supported."
                );
            }

            await sock.sendMessage(from, {
                text: "📥 *Downloading Status...*"
            }, { quoted: msg });

            // Download Status
            const buffer = await sock.downloadMediaMessage({
                key: msg.message.extendedTextMessage.contextInfo.stanzaId
                    ? {
                        remoteJid: from,
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                        participant: msg.message.extendedTextMessage.contextInfo.participant
                    }
                    : msg.key,
                message: quoted
            });

            // Send Image
            if (quoted.imageMessage) {

                await sock.sendMessage(from, {
                    image: buffer,
                    caption: "📸 *STATUS IMAGE SAVED SUCCESSFULLY!*\n\n> © ZANTA-XMD MINI"
                }, { quoted: msg });

            }

            // Send Video
            else if (quoted.videoMessage) {

                await sock.sendMessage(from, {
                    video: buffer,
                    caption: "🎬 *STATUS VIDEO SAVED SUCCESSFULLY!*\n\n> © ZANTA-XMD MINI",
                    mimetype: "video/mp4"
                }, { quoted: msg });

            }

        } catch (error) {

            console.error("SAVE STATUS ERROR:", error);

            await reply(
                "❌ Status download failed!\n\nMake sure you reply directly to a supported status."
            );

        }
    }
};
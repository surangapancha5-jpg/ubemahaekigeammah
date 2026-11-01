const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const axios = require("axios");
const FormData = require("form-data");

// ════════════════ COMMAND DETAILS ══════════════════════════

module.exports = {
    name: "tourl",
    alias: ["url", "geturl"],
    desc: "Convert media into direct URL",
    category: "tools",
    use: ".tourl (Reply to media)",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // ════════════════ GET REPLIED MEDIA ════════════════

            const context =
                msg.message?.extendedTextMessage?.contextInfo;

            let mediaMessage = msg;

            if (context?.quotedMessage) {
                mediaMessage = {
                    key: {
                        remoteJid: from,
                        id: context.stanzaId,
                        participant: context.participant
                    },
                    message: context.quotedMessage
                };
            }

            const content = mediaMessage.message || {};

            const mediaType = Object.keys(content).find(type =>
                [
                    "imageMessage",
                    "videoMessage",
                    "audioMessage",
                    "documentMessage",
                    "stickerMessage"
                ].includes(type)
            );

            if (!mediaType) {
                return reply(
                    "╭━━〔 🔗 MEDIA TO URL 〕━━╮\n" +
                    "┃\n" +
                    "┃ Media එකකට Reply කරලා\n" +
                    "┃ .tourl යවන්න.\n" +
                    "┃\n" +
                    "┃ Supports:\n" +
                    "┃ 🖼️ Image\n" +
                    "┃ 🎥 Video\n" +
                    "┃ 🎵 Audio\n" +
                    "┃ 📄 Document\n" +
                    "┃ 🎭 Sticker\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━╯"
                );
            }

            // ════════════════ DOWNLOAD MEDIA ═══════════════════

            await sock.sendMessage(from, {
                react: { text: "⏳", key: msg.key }
            });

            const buffer = await downloadMediaMessage(
                mediaMessage,
                "buffer",
                {},
                {
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || !buffer.length) {
                throw new Error("Media download failed.");
            }

            if (buffer.length > 50 * 1024 * 1024) {
                throw new Error("50MB ට වඩා විශාල Files Upload කළ නොහැක.");
            }

            // ════════════════ PREPARE FILE ══════════════════════

            const media = content[mediaType];

            const mimeType =
                media.mimetype || "application/octet-stream";

            const extension = mimeType.split("/")[1]?.split(";")[0] || "bin";

            const form = new FormData();

            form.append("file", buffer, {
                filename: `zanta-media.${extension}`,
                contentType: mimeType
            });

            await reply(
                "╭━━〔 🔗 ZANTA-XMD 〕━━╮\n" +
                "┃\n" +
                "┃ 📤 Media Upload කරනවා...\n" +
                "┃ ⏳ Please Wait...\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
            );

            // ════════════════ UPLOAD MEDIA ══════════════════════
            // Uguu temporary file hosting service

            const response = await axios.post(
                "https://uguu.se/upload",
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 120000,
                    maxBodyLength: 50 * 1024 * 1024,
                    maxContentLength: 50 * 1024 * 1024
                }
            );

            const fileUrl = response.data?.files?.[0]?.url;

            if (!fileUrl || !/^https:\/\/uguu\.se\//i.test(fileUrl)) {
                throw new Error("Upload URL එකක් ලැබුණේ නැහැ.");
            }

            // ════════════════ SEND URL ═════════════════════════

            await sock.sendMessage(from, {
                text:
                    "╭━━〔 ✅ MEDIA TO URL 〕━━╮\n" +
                    "┃\n" +
                    "┃ 🔗 Upload Successful!\n" +
                    "┃\n" +
                    `┃ 📁 Type: ${mediaType.replace("Message", "")}\n` +
                    `┃ 📦 Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n` +
                    "┃\n" +
                    `┃ 🌐 URL:\n${fileUrl}\n` +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━╯\n\n" +
                    "> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃"
            }, {
                quoted: msg
            });

            await sock.sendMessage(from, {
                react: { text: "✅", key: msg.key }
            });

        } catch (error) {
            console.error("[TOURL ERROR]", error);

            return reply(
                "╭━━〔 ❌ TOURL ERROR 〕━━╮\n" +
                "┃\n" +
                `┃ ${error.message || "Upload failed"}\n` +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }
    }
};
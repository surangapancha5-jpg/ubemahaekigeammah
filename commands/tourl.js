const axios = require("axios");
const FormData = require("form-data");
const {
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const path = require("path");
const os = require("os");

module.exports = {
    name: "tourl",
    alias: ["url", "upload"],
    desc: "Upload media to Catbox.moe",

    async execute(sock, msg, args, from) {
        try {
            // Get quoted message
            const message = msg.message || {};

            let quoted =
                message.extendedTextMessage
                    ?.contextInfo?.quotedMessage;

            // Support different message wrappers
            function unwrap(m) {
                while (m) {
                    if (m.ephemeralMessage?.message) {
                        m = m.ephemeralMessage.message;
                    } else if (m.viewOnceMessage?.message) {
                        m = m.viewOnceMessage.message;
                    } else if (m.viewOnceMessageV2?.message) {
                        m = m.viewOnceMessageV2.message;
                    } else if (m.viewOnceMessageV2Extension?.message) {
                        m = m.viewOnceMessageV2Extension.message;
                    } else if (m.documentWithCaptionMessage?.message) {
                        m = m.documentWithCaptionMessage.message;
                    } else {
                        break;
                    }
                }
                return m;
            }

            quoted = unwrap(quoted);

            // If no reply, check whether command itself has media
            const current = unwrap(message);

            const mediaTypes = [
                "imageMessage",
                "videoMessage",
                "audioMessage",
                "documentMessage",
                "stickerMessage"
            ];

            let mediaKey = quoted
                ? mediaTypes.find(k => quoted[k])
                : null;

            let media = mediaKey ? quoted[mediaKey] : null;

            if (!media) {
                mediaKey = mediaTypes.find(k => current[k]);
                media = mediaKey ? current[mediaKey] : null;
            }

            if (!media || !mediaKey) {
                return await sock.sendMessage(
                    from,
                    {
                        text:
                            "❌ Media එකකට Reply කරලා .tourl යවන්න.\n\n" +
                            "සහාය දක්වන්නේ: Image, Sticker, MP3, Document, Video"
                    },
                    { quoted: msg }
                );
            }

            await sock.sendMessage(from, {
                react: { text: "⏳", key: msg.key }
            });

            // Download media
            const typeMap = {
                imageMessage: "image",
                videoMessage: "video",
                audioMessage: "audio",
                documentMessage: "document",
                stickerMessage: "sticker"
            };

            const stream = await downloadContentFromMessage(
                media,
                typeMap[mediaKey]
            );

            const chunks = [];

            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const buffer = Buffer.concat(chunks);

            if (!buffer.length) {
                throw new Error("Downloaded media is empty");
            }

            // File name
            const mime = media.mimetype || "application/octet-stream";

            const mimeExtensions = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "video/mp4": "mp4",
                "audio/mpeg": "mp3",
                "audio/ogg": "ogg",
                "audio/mp4": "m4a",
                "application/pdf": "pdf",
                "application/zip": "zip",
                "text/plain": "txt"
            };

            let extension = mimeExtensions[mime];

            if (!extension) {
                extension = path.extname(media.fileName || "").slice(1);
            }

            if (!extension) {
                extension = mediaKey === "stickerMessage"
                    ? "webp"
                    : "bin";
            }

            const filename = `upload_${Date.now()}.${extension}`;

            // Upload to Catbox
            const form = new FormData();

            form.append("reqtype", "fileupload");
            form.append("fileToUpload", buffer, {
                filename,
                contentType: mime
            });

            const response = await axios.post(
                "https://catbox.moe/user/api.php",
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 120000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );

            const url = String(response.data).trim();

            if (
                response.status !== 200 ||
                !/^https:\/\/files\.catbox\.moe\/[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/.test(url)
            ) {
                throw new Error("Catbox response: " + url);
            }

            await sock.sendMessage(
                from,
                {
                    text:
                        "✅ *UPLOAD SUCCESSFUL*\n\n" +
                        `📁 *File:* ${filename}\n` +
                        `📦 *Size:* ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n\n` +
                        `🔗 *Link:*\n${url}\n\n` +
                        "🌐 *Host:* Catbox.moe"
                },
                { quoted: msg }
            );

            await sock.sendMessage(from, {
                react: { text: "✅", key: msg.key }
            });

        } catch (error) {
            console.error("TOURL ERROR:", error);

            await sock.sendMessage(
                from,
                {
                    text:
                        "❌ *Upload failed!*\n\n" +
                        "Media download හෝ Catbox upload එක අසාර්ථකයි.\n\n" +
                        `⚠️ Error: ${String(error.message).slice(0, 250)}`
                },
                { quoted: msg }
            );
        }
    }
};
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

// ════════════════════════════════════════════════════════
//          CATBOX.MOE TOURl UPLOADER
//          Media එක Catbox වෙත Upload කිරීම.
// ════════════════════════════════════════════════════════

function zantaBox(title, lines = []) {
    return (
        `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n` +
        `┃◈╭─────────────·๏\n` +
        `┃◈┃⛩️ ${title}\n` +
        `┃◈┃\n` +
        lines.map(line => `┃◈┃⛩️ ${line}\n`).join("") +
        `┃◈└───────────┈⊷\n` +
        `╰──────────────┈⊷\n` +
        `> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
    );
}

module.exports = {
    name: "tourl",
    alias: ["url", "upload"],
    desc: "Upload Media to Catbox",
    category: "tools",
    use: ".tourl (Reply to media)",

    async execute(sock, msg, args, from, { reply }) {
        try {

            // ════════════════════════════════════════════════
            //          GET MEDIA MESSAGE
            //          Reply කළ Media එක ලබාගැනීම.
            // ════════════════════════════════════════════════

            const context =
                msg.message?.extendedTextMessage?.contextInfo;

            const quotedMessage = context?.quotedMessage;

            let mediaMsg;
            let mediaContent;

            if (quotedMessage) {
                mediaMsg = {
                    key: {
                        remoteJid: from,
                        id: context.stanzaId,
                        participant: context.participant
                    },
                    message: quotedMessage
                };

                mediaContent = quotedMessage;
            } else {
                mediaMsg = msg;
                mediaContent = msg.message;
            }

            // ════════════════════════════════════════════════
            //          FIND MEDIA TYPE
            //          Image, Video, Audio, Document හඳුනාගැනීම.
            // ════════════════════════════════════════════════

            function findMedia(content) {
                if (!content || typeof content !== "object") return null;

                const types = [
                    "imageMessage",
                    "videoMessage",
                    "audioMessage",
                    "documentMessage",
                    "stickerMessage"
                ];

                for (const type of types) {
                    if (content[type]) {
                        return {
                            type,
                            data: content[type]
                        };
                    }
                }

                for (const value of Object.values(content)) {
                    if (value && typeof value === "object") {
                        const found = findMedia(value);
                        if (found) return found;
                    }
                }

                return null;
            }

            const media = findMedia(mediaContent);

            if (!media) {
                return reply(zantaBox("TOURL UPLOADER", [
                    "Media එකකට Reply කරන්න.",
                    "Image / Video / Audio / Document",
                    "ඉන්පසු .tourl යවන්න."
                ]));
            }

            await reply(zantaBox("CATBOX UPLOADER", [
                "Media එක Download කරමින් පවතී...",
                "කරුණාකර රැඳී සිටින්න."
            ]));

            // ════════════════════════════════════════════════
            //          DOWNLOAD MEDIA
            //          WhatsApp Media Buffer එක ලබාගැනීම.
            // ════════════════════════════════════════════════

            const buffer = await downloadMediaMessage(
                mediaMsg,
                "buffer",
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || !buffer.length) {
                throw new Error("Media download failed");
            }

            // Catbox upload size limit protection
            const MAX_SIZE = 200 * 1024 * 1024;

            if (buffer.length > MAX_SIZE) {
                return reply(zantaBox("FILE TOO LARGE", [
                    "File එක 200MB සීමාව ඉක්මවා ඇත.",
                    `Size: ${(buffer.length / 1048576).toFixed(2)} MB`
                ]));
            }

            // ════════════════════════════════════════════════
            //          FILE INFORMATION
            //          File Name සහ MIME Type සකස් කිරීම.
            // ════════════════════════════════════════════════

            const mime =
                media.data.mimetype || "application/octet-stream";

            const extensions = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "image/gif": "gif",
                "video/mp4": "mp4",
                "video/webm": "webm",
                "audio/mpeg": "mp3",
                "audio/mp4": "m4a",
                "audio/ogg": "ogg",
                "audio/opus": "opus",
                "application/pdf": "pdf"
            };

            const originalName =
                media.data.fileName ||
                `${media.type.replace("Message", "")}.${extensions[mime] || "bin"}`;

            const safeName = path.basename(originalName)
                .replace(/[^\w.-]/g, "_");

            // ════════════════════════════════════════════════
            //          CATBOX API UPLOAD
            //          Catbox වෙත File එක Upload කිරීම.
            // ════════════════════════════════════════════════

            const form = new FormData();

            form.append("reqtype", "fileupload");
            form.append("fileToUpload", buffer, {
                filename: safeName,
                contentType: mime
            });

            const response = await axios.post(
                "https://catbox.moe/user/api.php",
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 180000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    responseType: "text"
                }
            );

            const uploadedUrl = String(response.data || "").trim();

            // ════════════════════════════════════════════════
            //          CHECK UPLOAD RESULT
            //          Upload එක සාර්ථකද පරීක්ෂා කිරීම.
            // ════════════════════════════════════════════════

            if (
                !/^https:\/\/files\.catbox\.moe\/[a-zA-Z0-9._-]+$/.test(uploadedUrl)
            ) {
                console.log("CATBOX RESPONSE:", uploadedUrl);

                return reply(zantaBox("UPLOAD FAILED", [
                    "Catbox API එකෙන් නිවැරදි URL එකක් ලැබුණේ නැහැ.",
                    `Response: ${uploadedUrl.slice(0, 150)}`
                ]));
            }

            // ════════════════════════════════════════════════
            //          SEND URL
            //          Public URL එක WhatsApp වෙත යැවීම.
            // ════════════════════════════════════════════════

            await reply(zantaBox("UPLOAD SUCCESS", [
                `File: ${safeName}`,
                `Size: ${(buffer.length / 1048576).toFixed(2)} MB`,
                "Public URL:",
                uploadedUrl,
                "Uploaded By ZANTA-XMD"
            ]));

        } catch (error) {
            console.error(
                "CATBOX ERROR:",
                error.response?.data || error.message
            );

            return reply(zantaBox("UPLOAD ERROR", [
                "File එක Upload කිරීමට නොහැකි වුණා.",
                "Catbox සේවාව සහ Heroku Logs පරීක්ෂා කරන්න."
            ]));
        }
    }
};
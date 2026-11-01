// ════════════════ IMPORTS ════════════════════════════════

const axios = require("axios");

// ════════════════ VIDEO SESSIONS ═════════════════════════

if (!global.videoSessions) {
global.videoSessions = new Map();
}

// ════════════════ VIDEO COMMAND ══════════════════════════

module.exports = {
name: "video",
alias: ["ytvideo", "ytmp4", "ytmp3"],
desc: "YouTube Video & MP3 Downloader",
category: "download",
use: ".video <YouTube URL>",

async execute(sock, msg, args, from, { reply }) {

    try {

        // ════════════════ API CONFIG ══════════════════

        const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

        if (!API_KEY) {
            return reply("❌ YOUTUBE_API_KEY එක .env එකේ නැහැ.");
        }

        // ════════════════ GET URL ══════════════════════

        const input = args.join(" ");

        const sessionKey = from + ":" +
            (msg.key.participant || msg.key.remoteJid);

        // ════════════════ QUALITY SELECTION ═══════════

        const session = global.videoSessions.get(sessionKey);

        if (session && /^[1-5]$/.test(input.trim())) {

            const choice = input.trim();

            const options = {
                "1": { quality: "360p", format: "mp4" },
                "2": { quality: "480p", format: "mp4" },
                "3": { quality: "720p", format: "mp4" },
                "4": { quality: "1080p", format: "mp4" },
                "5": { quality: "1280", format: "mp3" }
            };

            const selected = options[choice];

            global.videoSessions.delete(sessionKey);

            await reply("⏳ Download link එක සකස් කරමින්...");

            // ════════════════ API REQUEST ══════════════

            const apiURL =
                "https://api.chamindu.site/api/v1/youtube/download";

            const response = await axios.get(apiURL, {
                params: {
                    url: session.url,
                    quality: selected.quality,
                    format: selected.format,
                    api_key: API_KEY
                },
                timeout: 120000
            });

            const data = response.data;

            // ════════════════ EXTRACT DOWNLOAD URL ═════

            function findURL(obj) {
                if (!obj || typeof obj !== "object") return null;

                for (const [key, value] of Object.entries(obj)) {
                    if (
                        typeof value === "string" &&
                        /^https?:\/\//i.test(value) &&
                        /url|download|link/i.test(key)
                    ) {
                        return value;
                    }
                }

                for (const value of Object.values(obj)) {
                    if (value && typeof value === "object") {
                        const found = findURL(value);
                        if (found) return found;
                    }
                }

                return null;
            }

            const downloadURL = findURL(data);

            if (!downloadURL) {
                throw new Error(
                    "API එකෙන් Download URL එකක් ලැබුණේ නැහැ."
                );
            }

            // ════════════════ SEND MP3 ═════════════════

            if (selected.format === "mp3") {

                await sock.sendMessage(from, {
                    audio: { url: downloadURL },
                    mimetype: "audio/mpeg",
                    fileName: "ZANTA-XMD.mp3"
                }, { quoted: msg });

            } else {

                // ════════════════ SEND VIDEO ═══════════

                await sock.sendMessage(from, {
                    video: { url: downloadURL },
                    mimetype: "video/mp4",
                    fileName: "ZANTA-XMD.mp4",
                    caption:

`╭━━〔 🎬 ZANTA VIDEO 〕━━╮
┃
┃ ✅ Download Successful
┃
┃ ◈ Quality : ${selected.quality}
┃ ◈ Format : MP4
┃ ◈ Status : SUCCESS
┃
╰━━━━━━━━━━━━━━━━━━━━╯

«𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃`
}, { quoted: msg });»

            }

            return;
        }

        // ════════════════ VALIDATE URL ════════════════

        const url = input.match(
            /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i
        )?.[0];

        if (!url) {
            return reply(

"╭━━〔 🎬 YOUTUBE DOWNLOADER 〕━━╮ ┃ ┃ YouTube URL එකක් ලබා දෙන්න. ┃ ┃ Example: ┃ .video https://youtu.be/VIDEO_ID ┃ ╰━━━━━━━━━━━━━━━━━━━━━━━━╯"
);
}

        // ════════════════ SAVE SESSION ════════════════

        global.videoSessions.set(sessionKey, {
            url,
            time: Date.now()
        });

        // ════════════════ QUALITY MENU ════════════════

        return reply(

`╭━━〔 🎬 ZANTA VIDEO 〕━━╮
┃
┃ 🎥 SELECT VIDEO QUALITY
┃
┃ 1️⃣  360p
┃ 2️⃣  480p
┃ 3️⃣  720p
┃ 4️⃣  1080p
┃
┃ 🎵 AUDIO DOWNLOAD
┃
┃ 5️⃣  MP3
┃
┃ ━━━━━━━━━━━━━━━━━━━
┃
┃ Reply with a number.
┃ Example : 4
┃
╰━━━━━━━━━━━━━━━━━━━━╯

«𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃`
);»

    } catch (error) {

        console.error("[VIDEO ERROR]", error.response?.data || error);

        return reply(

"╭━━〔 ❌ VIDEO ERROR 〕━━╮ ┃ ┃ ${error.response?.data?.message || error.message} ┃ ╰━━━━━━━━━━━━━━━━━━━━╯"
);

    }
}

};
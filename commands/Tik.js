require("dotenv").config();

const axios = require("axios");

module.exports = {
name: "tiktok",
alias: ["tt", "ttdl"],
desc: "Download TikTok videos",
category: "download",
use: ".tiktok <TikTok URL>",

async execute(sock, msg, args, from, { reply }) {
    let waitMsg;

    try {
        const url = args[0];

        if (!url) {
            return reply(
                "╭━━〔 🎵 TIKTOK DOWNLOADER 〕━━╮\n" +
                "┃\n" +
                "┃ ❌ TikTok URL එකක් ලබාදෙන්න!\n" +
                "┃\n" +
                "┃ Example:\n" +
                "┃ .tiktok https://vt.tiktok.com/xxxxx\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        if (!/https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com/i.test(url)) {
            return reply("❌ නිවැරදි TikTok URL එකක් ලබාදෙන්න!");
        }

        const apiKey = process.env.TIKTOK_API_KEY;

        if (!apiKey) {
            return reply("❌ TIKTOK_API_KEY එක .env එකේ නැහැ!");
        }

        waitMsg = await sock.sendMessage(from, {
            text: "⏳ TikTok Video එක Download කරමින් පවතී..."
        }, { quoted: msg });

        const response = await axios.get(
            "https://back.asitha.top/api/tiktok/download",
            {
                params: {
                    apiKey,
                    url
                },
                timeout: 120000
            }
        );

        const data = response.data;

        console.log(
            "TIKTOK API RESPONSE:",
            JSON.stringify(data, null, 2)
        );

        const findVideoUrl = (obj) => {
            if (!obj) return null;

            if (typeof obj === "string") {
                if (/^https?:\/\//i.test(obj)) return obj;
                return null;
            }

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const found = findVideoUrl(item);
                    if (found) return found;
                }
                return null;
            }

            if (typeof obj === "object") {
                const keys = [
                    "videoUrl",
                    "video_url",
                    "downloadUrl",
                    "download_url",
                    "nowm",
                    "noWatermark",
                    "url"
                ];

                for (const key of keys) {
                    if (obj[key]) {
                        const found = findVideoUrl(obj[key]);
                        if (found) return found;
                    }
                }

                for (const value of Object.values(obj)) {
                    const found = findVideoUrl(value);
                    if (found) return found;
                }
            }

            return null;
        };

        const videoUrl = findVideoUrl(data);

        if (!videoUrl) {
            throw new Error(
                data?.message ||
                data?.error ||
                "API එකෙන් Video URL එකක් ලැබුණේ නැහැ."
            );
        }

        const videoResponse = await axios.get(videoUrl, {
            responseType: "arraybuffer",
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024
        });

        const videoBuffer = Buffer.from(videoResponse.data);

        if (!videoBuffer.length) {
            throw new Error("Video එක හිස්.");
        }

        await sock.sendMessage(from, {
            video: videoBuffer,
            mimetype: "video/mp4",
            caption:
                "╭━━〔 🎵 ZANTA-XMD 〕━━╮\n" +
                "┃\n" +
                "┃ ✅ TIKTOK DOWNLOADED!\n" +
                "┃\n" +
                "┃ 🎬 Video Ready\n" +
                "┃ ⚡ ZANTA-XMD DOWNLOADER\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

    } catch (error) {
        console.error(
            "TIKTOK DOWNLOAD ERROR:",
            error.response?.data || error.message
        );

        await reply(
            "❌ TikTok Download Failed!\n\n" +
            (error.response?.data?.message ||
             error.message)
        );

    } finally {
        if (waitMsg?.key) {
            await sock.sendMessage(from, {
                delete: waitMsg.key
            }).catch(() => {});
        }
    }
}

};
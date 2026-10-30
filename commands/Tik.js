require("dotenv").config();

const axios = require("axios");

module.exports = {
    name: "tiktok",
    alias: ["tt", "ttdl", "tik"],
    desc: "TikTok Video Downloader",
    category: "download",
    use: ".tiktok <TikTok URL>",

    async execute(sock, msg, args, from, { reply }) {
        let waitMsg;

        try {
            const url = args.join(" ").trim();

            if (!url) {
                return reply(
                    "╭━━〔 🎵 TIKTOK DOWNLOADER 〕━━╮\n" +
                    "┃\n" +
                    "┃ ❌ TikTok URL එකක් ලබාදෙන්න!\n" +
                    "┃\n" +
                    "┃ Example:\n" +
                    "┃ .tiktok https://www.tiktok.com/@user/video/123456\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━━━━━╯"
                );
            }

            let parsed;

            try {
                parsed = new URL(url);
            } catch {
                return reply("❌ නිවැරදි TikTok URL එකක් ලබාදෙන්න!");
            }

            const host = parsed.hostname.toLowerCase();

            if (
                !host.endsWith("tiktok.com") ||
                !["tiktok.com", "www.tiktok.com", "vm.tiktok.com",
                    "vt.tiktok.com", "m.tiktok.com"].includes(host)
            ) {
                return reply("❌ මෙය නිවැරදි TikTok URL එකක් නොවේ!");
            }

            const apiKey = process.env.CHAMINDU_API_KEY;

            if (!apiKey) {
                return reply("❌ CHAMINDU_API_KEY එක .env එකේ නැහැ!");
            }

            waitMsg = await sock.sendMessage(from, {
                text:
                    "╭━━〔 🎵 ZANTA-XMD 〕━━╮\n" +
                    "┃\n" +
                    "┃ 🔍 TikTok Video Processing...\n" +
                    "┃ ⏳ Please wait...\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯"
            }, { quoted: msg });

            // API Request
            const response = await axios.get(
                "https://api.chamindu.site/api/v1/tools/savethevideo/download",
                {
                    params: {
                        url: url,
                        api_key: apiKey
                    },
                    timeout: 120000,
                    headers: {
                        Accept: "application/json"
                    }
                }
            );

            const data = response.data;

            console.log(
                "\n====== CHAMINDU TIKTOK API RESPONSE ======\n",
                JSON.stringify(data, null, 2),
                "\n==========================================\n"
            );

            // Find video URL
            const videoKeys = [
                "video",
                "video_url",
                "videoUrl",
                "download",
                "download_url",
                "downloadUrl",
                "play",
                "play_url",
                "playUrl",
                "nowm",
                "no_watermark",
                "noWatermark",
                "url",
                "link"
            ];

            function findVideo(obj, depth = 0) {
                if (!obj || depth > 15) return null;

                if (typeof obj === "string") {
                    if (
                        /^https?:\/\//i.test(obj) &&
                        !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(obj)
                    ) {
                        return obj;
                    }
                    return null;
                }

                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        const result = findVideo(item, depth + 1);
                        if (result) return result;
                    }
                    return null;
                }

                if (typeof obj !== "object") return null;

                for (const key of videoKeys) {
                    if (obj[key] !== undefined) {
                        const result = findVideo(obj[key], depth + 1);
                        if (result) return result;
                    }
                }

                for (const value of Object.values(obj)) {
                    if (typeof value === "object") {
                        const result = findVideo(value, depth + 1);
                        if (result) return result;
                    }
                }

                return null;
            }

            const videoUrl = findVideo(data);

            if (!videoUrl) {
                throw new Error(
                    "API එකෙන් Video URL එකක් ලැබුණේ නැහැ. Terminal Response එක පරීක්ෂා කරන්න."
                );
            }

            // Download video
            const videoResponse = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 100 * 1024 * 1024,
                maxBodyLength: 100 * 1024 * 1024
            });

            const videoBuffer = Buffer.from(videoResponse.data);

            const contentType =
                videoResponse.headers["content-type"] || "";

            if (
                !contentType.includes("video/") &&
                !contentType.includes("octet-stream")
            ) {
                throw new Error(
                    "API එකෙන් ලැබුණු Link එකෙන් Video File එකක් ලැබුණේ නැහැ."
                );
            }

            if (!videoBuffer.length) {
                throw new Error("Video එක Download වුණේ නැහැ!");
            }

            // Send to WhatsApp
            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: "video/mp4",
                caption:
                    "╭━━〔 🎵 ZANTA-XMD 〕━━╮\n" +
                    "┃\n" +
                    "┃ ✅ TIKTOK DOWNLOADED!\n" +
                    "┃\n" +
                    "┃ 🎬 Video Ready\n" +
                    "┃ 📥 Download Complete\n" +
                    "┃ ⚡ ZANTA-XMD\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯"
            }, { quoted: msg });

        } catch (error) {
            console.error(
                "TIKTOK DOWNLOAD ERROR:",
                error.response?.data || error.message
            );

            let reason = error.message;

            if (error.response?.status === 401) {
                reason = "API Key එක වැරදියි!";
            } else if (error.response?.status === 403) {
                reason = "API Access Denied!";
            } else if (error.response?.status === 429) {
                reason = "API Request Limit එක ඉක්මවා ඇත!";
            } else if (error.response?.status === 500) {
                reason = "API Server Error!";
            }

            await reply(
                "╭━━〔 ❌ TIKTOK ERROR 〕━━╮\n" +
                "┃\n" +
                "┃ " + String(reason).slice(0, 500) + "\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
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
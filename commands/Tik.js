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
            return reply("❌ TikTok URL එකක් ලබාදෙන්න!\n\nExample:\n.tiktok https://www.tiktok.com/@user/video/123456");
        }

        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            return reply("❌ Invalid TikTok URL!");
        }

        if (!parsed.hostname.toLowerCase().endsWith("tiktok.com")) {
            return reply("❌ නිවැරදි TikTok URL එකක් ලබාදෙන්න!");
        }

        const apiKey = process.env.CHAMINDU_API_KEY;
        if (!apiKey) {
            return reply("❌ CHAMINDU_API_KEY එක .env එකේ නැහැ!");
        }

        waitMsg = await sock.sendMessage(from, {
            text: "╭━━〔 🎵 ZANTA-XMD 〕━━╮\n┃\n┃ ⏳ TikTok Video Downloading...\n┃ Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

        const response = await axios.get(
            "https://api.chamindu.site/api/v1/tools/savethevideo/download",
            {
                params: {
                    url,
                    api_key: apiKey
                },
                timeout: 120000,
                headers: { Accept: "application/json" }
            }
        );

        const data = response.data;

        console.log("TIKTOK API RESPONSE:", JSON.stringify(data, null, 2));

        function findMedia(obj, depth = 0) {
            if (!obj || depth > 15) return [];

            if (typeof obj === "string") {
                return /^https?:\/\//i.test(obj) ? [obj] : [];
            }

            if (Array.isArray(obj)) {
                return obj.flatMap(v => findMedia(v, depth + 1));
            }

            if (typeof obj !== "object") return [];

            const results = [];

            const preferred = [
                "video_url", "videoUrl", "download_url",
                "downloadUrl", "nowm", "noWatermark",
                "no_watermark", "play", "playUrl",
                "url", "link", "download"
            ];

            for (const key of preferred) {
                if (obj[key] !== undefined) {
                    results.push(...findMedia(obj[key], depth + 1));
                }
            }

            for (const [key, value] of Object.entries(obj)) {
                if (!preferred.includes(key)) {
                    results.push(...findMedia(value, depth + 1));
                }
            }

            return results;
        }

        const candidates = [...new Set(findMedia(data))];

        let videoBuffer = null;

        for (const mediaUrl of candidates) {
            try {
                const file = await axios.get(mediaUrl, {
                    responseType: "arraybuffer",
                    timeout: 120000,
                    maxContentLength: 100 * 1024 * 1024,
                    maxBodyLength: 100 * 1024 * 1024,
                    headers: {
                        Accept: "video/*, application/octet-stream, */*"
                    }
                });

                const type = file.headers["content-type"] || "";
                const buffer = Buffer.from(file.data);

                if (
                    buffer.length > 0 &&
                    (
                        type.includes("video/") ||
                        type.includes("octet-stream") ||
                        buffer.subarray(4, 8).toString() === "ftyp"
                    )
                ) {
                    videoBuffer = buffer;
                    break;
                }
            } catch (err) {
                console.log("MEDIA URL FAILED:", err.message);
            }
        }

        if (!videoBuffer) {
            throw new Error(
                candidates.length
                    ? "API එකෙන් ලැබුණු Links වලින් Video File එකක් ලබාගන්න බැරි වුණා."
                    : "API Response එකේ Download Link එකක් හමු වුණේ නැහැ."
            );
        }

        await sock.sendMessage(from, {
            video: videoBuffer,
            mimetype: "video/mp4",
            caption:
                "╭━━〔 🎵 ZANTA-XMD 〕━━╮\n" +
                "┃\n" +
                "┃ ✅ TIKTOK DOWNLOADED!\n" +
                "┃ 🎬 Video Ready\n" +
                "┃ 📥 Download Complete\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

    } catch (error) {
        console.error("TIKTOK ERROR:", error.response?.data || error.message);

        await reply(
            "╭━━〔 ❌ TIKTOK ERROR 〕━━╮\n" +
            "┃\n" +
            "┃ " + String(error.message).slice(0, 500) + "\n" +
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
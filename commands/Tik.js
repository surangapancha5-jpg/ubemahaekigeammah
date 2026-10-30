require("dotenv").config();

const axios = require("axios");

module.exports = {
name: "tiktok",
alias: ["tt", "ttdl", "tik"],
desc: "Download TikTok Videos",
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

        // Validate TikTok URL
        let parsedUrl;

        try {
            parsedUrl = new URL(url);
        } catch {
            return reply("❌ Invalid URL එකක් ලබාදී ඇත!");
        }

        const hostname = parsedUrl.hostname
            .toLowerCase()
            .replace(/^www\./, "");

        if (
            ![
                "tiktok.com",
                "vm.tiktok.com",
                "vt.tiktok.com",
                "m.tiktok.com"
            ].includes(hostname)
        ) {
            return reply("❌ නිවැරදි TikTok URL එකක් ලබාදෙන්න!");
        }

        const apiKey = process.env.TIKTOK_API_KEY;

        if (!apiKey) {
            return reply(
                "❌ TIKTOK_API_KEY එක .env file එකේ නැහැ!"
            );
        }

        waitMsg = await sock.sendMessage(from, {
            text:
                "╭━━〔 🎵 ZANTA-XMD 〕━━╮\n" +
                "┃\n" +
                "┃ 🔍 TikTok Video Searching...\n" +
                "┃ ⏳ Downloading Video...\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

        // Request TikTok API
        const response = await axios.get(
            "https://back.asitha.top/api/tiktok/download",
            {
                params: {
                    apiKey: apiKey,
                    url: url
                },
                timeout: 120000,
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const data = response.data;

        // Print API response for debugging
        console.log(
            "\n========== TIKTOK API RESPONSE ==========\n",
            JSON.stringify(data, null, 2),
            "\n=========================================\n"
        );

        if (!data) {
            throw new Error("TikTok API එකෙන් Response එකක් ලැබුණේ නැහැ.");
        }

        if (
            data.success === false ||
            data.status === false ||
            data.error
        ) {
            throw new Error(
                data.message ||
                data.error ||
                "TikTok API Error"
            );
        }

        // Find video URL from different response structures
        const preferredKeys = [
            "noWatermark",
            "no_watermark",
            "nowm",
            "play",
            "playUrl",
            "play_url",
            "videoUrl",
            "video_url",
            "downloadUrl",
            "download_url",
            "wm",
            "watermark",
            "url"
        ];

        const isVideoUrl = (value) => {
            if (typeof value !== "string") return false;

            try {
                const parsed = new URL(value);

                return (
                    ["http:", "https:"].includes(parsed.protocol) &&
                    !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value)
                );
            } catch {
                return false;
            }
        };

        function findVideo(obj, depth = 0) {
            if (!obj || depth > 12) return null;

            if (typeof obj === "string") {
                return isVideoUrl(obj) ? obj : null;
            }

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const result = findVideo(item, depth + 1);
                    if (result) return result;
                }

                return null;
            }

            if (typeof obj !== "object") return null;

            // Check preferred video fields first
            for (const key of preferredKeys) {
                if (obj[key] !== undefined && obj[key] !== null) {
                    const result = findVideo(
                        obj[key],
                        depth + 1
                    );

                    if (result) return result;
                }
            }

            // Search nested objects
            for (const [key, value] of Object.entries(obj)) {
                if (
                    !preferredKeys.includes(key) &&
                    typeof value === "object"
                ) {
                    const result = findVideo(
                        value,
                        depth + 1
                    );

                    if (result) return result;
                }
            }

            return null;
        }

        const videoUrl = findVideo(data);

        if (!videoUrl) {
            console.log(
                "VIDEO URL NOT FOUND. API DATA:",
                JSON.stringify(data, null, 2)
            );

            throw new Error(
                data.message ||
                "API Response එකේ Video URL එක හඳුනාගන්න බැරි වුණා. Terminal එකේ API RESPONSE බලන්න."
            );
        }

        console.log("TIKTOK VIDEO URL FOUND:", videoUrl);

        // Download video
        const videoResponse = await axios.get(videoUrl, {
            responseType: "arraybuffer",
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024,
            maxBodyLength: 100 * 1024 * 1024,
            headers: {
                Accept: "video/mp4,video/*,*/*"
            }
        });

        const contentType =
            videoResponse.headers["content-type"] || "";

        if (
            !contentType.includes("video/") &&
            !contentType.includes("octet-stream")
        ) {
            const preview = Buffer.from(
                videoResponse.data
            ).toString("utf8").slice(0, 500);

            throw new Error(
                "ලැබුණු URL එක Video එකක් ලබාදුන්නේ නැහැ: " +
                preview
            );
        }

        const videoBuffer = Buffer.from(
            videoResponse.data
        );

        if (!videoBuffer.length) {
            throw new Error("Downloaded Video එක හිස්!");
        }

        // Send video to WhatsApp
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
                "┃\n" +
                "┃ ⚡ ZANTA-XMD DOWNLOADER\n" +
                "╰━━━━━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

    } catch (error) {
        console.error(
            "\n========== TIKTOK ERROR ==========\n",
            error.response?.data || error.message,
            "\n==================================\n"
        );

        let reason =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message;

        if (error.response?.status === 401) {
            reason = "API Key එක Invalid හෝ Unauthorized.";
        } else if (error.response?.status === 403) {
            reason = "API Access Denied.";
        } else if (error.response?.status === 404) {
            reason = "TikTok API Endpoint එක හමු වුණේ නැහැ.";
        } else if (error.response?.status === 429) {
            reason = "API Request Limit එක ඉක්මවා ඇත.";
        } else if (error.code === "ECONNABORTED") {
            reason = "Request Timeout. නැවත උත්සාහ කරන්න.";
        }

        await reply(
            "╭━━〔 ❌ TIKTOK ERROR 〕━━╮\n" +
            "┃\n" +
            "┃ " + String(reason).slice(0, 700) +
            "\n┃\n" +
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
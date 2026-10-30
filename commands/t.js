const axios = require("axios");

const API_URL = "https://api.chamindu.site/api/v1/tiktok";
const API_KEY = process.env.CHAMINDU_API_KEY;

module.exports = {
    name: "tiktok",
    alias: ["tt", "tiktokdl"],
    desc: "Download TikTok Videos",
    category: "download",
    use: ".tiktok <TikTok Link>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {
            const url = args.join(" ").trim();

            if (!url) {
                return reply(
                    "❌ TikTok Link එකක් ලබාදෙන්න!\n\n" +
                    "උදාහරණය:\n" +
                    ".tiktok https://www.tiktok.com/@user/video/123456"
                );
            }

            if (!url.includes("tiktok.com")) {
                return reply("❌ නිවැරදි TikTok Link එකක් ලබාදෙන්න!");
            }

            if (!API_KEY) {
                return reply("❌ API KEY එක සකස් කර නැහැ!");
            }

            loading = await sock.sendMessage(
                from,
                { text: "⏳ TikTok Video එක Download කරමින් පවතී..." },
                { quoted: msg }
            );

            // API REQUEST
            const response = await axios.get(API_URL, {
                params: {
                    url: url,
                    api_key: API_KEY
                },
                timeout: 60000,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });

            const data = response.data;

            console.log("========== TIKTOK API RESPONSE ==========");
            console.dir(data, { depth: null });

            if (!data || data.success === false || data.status === false) {
                throw new Error(
                    data?.message || "TikTok API Request Failed"
                );
            }

            // FIND VIDEO URL
            const videoKeys = [
                "video",
                "videoUrl",
                "video_url",
                "play",
                "playUrl",
                "play_url",
                "download",
                "downloadUrl",
                "download_url",
                "nowm",
                "noWatermark",
                "no_watermark",
                "hdplay",
                "url"
            ];

            const found = [];

            function extractVideos(obj, depth = 0) {
                if (!obj || depth > 12) return;

                if (typeof obj === "string") {
                    if (/^https?:\/\//i.test(obj)) {
                        found.push({
                            url: obj,
                            score: 0
                        });
                    }
                    return;
                }

                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        extractVideos(item, depth + 1);
                    }
                    return;
                }

                if (typeof obj === "object") {
                    for (const [key, value] of Object.entries(obj)) {

                        if (
                            typeof value === "string" &&
                            /^https?:\/\//i.test(value)
                        ) {
                            const lowerKey = key.toLowerCase();

                            let score = 0;

                            if (videoKeys.includes(lowerKey)) {
                                score += 10;
                            }

                            if (
                                lowerKey.includes("video") ||
                                lowerKey.includes("play") ||
                                lowerKey.includes("download")
                            ) {
                                score += 5;
                            }

                            if (
                                /\.(mp4|m4v|mov|webm)(?:$|\?)/i.test(value)
                            ) {
                                score += 8;
                            }

                            if (
                                lowerKey.includes("music") ||
                                lowerKey.includes("audio") ||
                                lowerKey.includes("cover") ||
                                lowerKey.includes("avatar")
                            ) {
                                score -= 10;
                            }

                            found.push({
                                url: value,
                                score
                            });
                        } else if (typeof value === "object") {
                            extractVideos(value, depth + 1);
                        }
                    }
                }
            }

            extractVideos(data);

            const unique = [
                ...new Map(
                    found
                        .filter(item => item.score > 0)
                        .sort((a, b) => b.score - a.score)
                        .map(item => [item.url, item])
                ).values()
            ];

            if (!unique.length) {
                throw new Error(
                    "API Response එකේ Video URL එක හමු වුණේ නැහැ!"
                );
            }

            const videoUrl = unique[0].url;

            console.log("TIKTOK VIDEO URL:", videoUrl);

            // DOWNLOAD VIDEO
            const videoResponse = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 100 * 1024 * 1024,
                maxBodyLength: 100 * 1024 * 1024,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });

            const videoBuffer = Buffer.from(videoResponse.data);

            const mime = (
                videoResponse.headers["content-type"] || ""
            ).split(";")[0];

            if (!videoBuffer.length) {
                throw new Error("Video File එක හිස්!");
            }

            if (!mime.startsWith("video/")) {
                throw new Error(
                    "API එකෙන් Video File එකක් ලැබුණේ නැහැ. MIME: " + mime
                );
            }

            // SEND VIDEO
            await sock.sendMessage(
                from,
                {
                    video: videoBuffer,
                    mimetype: mime,
                    fileName: "ZANTA-XMD-TIKTOK.mp4",
                    caption:
                        "╭━━〔 🎵 TIKTOK DOWNLOADER 〕━━╮\n" +
                        "┃\n" +
                        "┃ ✅ Download Successful!\n" +
                        "┃ 🎬 Platform : TikTok\n" +
                        "┃ 📥 Status : Completed\n" +
                        "┃\n" +
                        "╰━━━━━━━━━━━━━━━━━━━━╯\n\n" +
                        "> POWERED BY ZANTA-XMD 💫"
                },
                { quoted: msg }
            );

        } catch (error) {

            console.error(
                "TIKTOK DOWNLOAD ERROR:",
                error.message
            );

            console.error(
                "API ERROR DATA:",
                error.response?.data
            );

            await reply(
                "❌ TikTok Download Failed!\n\n" +
                "Error: " + error.message
            );

        } finally {

            if (loading?.key) {
                await sock.sendMessage(
                    from,
                    { delete: loading.key }
                ).catch(() => {});
            }
        }
    }
};
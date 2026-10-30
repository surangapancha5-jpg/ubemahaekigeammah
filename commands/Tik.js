const axios = require("axios");

module.exports = {
    name: "tiktok",
    alias: ["tt", "tiktokdl"],
    desc: "Download TikTok videos",
    category: "download",
    use: ".tiktok <TikTok URL>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {

            // Get TikTok URL
            const tiktokUrl = args.join(" ").trim();

            if (!tiktokUrl) {
                return reply(
                    "╭━━〔 ❌ TIKTOK DOWNLOAD 〕━━╮\n┃\n┃ Please provide a TikTok URL!\n┃\n┃ Example:\n┃ .tiktok https://vt.tiktok.com/xxxx\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            if (!/tiktok\.com/i.test(tiktokUrl)) {
                return reply("❌ Please provide a valid TikTok URL!");
            }

            // Loading Message
            loading = await sock.sendMessage(from, {
                text: "╭━━〔 ⏳ TIKTOK DOWNLOADER 〕━━╮\n┃\n┃ 🔍 Processing TikTok video...\n┃ 📥 Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // API Configuration
            const apiKey = "chama_api_7b9669a740e0cde09142ee6169e8b575";

            const apiUrl = "https://api.chamindu.site/api/v1/tools/savethevideo/download";

            // API Request
            const response = await axios.get(apiUrl, {
                params: {
                    url: tiktokUrl,
                    api_key: apiKey
                },
                timeout: 60000,
                maxContentLength: 10 * 1024 * 1024
            });

            const data = response.data;

            // Extract Video URL
            function findVideoUrl(obj) {

                if (!obj) return null;

                if (typeof obj === "string") {
                    if (/^https?:\/\/.+\.(mp4|mov)(\?.*)?$/i.test(obj)) {
                        return obj;
                    }
                    return null;
                }

                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        const result = findVideoUrl(item);
                        if (result) return result;
                    }
                }

                if (typeof obj === "object") {

                    const priorityKeys = [
                        "video_url",
                        "videoUrl",
                        "download_url",
                        "downloadUrl",
                        "no_watermark",
                        "nowatermark",
                        "hdplay",
                        "play",
                        "url",
                        "video"
                    ];

                    for (const key of priorityKeys) {
                        if (obj[key]) {
                            const result = findVideoUrl(obj[key]);
                            if (result) return result;
                        }
                    }

                    for (const key in obj) {
                        const result = findVideoUrl(obj[key]);
                        if (result) return result;
                    }
                }

                return null;
            }

            const videoUrl = findVideoUrl(data);

            if (!videoUrl) {
                console.log("TIKTOK API RESPONSE:", JSON.stringify(data, null, 2));

                throw new Error("API did not return a valid video URL");
            }

            // Download Video
            const videoResponse = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024
            });

            const videoBuffer = Buffer.from(videoResponse.data);

            if (!videoBuffer.length) {
                throw new Error("Empty video buffer");
            }

            // Send TikTok Video
            await sock.sendMessage(from, {

                video: videoBuffer,

                mimetype: "video/mp4",

                caption: `
╭━━〔 🎬 TIKTOK DOWNLOADER 〕━━╮
┃
┃ ✅ DOWNLOAD SUCCESSFUL
┃
┃ 📥 Video : Downloaded
┃ 🎵 Platform : TikTok
┃ 📦 Quality : Original
┃
╰━━━━━━━━━━━━━━━━━━━━

> © POWERED BY ZANTA-XMD 💫
`

            }, { quoted: msg });

            // Delete Loading Message
            if (loading?.key) {
                await sock.sendMessage(from, {
                    delete: loading.key
                });
            }

        } catch (error) {

            console.error("TIKTOK ERROR:", error.response?.data || error.message);

            if (loading?.key) {
                try {
                    await sock.sendMessage(from, {
                        delete: loading.key
                    });
                } catch (_) {}
            }

            await reply(
                "╭━━〔 ❌ TIKTOK ERROR 〕━━╮\n┃\n┃ Video download failed!\n┃ API එකෙන් Video URL එකක් ලබාගැනීමට නොහැකි වුණා.\n┃\n┃ කරුණාකර නැවත උත්සාහ කරන්න.\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );

        }
    }
};
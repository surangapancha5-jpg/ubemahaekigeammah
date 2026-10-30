const axios = require("axios");

module.exports = {
    name: "tiktok",
    alias: ["tt", "ttsearch"],
    desc: "TikTok Video Search & Download",
    category: "download",
    use: ".tiktok <search>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {

            const query = args.join(" ").trim();

            if (!query) {
                return reply(
                    "╭━━〔 ❌ TIKTOK DOWNLOADER 〕━━╮\n┃\n┃ Please enter a search query!\n┃\n┃ Example:\n┃ .tiktok mrbeast\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            // Loading Message
            loading = await sock.sendMessage(from, {
                text: "╭━━〔 ⏳ TIKTOK SEARCH 〕━━╮\n┃\n┃ 🔍 Searching TikTok...\n┃ 📥 Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // API Configuration
            const apiUrl = "https://api.chamindu.site/api/v1/tiktok";

            const response = await axios.get(apiUrl, {
                params: {
                    q: query,
                    api_key: "chama_api_7b9669a740e0cde09142ee6169e8b575"
                },
                timeout: 60000
            });

            const data = response.data;

            console.log(
                "TIKTOK API RESPONSE:",
                JSON.stringify(data, null, 2)
            );

            // Find Videos
            function findVideos(obj) {

                if (!obj) return null;

                if (Array.isArray(obj)) {
                    return obj.length ? obj : null;
                }

                if (typeof obj === "object") {

                    const keys = [
                        "videos",
                        "video_list",
                        "aweme_list",
                        "items",
                        "results",
                        "result",
                        "data"
                    ];

                    for (const key of keys) {

                        if (obj[key]) {

                            const result = findVideos(obj[key]);

                            if (result) return result;
                        }
                    }
                }

                return null;
            }

            const videos = findVideos(data);

            if (!videos || !videos.length) {
                throw new Error("No TikTok videos found");
            }

            // Select First Video
            const video = videos[0];

            // Find Video URL
            function getVideoUrl(obj) {

                if (!obj || typeof obj !== "object") return null;

                const keys = [
                    "play",
                    "play_addr",
                    "video_url",
                    "videoUrl",
                    "download_url",
                    "downloadUrl",
                    "wmplay",
                    "url",
                    "src"
                ];

                for (const key of keys) {

                    const value = obj[key];

                    if (typeof value === "string" &&
                        /^https?:\/\//i.test(value)) {
                        return value;
                    }

                    if (typeof value === "object" && value !== null) {

                        const nested = getVideoUrl(value);

                        if (nested) return nested;
                    }
                }

                return null;
            }

            const videoUrl = getVideoUrl(video);

            if (!videoUrl) {
                throw new Error("Video URL not found");
            }

            // Download Video
            const videoResponse = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });

            const videoBuffer = Buffer.from(videoResponse.data);

            if (!videoBuffer.length) {
                throw new Error("Empty video buffer");
            }

            // Send Video
            await sock.sendMessage(from, {

                video: videoBuffer,

                mimetype: "video/mp4",

                caption: `
╭━━〔 🎵 ZANTA TIKTOK 〕━━╮
┃
┃ ✅ DOWNLOAD SUCCESSFUL
┃
┃ 🔍 SEARCH : ${query}
┃ 🎬 PLATFORM : TIKTOK
┃ 📥 STATUS : COMPLETED
┃
╰━━━━━━━━━━━━━━━━━━━━

> © POWERED BY ZANTA-XMD 💫
`

            }, { quoted: msg });

            // Delete Loading
            if (loading?.key) {

                await sock.sendMessage(from, {
                    delete: loading.key
                });

            }

        } catch (error) {

            console.error(
                "TIKTOK ERROR:",
                error.response?.data || error.message
            );

            if (loading?.key) {

                try {

                    await sock.sendMessage(from, {
                        delete: loading.key
                    });

                } catch (_) {}

            }

            await reply(
                "╭━━〔 ❌ TIKTOK ERROR 〕━━╮\n┃\n┃ TikTok download failed!\n┃\n┃ Error: " + error.message + "\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );

        }
    }
};
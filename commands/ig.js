const axios = require("axios");

module.exports = {
    name: "ig",
    alias: ["instagram", "igdl", "reels"],
    desc: "Download Instagram Reels",
    category: "download",
    use: ".ig <Instagram URL>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {

            // Instagram URL
            const igUrl = args.join(" ").trim();

            if (!igUrl) {
                return reply(
                    "╭━━〔 ❌ INSTAGRAM DOWNLOADER 〕━━╮\n┃\n┃ Please provide an Instagram URL!\n┃\n┃ Example:\n┃ .ig https://www.instagram.com/reel/xxxx/\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            if (!/instagram\.com/i.test(igUrl)) {
                return reply("❌ Please provide a valid Instagram URL!");
            }

            // Loading Message
            loading = await sock.sendMessage(from, {
                text: "╭━━〔 ⏳ INSTAGRAM DOWNLOADER 〕━━╮\n┃\n┃ 🔍 Processing Instagram Reel...\n┃ 📥 Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // API Configuration
            const apiKey = "chama_api_7b9669a740e0cde09142ee6169e8b575";

            const apiUrl = "https://api.chamindu.site/api/v1/media/reels";

            // API Request
            const response = await axios.get(apiUrl, {
                params: {
                    url: igUrl,
                    api_key: apiKey
                },
                timeout: 60000
            });

            const data = response.data;

            console.log("INSTAGRAM API RESPONSE:", JSON.stringify(data, null, 2));

            // Find Video URL
            function findVideoUrl(obj) {

                if (!obj) return null;

                if (typeof obj === "string") {
                    if (/^https?:\/\//i.test(obj) &&
                        (/\.(mp4|mov)(\?|$)/i.test(obj) ||
                        /video|reel|instagram/i.test(obj))) {
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

                    const keys = [
                        "video_url",
                        "videoUrl",
                        "download_url",
                        "downloadUrl",
                        "video",
                        "url",
                        "src",
                        "media",
                        "hd"
                    ];

                    for (const key of keys) {
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
                throw new Error("Video URL not found in API response");
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

            // Send Video
            await sock.sendMessage(from, {

                video: videoBuffer,
                mimetype: "video/mp4",

                caption: `
╭━━〔 📸 INSTAGRAM DOWNLOADER 〕━━╮
┃
┃ ✅ DOWNLOAD SUCCESSFUL
┃
┃ ◈ PLATFORM : INSTAGRAM
┃ ◈ TYPE : REELS
┃ ◈ STATUS : COMPLETED
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
                "INSTAGRAM ERROR:",
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
                "╭━━〔 ❌ INSTAGRAM ERROR 〕━━╮\n┃\n┃ Instagram download failed!\n┃ API එකෙන් Video URL එකක් ලැබුණේ නැහැ.\n┃\n┃ කරුණාකර නැවත උත්සාහ කරන්න.\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );

        }
    }
};
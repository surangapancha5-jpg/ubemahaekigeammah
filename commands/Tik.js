const axios = require("axios");

module.exports = {
    name: "tiktok",
    alias: ["tt", "ttsearch"],
    desc: "Search TikTok videos",
    category: "download",
    use: ".tiktok <search>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {

            const apiUrl = "https://api.chamindu.site/api/v1/tiktok";

const response = await axios.get(apiUrl, {
    params: {
        q: query,
        api_key: "chama_api_7b9669a740e0cde09142ee6169e8b575"
    },
    timeout: 60000
});
            const data = response.data;

            console.log("TIKTOK RESPONSE:", JSON.stringify(data, null, 2));

            const videos = data?.result?.videos ||
                           data?.data?.videos ||
                           data?.videos ||
                           data?.result ||
                           data?.data;

            if (!videos || !Array.isArray(videos) || !videos.length) {
                throw new Error("No videos found");
            }

            const video = videos[0];

            const videoUrl = video.video_url ||
                             video.download_url ||
                             video.play ||
                             video.video ||
                             video.url;

            if (!videoUrl || typeof videoUrl !== "string") {
                throw new Error("Video URL not found");
            }

            const videoResponse = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024
            });

            const buffer = Buffer.from(videoResponse.data);

            await sock.sendMessage(from, {
                video: buffer,
                mimetype: "video/mp4",
                caption: `
╭━━〔 🎵 TIKTOK SEARCH 〕━━╮
┃
┃ ✅ VIDEO FOUND
┃
┃ 🔎 SEARCH : ${query}
┃ 📥 STATUS : DOWNLOADED
┃
╰━━━━━━━━━━━━━━━━━━━━

> © POWERED BY ZANTA-XMD 💫
`
            }, { quoted: msg });

            if (loading?.key) {
                await sock.sendMessage(from, {
                    delete: loading.key
                });
            }

        } catch (error) {

            console.log("TIKTOK ERROR:", error.response?.data || error.message);

            if (loading?.key) {
                try {
                    await sock.sendMessage(from, {
                        delete: loading.key
                    });
                } catch (_) {}
            }

            await reply(
                "❌ TikTok Search Failed!\n\nAPI response එකේ video download URL එක නොමැති විය හැකියි."
            );
        }
    }
};
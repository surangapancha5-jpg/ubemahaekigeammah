const axios = require("axios");

const API_URL = "https://api.chamindu.site/api/v1/tiktok";
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

module.exports = {
    name: "tiktok",
    alias: ["tt", "ttsearch"],
    desc: "TikTok Video Search",
    category: "search",
    use: ".tiktok <query>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {
            const query = args.join(" ").trim();

            if (!query) {
                return reply(
                    "╭━━〔 🎵 TIKTOK SEARCH 〕━━╮\n" +
                    "┃\n" +
                    "┃ ❌ Search එකක් ලබාදෙන්න!\n" +
                    "┃\n" +
                    "┃ උදාහරණය:\n" +
                    "┃ .tiktok mrbeast\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯"
                );
            }

            loading = await sock.sendMessage(
                from,
                {
                    text: "⏳ TikTok Search කරමින් පවතී...\n\n🔍 Search: " + query
                },
                { quoted: msg }
            );

            // API REQUEST
            const response = await axios.get(API_URL, {
                params: {
                    q: query,
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

            if (!data) {
                throw new Error("API Response එකක් ලැබුණේ නැහැ!");
            }

            if (
                data.success === false ||
                data.status === false
            ) {
                throw new Error(
                    data.message || "TikTok API Failed"
                );
            }

            // EXTRACT RESULTS
            let results =
                data.results ||
                data.result ||
                data.data?.results ||
                data.data?.result ||
                data.data?.videos ||
                data.videos ||
                data.data;

            if (!Array.isArray(results)) {
                if (
                    results &&
                    typeof results === "object"
                ) {
                    results = Object.values(results);
                } else {
                    results = [];
                }
            }

            if (!results.length) {
                throw new Error("Search Results හමු වුණේ නැහැ!");
            }

            // CREATE MESSAGE
            let message =
                "╭━━〔 🎵 TIKTOK SEARCH 〕━━╮\n" +
                "┃\n" +
                "┃ 🔍 Search : " + query + "\n" +
                "┃ 📊 Results : " + results.length + "\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯\n\n";

            const maxResults = Math.min(results.length, 10);

            for (let i = 0; i < maxResults; i++) {

                const item = results[i];

                const title =
                    item.title ||
                    item.desc ||
                    item.description ||
                    item.video_description ||
                    "No Title";

                const author =
                    item.author?.nickname ||
                    item.author?.name ||
                    item.author?.unique_id ||
                    item.nickname ||
                    item.username ||
                    (typeof item.author === "string"
                        ? item.author
                        : "Unknown");

                const videoUrl =
                    item.video_url ||
                    item.videoUrl ||
                    item.play ||
                    item.url ||
                    item.share_url ||
                    item.shareUrl ||
                    item.link ||
                    "";

                const views =
                    item.play_count ||
                    item.views ||
                    item.view_count ||
                    "Unknown";

                message +=
                    `╭━━〔 🎬 VIDEO ${i + 1} 〕━━╮\n` +
                    `┃ 📌 Title: ${title}\n` +
                    `┃ 👤 Author: ${author}\n` +
                    `┃ 👁 Views: ${views}\n` +
                    `┃ 🔗 Link: ${videoUrl || "Unavailable"}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            message += "> POWERED BY ZANTA-XMD 💫";

            // SEND RESULTS
            await sock.sendMessage(
                from,
                {
                    text: message
                },
                { quoted: msg }
            );

        } catch (error) {

            console.error("TIKTOK ERROR:", error.message);

            if (error.response) {
                console.log("API STATUS:", error.response.status);
                console.dir(error.response.data, { depth: null });
            }

            await reply(
                "╭━━〔 ❌ TIKTOK ERROR 〕━━╮\n" +
                "┃\n" +
                "┃ TikTok Search Failed!\n" +
                "┃\n" +
                "┃ Error: " + error.message + "\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );

        } finally {

            if (loading?.key) {
                await sock.sendMessage(
                    from,
                    {
                        delete: loading.key
                    }
                ).catch(() => {});
            }
        }
    }
};
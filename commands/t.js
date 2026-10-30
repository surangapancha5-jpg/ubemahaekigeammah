const axios = require("axios");

const API_URL = "https://api.chamindu.site/api/v1/tiktok";
const API_KEY = chama_api_7b9669a740e0cde09142ee6169e8b575"";

module.exports = {
    name: "tiktok",
    alias: ["tt", "ttsearch"],
    desc: "TikTok Video Search",
    category: "search",
    use: ".tiktok <query>",

    async execute(sock, msg, args, from, { reply }) {
        let loading;

        try {
            // GET SEARCH QUERY
            const query = args.join(" ").trim();

            if (!query) {
                return reply(
                    "╭━━〔 🎵 TIKTOK SEARCH 〕━━╮\n" +
                    "┃\n" +
                    "┃ ❌ Search එකක් ලබාදෙන්න!\n" +
                    "┃\n" +
                    "┃ Example:\n" +
                    "┃ .tiktok mrbeast\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯"
                );
            }

            if (!API_KEY || API_KEY === "YOUR_NEW_API_KEY") {
                return reply("❌ API KEY එක සකස් කරන්න!");
            }

            // LOADING
            loading = await sock.sendMessage(
                from,
                {
                    text: `⏳ TikTok Search කරමින් පවතී...\n\n🔎 Search: ${query}`
                },
                { quoted: msg }
            );

            // API REQUEST
            const response = await axios.get(API_URL, {
                params: {
                    q: query,
                    api_key: API_KEY
                },
                timeout: 90000,
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json"
                },
                maxContentLength: 20 * 1024 * 1024
            });

            const data = response.data;

            console.log("========== TIKTOK API RESPONSE ==========");
            console.dir(data, { depth: null });

            if (!data) {
                throw new Error("Empty API Response");
            }

            if (
                data.success === false ||
                data.status === false ||
                data.error
            ) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "TikTok API Failed"
                );
            }

            // FIND RESULTS
            function findResults(obj, depth = 0) {
                if (!obj || depth > 8) return [];

                if (Array.isArray(obj)) {
                    return obj;
                }

                if (typeof obj !== "object") {
                    return [];
                }

                const keys = [
                    "results",
                    "result",
                    "videos",
                    "video_list",
                    "aweme_list",
                    "items",
                    "data"
                ];

                for (const key of keys) {
                    if (obj[key] !== undefined) {
                        const result = findResults(
                            obj[key],
                            depth + 1
                        );

                        if (result.length) return result;
                    }
                }

                for (const value of Object.values(obj)) {
                    if (Array.isArray(value)) return value;

                    if (value && typeof value === "object") {
                        const result = findResults(
                            value,
                            depth + 1
                        );

                        if (result.length) return result;
                    }
                }

                return [];
            }

            const results = findResults(data);

            if (!results.length) {
                throw new Error(
                    "No Results Found. Check API Response in Heroku Logs."
                );
            }

            // FORMAT TEXT
            function getText(value, fallback = "Unknown") {
                if (typeof value === "string") return value;
                if (typeof value === "number") return String(value);

                if (value && typeof value === "object") {
                    return (
                        value.nickname ||
                        value.name ||
                        value.unique_id ||
                        value.username ||
                        fallback
                    );
                }

                return fallback;
            }

            function getVideoUrl(item) {
                const keys = [
                    "video_url",
                    "videoUrl",
                    "play",
                    "play_url",
                    "download_url",
                    "downloadUrl",
                    "share_url",
                    "shareUrl",
                    "url",
                    "link"
                ];

                for (const key of keys) {
                    const value = item[key];

                    if (
                        typeof value === "string" &&
                        /^https?:\/\//i.test(value)
                    ) {
                        return value;
                    }
                }

                const video = item.video;

                if (video && typeof video === "object") {
                    return (
                        video.play_addr?.url_list?.[0] ||
                        video.playAddr?.urlList?.[0] ||
                        video.url ||
                        ""
                    );
                }

                return "";
            }

            let message =
                "╭━━〔 🎵 TIKTOK SEARCH 〕━━╮\n" +
                "┃\n" +
                `┃ 🔎 Search : ${query}\n` +
                `┃ 📊 Results : ${results.length}\n` +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯\n\n";

            const maxResults = Math.min(results.length, 10);

            for (let i = 0; i < maxResults; i++) {
                const item = results[i];

                if (!item || typeof item !== "object") continue;

                const title = getText(
                    item.title ||
                    item.desc ||
                    item.description ||
                    item.video_description
                );

                const author = getText(
                    item.author ||
                    item.nickname ||
                    item.username ||
                    item.user
                );

                const videoUrl = getVideoUrl(item);

                const views = getText(
                    item.play_count ||
                    item.views ||
                    item.view_count,
                    "Unknown"
                );

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
                { text: message },
                { quoted: msg }
            );

        } catch (error) {
            console.error("========== TIKTOK ERROR ==========");
            console.error(error.stack || error.message);

            if (error.response) {
                console.error("STATUS:", error.response.status);
                console.dir(error.response.data, { depth: null });
            }

            let errorMessage = error.message || "Unknown Error";

            if (error.code === "ECONNABORTED") {
                errorMessage = "API Timeout. Please try again.";
            }

            if (error.response?.status === 401 ||
                error.response?.status === 403) {
                errorMessage = "API Key Invalid or Access Denied.";
            }

            if (error.response?.status === 429) {
                errorMessage = "Too Many Requests. Try Again Later.";
            }

            await reply(
                "╭━━〔 ❌ TIKTOK ERROR 〕━━╮\n" +
                "┃\n" +
                "┃ TikTok Search Failed!\n" +
                "┃\n" +
                `┃ Error: ${errorMessage}\n` +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            ).catch(() => {});

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
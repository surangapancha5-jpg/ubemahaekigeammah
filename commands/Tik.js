const axios = require("axios");

module.exports = {
    name: "cartoon",
    alias: ["cartoons", "pupilvideo"],
    desc: "Search Cartoon Videos",
    category: "download",
    use: ".cartoon <name>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {

            const query = args.join(" ").trim();

            if (!query) {
                return reply(
                    "╭━━〔 🎬 CARTOON SEARCH 〕━━╮\n┃\n┃ Please enter cartoon name!\n┃\n┃ Example:\n┃ .cartoon Ben 10\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            // Loading Message
            loading = await sock.sendMessage(from, {
                text: "╭━━〔 ⏳ CARTOON SEARCH 〕━━╮\n┃\n┃ 🔍 Searching cartoons...\n┃ 📥 Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // API Configuration
            const apiUrl = "https://api.chamindu.site/api/v1/cartoons/pupilvideo/search";

            const response = await axios.get(apiUrl, {
                params: {
                    q: query,
                    api_key: "chama_api_7b9669a740e0cde09142ee6169e8b575"
                },
                timeout: 60000
            });

            const data = response.data;

            console.log(
                "CARTOON API RESPONSE:",
                JSON.stringify(data, null, 2)
            );

            // Extract Results
            function findResults(obj) {

                if (!obj) return null;

                if (Array.isArray(obj)) {
                    return obj.length ? obj : null;
                }

                if (typeof obj === "object") {

                    const keys = [
                        "results",
                        "videos",
                        "items",
                        "cartoons",
                        "data",
                        "result"
                    ];

                    for (const key of keys) {

                        if (obj[key]) {

                            const result = findResults(obj[key]);

                            if (result) return result;
                        }
                    }
                }

                return null;
            }

            const results = findResults(data);

            if (!results || !results.length) {
                throw new Error("No cartoons found");
            }

            // Build Result Message
            let text = `╭━━〔 🎬 CARTOON RESULTS 〕━━╮\n`;
            text += `┃\n`;
            text += `┃ 🔎 SEARCH : ${query}\n`;
            text += `┃ 📺 RESULTS : ${results.length}\n`;
            text += `┃\n`;

            results.slice(0, 10).forEach((item, index) => {

                const title =
                    item.title ||
                    item.name ||
                    item.video_title ||
                    "Unknown Cartoon";

                const url =
                    item.url ||
                    item.link ||
                    item.video_url ||
                    item.watch_url ||
                    "";

                text += `┃ ${index + 1}. ${title}\n`;

                if (url) {
                    text += `┃ 🔗 ${url}\n`;
                }

                text += `┃\n`;
            });

            text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
            text += `> © POWERED BY ZANTA-XMD 💫`;

            // Send Results
            await sock.sendMessage(from, {
                text: text
            }, { quoted: msg });

            // Delete Loading
            if (loading?.key) {
                await sock.sendMessage(from, {
                    delete: loading.key
                });
            }

        } catch (error) {

            console.error(
                "CARTOON ERROR:",
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
                "╭━━〔 ❌ CARTOON ERROR 〕━━╮\n┃\n┃ Cartoon search failed!\n┃ API response එක පරීක්ෂා කරන්න.\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );
        }
    }
};
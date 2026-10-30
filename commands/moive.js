const axios = require("axios");

module.exports = {
    name: "movie",
    alias: ["movies", "film"],
    desc: "Search and download authorized videos",
    category: "download",
    use: ".movie <name>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {
            const query = args.join(" ").trim();

            if (!query) {
                return reply(
                    "🎬 MOVIE SEARCH\n\nExample:\n.movie My Video"
                );
            }

            loading = await sock.sendMessage(from, {
                text: "🔍 Searching videos...\nPlease wait!"
            }, { quoted: msg });

            const apiUrl =
                "https://api.chamindu.site/api/v1/movies/sinhalasub/tv/search?q=House%20of%20the%20Dragon&api_key=chama_api_7b9669a740e0cde09142ee6169e8b575";

            const response = await axios.get(apiUrl, {
                params: {
                    q: query
                },
                timeout: 60000
            });

            const data = response.data;

            console.log(
                "MOVIE RESPONSE:",
                JSON.stringify(data, null, 2)
            );

            function findResults(obj) {
                if (!obj) return null;

                if (Array.isArray(obj)) {
                    return obj.length ? obj : null;
                }

                if (typeof obj === "object") {
                    for (const key of [
                        "results",
                        "items",
                        "videos",
                        "data",
                        "result"
                    ]) {
                        if (obj[key]) {
                            const result = findResults(obj[key]);
                            if (result) return result;
                        }
                    }
                }

                return null;
            }

            const results = findResults(data);

            if (!results) {
                throw new Error("No results found");
            }

            let text = `🎬 VIDEO SEARCH RESULTS\n\n`;
            text += `🔎 Search: ${query}\n\n`;

            results.slice(0, 10).forEach((item, index) => {
                const title = item.title || item.name || "Unknown";
                const link = item.url || item.link || item.watch_url || "";

                text += `${index + 1}. ${title}\n`;
                if (link) text += `🔗 ${link}\n`;
                text += "\n";
            });

            text += "> POWERED BY ZANTA-XMD";

            await sock.sendMessage(from, {
                text
            }, { quoted: msg });

            if (loading?.key) {
                await sock.sendMessage(from, {
                    delete: loading.key
                });
            }

        } catch (error) {

            console.error("MOVIE ERROR:", error.message);

            if (loading?.key) {
                try {
                    await sock.sendMessage(from, {
                        delete: loading.key
                    });
                } catch (_) {}
            }

            await reply("❌ Video search failed!");
        }
    }
};
const axios = require("axios");

module.exports = {
    name: "movie1",
    alias: ["moviedl", "film"],
    desc: "Download Movies and TV Episodes",
    category: "download",
    use: ".movie <Sinhalasub URL>",

    async execute(sock, msg, args, from, { reply }) {

        let loading;

        try {

            const movieUrl = args.join(" ").trim();

            if (!movieUrl) {
                return reply(
                    "╭━━〔 🎬 MOVIE DOWNLOADER 〕━━╮\n┃\n┃ Please provide a Movie URL!\n┃\n┃ Example:\n┃ .movie https://sinhalasub.lk/episodes/house-of-the-dragon-s01e01/\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            if (!/sinhalasub\.lk/i.test(movieUrl)) {
                return reply("❌ Please provide a valid Sinhalasub URL!");
            }

            // Loading Message
            loading = await sock.sendMessage(from, {
                text: "╭━━〔 ⏳ MOVIE DOWNLOADER 〕━━╮\n┃\n┃ 🔍 Processing Movie...\n┃ 📥 Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // API Configuration
            const apiUrl = "https://api.chamindu.site/api/v1/movies/sinhalasub/tv/dl";

            const response = await axios.get(apiUrl, {
                params: {
                    q: movieUrl,
                    api_key: "chama_api_7b9669a740e0cde09142ee6169e8b575"
                },
                timeout: 60000
            });

            const data = response.data;

            console.log(
                "MOVIE API RESPONSE:",
                JSON.stringify(data, null, 2)
            );

            // Extract Download URL
            function findUrl(obj) {

                if (!obj) return null;

                if (typeof obj === "string") {

                    if (/^https?:\/\//i.test(obj)) {
                        return obj;
                    }

                    return null;
                }

                if (Array.isArray(obj)) {

                    for (const item of obj) {
                        const result = findUrl(item);
                        if (result) return result;
                    }

                }

                if (typeof obj === "object") {

                    const priorityKeys = [
                        "download_url",
                        "downloadUrl",
                        "video_url",
                        "videoUrl",
                        "file_url",
                        "stream_url",
                        "url",
                        "link",
                        "download",
                        "video"
                    ];

                    for (const key of priorityKeys) {

                        if (obj[key]) {
                            const result = findUrl(obj[key]);
                            if (result) return result;
                        }

                    }

                    for (const key in obj) {

                        const result = findUrl(obj[key]);

                        if (result) return result;

                    }
                }

                return null;
            }

            const downloadUrl = findUrl(data);

            if (!downloadUrl) {
                throw new Error("Download URL not found");
            }

            // Send Download Link
            await sock.sendMessage(from, {

                text: `
╭━━〔 🎬 MOVIE DOWNLOADER 〕━━╮
┃
┃ ✅ DOWNLOAD LINK FOUND
┃
┃ 🎥 PLATFORM : SINHALASUB
┃ 📥 STATUS : SUCCESS
┃
┃ 🔗 DOWNLOAD LINK:
┃ ${downloadUrl}
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
                "MOVIE ERROR:",
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
                "╭━━〔 ❌ MOVIE ERROR 〕━━╮\n┃\n┃ Movie download failed!\n┃ API එකෙන් Download URL එකක් ලැබුණේ නැහැ.\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );

        }
    }
};
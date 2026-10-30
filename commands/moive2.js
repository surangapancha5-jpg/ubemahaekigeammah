const axios = require("axios");

module.exports = {
    name: "moviedl",
    alias: ["movie", "film"],
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

            if (!/^https?:\/\/(www\.)?sinhalasub\.lk\//i.test(movieUrl)) {
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

            // Find Download URL
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
                        "direct_link",
                        "directLink",
                        "video_url",
                        "videoUrl",
                        "file_url",
                        "fileUrl",
                        "stream_url",
                        "streamUrl",
                        "download",
                        "video",
                        "url",
                        "link"
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
                throw new Error("Download URL not found in API response");
            }

            console.log("MOVIE DOWNLOAD URL:", downloadUrl);

            // Download File
            const fileResponse = await axios.get(downloadUrl, {
                responseType: "arraybuffer",
                timeout: 180000,
                maxContentLength: 100 * 1024 * 1024,
                maxBodyLength: 100 * 1024 * 1024,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });

            const buffer = Buffer.from(fileResponse.data);

            if (!buffer.length) {
                throw new Error("Downloaded file is empty");
            }

            const contentType =
                fileResponse.headers["content-type"] || "";

            if (
                !contentType.includes("video/") &&
                !contentType.includes("application/octet-stream")
            ) {
                throw new Error(
                    "API did not return a direct video file. Content-Type: " +
                    contentType
                );
            }

            // Send Document
            await sock.sendMessage(from, {
                document: buffer,
                mimetype: "video/mp4",
                fileName: "ZANTA-XMD-MOVIE.mp4",
                caption:
                    "╭━━〔 🎬 MOVIE DOWNLOADER 〕━━╮\n┃\n┃ ✅ DOWNLOAD SUCCESSFUL\n┃ 📥 FILE TYPE : DOCUMENT\n┃ 🎥 PLATFORM : SINHALASUB\n┃\n╰━━━━━━━━━━━━━━━━━━━━\n\n> POWERED BY ZANTA-XMD 💫"
            }, { quoted: msg });

            console.log("MOVIE DOCUMENT SENT SUCCESSFULLY");

        } catch (error) {
            console.error(
                "MOVIE ERROR:",
                error.response?.data || error.message
            );

            await reply(
                "╭━━〔 ❌ MOVIE ERROR 〕━━╮\n┃\n┃ Movie download failed!\n┃\n┃ Possible reasons:\n┃ • API Error\n┃ • Invalid Download URL\n┃ • File too large\n┃ • Video link unavailable\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );

        } finally {
            // Delete Loading Message
            if (loading?.key) {
                try {
                    await sock.sendMessage(from, {
                        delete: loading.key
                    });
                } catch (e) {
                    console.log("Loading delete error:", e.message);
                }
            }
        }
    }
};
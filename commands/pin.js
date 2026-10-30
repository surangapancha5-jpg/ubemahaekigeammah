const axios = require("axios");

const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

module.exports = {
    name: "pin",
    alias: ["pinterest", "pinterestsearch"],
    desc: "Pinterest Image Search",
    category: "search",
    use: ".pin <query>",

    async execute(sock, msg, args, from, { reply }) {
        let loading;

        try {
            const query = args.join(" ").trim();

            if (!query) {
                return reply(
                    "╭━━〔 📌 PINTEREST SEARCH 〕━━╮\n" +
                    "┃\n" +
                    "┃ Please enter search name!\n" +
                    "┃\n" +
                    "┃ Example:\n" +
                    "┃ .pin Sultan Suleiman\n" +
                    "┃ .pin Anime Wallpaper\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            loading = await sock.sendMessage(from, {
                text:
                    "╭━━〔 ⏳ PINTEREST SEARCH 〕━━╮\n" +
                    "┃\n" +
                    "┃ 🔍 Searching Pinterest...\n" +
                    "┃ 📥 Please wait...\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // PINTEREST API
            const response = await axios.get(
                "https://api.chamindu.site/api/v1/media/pinterest/search",
                {
                    params: {
                        q: query,
                        api_key: API_KEY
                    },
                    timeout: 60000,
                    headers: {
                        "User-Agent": "Mozilla/5.0"
                    }
                }
            );

            const data = response.data;

            console.log("========== PINTEREST API RESPONSE ==========");
            console.dir(data, { depth: null });
            console.log("============================================");

            if (
                !data ||
                data.success === false ||
                data.status === false
            ) {
                throw new Error(
                    data?.message || "Pinterest API failed"
                );
            }

            // FIND IMAGE URLS
            function extractImages(obj, results = [], seen = new Set()) {
                if (!obj || results.length >= 30) return results;

                if (typeof obj === "string") {
                    if (/^https?:\/\/.+/i.test(obj)) {
                        if (
                            /\.(jpg|jpeg|png|webp|gif)(?:$|\?)/i.test(obj) &&
                            !seen.has(obj)
                        ) {
                            seen.add(obj);
                            results.push(obj);
                        }
                    }

                    return results;
                }

                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        extractImages(item, results, seen);
                    }

                    return results;
                }

                if (typeof obj === "object") {
                    const imageKeys = [
                        "image",
                        "imageUrl",
                        "image_url",
                        "img",
                        "imgUrl",
                        "img_url",
                        "original",
                        "originalUrl",
                        "thumbnail",
                        "thumbnailUrl",
                        "thumbnail_url",
                        "src",
                        "photo",
                        "photoUrl",
                        "url"
                    ];

                    for (const key of imageKeys) {
                        const value = obj[key];

                        if (
                            typeof value === "string" &&
                            /^https?:\/\//i.test(value)
                        ) {
                            if (!seen.has(value)) {
                                seen.add(value);
                                results.push(value);
                            }
                        }
                    }

                    for (const value of Object.values(obj)) {
                        if (results.length >= 30) break;

                        if (typeof value === "object") {
                            extractImages(value, results, seen);
                        }
                    }
                }

                return results;
            }

            const images = extractImages(data);

            if (!images.length) {
                throw new Error(
                    "No Pinterest images found in API response"
                );
            }

            const selectedImages = images.slice(0, 5);

            await sock.sendMessage(from, {
                text:
                    "╭━━〔 📌 PINTEREST SEARCH 〕━━╮\n" +
                    "┃\n" +
                    `┃ 🔍 QUERY : ${query}\n` +
                    `┃ 🖼️ FOUND : ${images.length}\n` +
                    `┃ 📥 SENDING : ${selectedImages.length}\n` +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // SEND PINTEREST IMAGES
            let sent = 0;

            for (let i = 0; i < selectedImages.length; i++) {
                const imageUrl = selectedImages[i];

                try {
                    const imageResponse = await axios.get(imageUrl, {
                        responseType: "arraybuffer",
                        timeout: 45000,
                        maxContentLength: 15 * 1024 * 1024,
                        headers: {
                            "User-Agent": "Mozilla/5.0"
                        }
                    });

                    const buffer = Buffer.from(imageResponse.data);

                    const mime = (
                        imageResponse.headers["content-type"] || ""
                    ).split(";")[0];

                    if (
                        !buffer.length ||
                        !mime.startsWith("image/")
                    ) {
                        continue;
                    }

                    await sock.sendMessage(from, {
                        image: buffer,
                        mimetype: mime,
                        caption:
                            `📌 PINTEREST IMAGE ${i + 1}/${selectedImages.length}\n` +
                            `🔍 SEARCH : ${query}\n\n` +
                            "> POWERED BY ZANTA-XMD 💫"
                    }, { quoted: msg });

                    sent++;

                } catch (imageError) {
                    console.log(
                        "PINTEREST IMAGE ERROR:",
                        imageError.message
                    );
                }
            }

            if (!sent) {
                throw new Error(
                    "Images found but could not be downloaded"
                );
            }

        } catch (error) {
            console.error("\n========== PINTEREST ERROR ==========");
            console.error("Message:", error.message);
            console.error("Status:", error.response?.status);
            console.error("Response:", error.response?.data);
            console.error("====================================");

            await reply(
                "╭━━〔 ❌ PINTEREST ERROR 〕━━╮\n" +
                "┃\n" +
                "┃ Pinterest search failed!\n" +
                "┃\n" +
                `┃ ERROR: ${String(error.message).slice(0, 500)}\n` +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━"
            );

        } finally {
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
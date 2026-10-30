const axios = require("axios");

const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

module.exports = {
    name: "img",
    alias: ["image", "images", "imgsearch"],
    desc: "Search Images",
    category: "search",
    use: ".img <query>",

    async execute(sock, msg, args, from, { reply }) {
        let loading;

        try {
            const query = args.join(" ").trim();

            if (!query) {
                return reply(
                    "╭━━〔 🖼️ IMAGE SEARCH 〕━━╮\n" +
                    "┃\n" +
                    "┃ Please enter image name!\n" +
                    "┃\n" +
                    "┃ Example:\n" +
                    "┃ .img Cat\n" +
                    "┃ .img Anime\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            loading = await sock.sendMessage(from, {
                text: "╭━━〔 ⏳ IMAGE SEARCH 〕━━╮\n┃\n┃ 🔍 Searching images...\n┃ 📥 Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // API REQUEST
            const response = await axios.get(
                "https://api.chamindu.site/api/v1/search/image",
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

            console.log("========== IMAGE API RESPONSE ==========");
            console.log(JSON.stringify(data, null, 2));
            console.log("========================================");

            if (!data) {
                throw new Error("Empty API response");
            }

            if (data.success === false || data.status === false) {
                throw new Error(data.message || "API request failed");
            }

            // IMAGE URL VALIDATION
            function isImageUrl(url) {
                if (typeof url !== "string") return false;

                try {
                    const parsed = new URL(url);

                    return (
                        ["http:", "https:"].includes(parsed.protocol) &&
                        !/\.(html?|json)(?:$|\?)/i.test(parsed.pathname)
                    );
                } catch {
                    return false;
                }
            }

            // EXTRACT IMAGE URL
            function extractImages(obj, results = [], seen = new Set()) {
                if (!obj || results.length >= 30) return results;

                if (typeof obj === "string") {
                    if (
                        isImageUrl(obj) &&
                        /\.(jpg|jpeg|png|webp|gif)(?:$|\?)/i.test(obj)
                    ) {
                        if (!seen.has(obj)) {
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
                        "photoUrl"
                    ];

                    for (const key of imageKeys) {
                        const value = obj[key];

                        if (
                            typeof value === "string" &&
                            isImageUrl(value)
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

            const imageUrls = extractImages(data);

            if (!imageUrls.length) {
                console.log(
                    "IMAGE DATA WITHOUT URL:",
                    JSON.stringify(data).slice(0, 5000)
                );

                throw new Error(
                    "No recognizable image URLs found. Check Heroku logs."
                );
            }

            const selectedImages = imageUrls.slice(0, 5);

            await sock.sendMessage(from, {
                text:
                    "╭━━〔 🖼️ IMAGE SEARCH 〕━━╮\n" +
                    "┃\n" +
                    `┃ 🔍 QUERY : ${query}\n` +
                    `┃ 📸 FOUND : ${imageUrls.length}\n` +
                    `┃ 📥 SENDING : ${selectedImages.length}\n` +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            // SEND IMAGES
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
                        console.log("Invalid image:", imageUrl);
                        continue;
                    }

                    await sock.sendMessage(from, {
                        image: buffer,
                        mimetype: mime,
                        caption:
                            `🖼️ IMAGE ${i + 1}/${selectedImages.length}\n` +
                            `🔍 SEARCH : ${query}\n\n` +
                            "> POWERED BY ZANTA-XMD 💫"
                    }, { quoted: msg });

                    sent++;

                } catch (imageError) {
                    console.log(
                        "IMAGE DOWNLOAD ERROR:",
                        imageError.message
                    );
                }
            }

            if (!sent) {
                throw new Error(
                    "Images were found but could not be downloaded."
                );
            }

        } catch (error) {
            console.error("\n========== IMAGE SEARCH ERROR ==========");
            console.error("Message:", error.message);
            console.error("Status:", error.response?.status);
            console.error("Response:", error.response?.data);
            console.error("========================================\n");

            await reply(
                "╭━━〔 ❌ IMAGE SEARCH ERROR 〕━━╮\n" +
                "┃\n" +
                "┃ Image search failed!\n" +
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
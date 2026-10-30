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
                    "╭━━〔 🖼️ IMAGE SEARCH 〕━━╮\n┃\n┃ Please enter image name!\n┃\n┃ Example:\n┃ .img Cat\n┃ .img Anime\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            loading = await sock.sendMessage(from, {
                text: "🔍 Searching images...\n⏳ Please wait."
            }, { quoted: msg });

            const response = await axios.get(
                "https://api.chamindu.site/api/v1/search/image",
                {
                    params: {
                        q: query,
                        api_key: API_KEY
                    },
                    timeout: 60000
                }
            );

            const data = response.data;

            console.log("IMAGE API RESPONSE:");
            console.dir(data, { depth: null });

            if (
                !data ||
                data.success === false ||
                data.status === false
            ) {
                throw new Error(data?.message || "Image search failed");
            }

            // Find image results
            function findImages(obj) {
                if (!obj || typeof obj !== "object") return [];

                if (Array.isArray(obj)) {
                    const imageItems = obj.filter(item =>
                        typeof item === "object" &&
                        item !== null &&
                        (
                            item.image ||
                            item.imageUrl ||
                            item.image_url ||
                            item.original ||
                            item.thumbnail
                        )
                    );

                    if (imageItems.length) return imageItems;

                    for (const item of obj) {
                        const result = findImages(item);
                        if (result.length) return result;
                    }
                }

                const keys = [
                    "results",
                    "images",
                    "data",
                    "items",
                    "image_results"
                ];

                for (const key of keys) {
                    if (obj[key]) {
                        const result = findImages(obj[key]);
                        if (result.length) return result;
                    }
                }

                return [];
            }

            const images = findImages(data);

            if (!images.length) {
                throw new Error("No images found in API response");
            }

            const selectedImages = images.slice(0, 5);

            await sock.sendMessage(from, {
                text:
                    `╭━━〔 🖼️ IMAGE SEARCH 〕━━╮\n` +
                    `┃\n` +
                    `┃ 🔍 QUERY : ${query}\n` +
                    `┃ 📸 FOUND : ${images.length}\n` +
                    `┃ 📥 SENDING : ${selectedImages.length}\n` +
                    `┃\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━`
            }, { quoted: msg });

            for (let i = 0; i < selectedImages.length; i++) {
                const item = selectedImages[i];

                const imageUrl =
                    item.image ||
                    item.imageUrl ||
                    item.image_url ||
                    item.original ||
                    item.thumbnail;

                if (!imageUrl) continue;

                try {
                    const imageResponse = await axios.get(imageUrl, {
                        responseType: "arraybuffer",
                        timeout: 30000,
                        maxContentLength: 15 * 1024 * 1024,
                        headers: {
                            "User-Agent": "Mozilla/5.0"
                        }
                    });

                    const buffer = Buffer.from(imageResponse.data);
                    const mime =
                        imageResponse.headers["content-type"] || "image/jpeg";

                    if (!mime.startsWith("image/")) continue;

                    await sock.sendMessage(from, {
                        image: buffer,
                        caption:
                            `🖼️ IMAGE ${i + 1}/${selectedImages.length}\n` +
                            `🔍 Search: ${query}\n\n` +
                            `> POWERED BY ZANTA-XMD 💫`
                    }, { quoted: msg });

                } catch (err) {
                    console.log("IMAGE SEND ERROR:", err.message);
                }
            }

        } catch (error) {
            console.error(
                "IMAGE SEARCH ERROR:",
                error.response?.data || error.message
            );

            await reply(
                "╭━━〔 ❌ IMAGE SEARCH ERROR 〕━━╮\n┃\n┃ Image search failed!\n┃\n┃ Error: " +
                error.message +
                "\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );

        } finally {
            if (loading?.key) {
                try {
                    await sock.sendMessage(from, {
                        delete: loading.key
                    });
                } catch (e) {}
            }
        }
    }
};
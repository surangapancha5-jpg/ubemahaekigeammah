require("dotenv").config();

const axios = require("axios");

module.exports = {
name: "img",
alias: ["image", "imagine", "nano", "aiimg"],
desc: "NanoBanana AI Image Generator",
category: "ai",
use: ".img <prompt>",

async execute(sock, msg, args, from, { reply }) {
    let waitMsg;

    try {
        const input = args.join(" ").trim();

        if (!input) {
            return reply(
                "╭━━〔 🍌 NANOBANANA AI 〕━━╮\n" +
                "┃\n" +
                "┃ 🎨 AI IMAGE GENERATOR\n" +
                "┃\n" +
                "┃ Usage:\n" +
                "┃ .img beautiful sunset\n" +
                "┃ .img anime wallpaper\n" +
                "┃ .img 3D ZANTA-XMD logo\n" +
                "┃\n" +
                "┃ Image Editing:\n" +
                "┃ .img make it beautiful IMAGE_URL\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const apiKey = process.env.NANOBANANA_API_KEY;

        if (!apiKey) {
            return reply("❌ NANOBANANA_API_KEY එක .env එකේ නැහැ!");
        }

        // Extract image URL if provided
        const urlMatch = input.match(/https?:\/\/[^\s]+/i);

        const imageUrl = urlMatch
            ? urlMatch[0].replace(/[.,]+$/, "")
            : "";

        const prompt = urlMatch
            ? input.replace(urlMatch[0], "").trim()
            : input;

        if (!prompt) {
            return reply("❌ Image prompt එකක් ලබාදෙන්න!");
        }

        waitMsg = await sock.sendMessage(from, {
            text:
                "╭━━〔 🍌 ZANTA-XMD AI 〕━━╮\n" +
                "┃\n" +
                "┃ 🎨 Creating AI Image...\n" +
                "┃ ⏳ Please Wait...\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

        // API Request
        const response = await axios.get(
            "https://back.asitha.top/api/nanobanana",
            {
                params: {
                    apiKey: apiKey,
                    prompt: prompt,
                    imageUrl: imageUrl
                },
                timeout: 180000,
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const data = response.data;

        console.log(
            "NANOBANANA RESPONSE:",
            JSON.stringify(data, null, 2)
        );

        if (data?.success === false || data?.error) {
            throw new Error(
                data.message || data.error || "API Error"
            );
        }

        // Find image in API response
        function findImage(obj, depth = 0) {
            if (!obj || depth > 8) return null;

            if (typeof obj === "string") {
                if (/^https?:\/\//i.test(obj)) {
                    return { url: obj };
                }

                if (
                    obj.startsWith("data:image/") ||
                    /^[A-Za-z0-9+/]{500,}={0,2}$/.test(obj)
                ) {
                    return {
                        base64: obj.startsWith("data:image/")
                            ? obj.split(",")[1]
                            : obj
                    };
                }

                return null;
            }

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const found = findImage(item, depth + 1);
                    if (found) return found;
                }
                return null;
            }

            if (typeof obj === "object") {
                const preferredKeys = [
                    "imageUrl",
                    "image_url",
                    "image",
                    "output",
                    "result",
                    "downloadUrl",
                    "download_url",
                    "url",
                    "data"
                ];

                for (const key of preferredKeys) {
                    if (obj[key] !== undefined) {
                        const found = findImage(
                            obj[key],
                            depth + 1
                        );

                        if (found) return found;
                    }
                }
            }

            return null;
        }

        const image = findImage(data);

        if (!image) {
            throw new Error(
                data?.message ||
                "API response එකේ Image URL එක හමු වුණේ නැහැ."
            );
        }

        let imageBuffer;
        let mimetype = "image/png";

        if (image.base64) {
            imageBuffer = Buffer.from(
                image.base64,
                "base64"
            );
        } else {
            const imageResponse = await axios.get(
                image.url,
                {
                    responseType: "arraybuffer",
                    timeout: 120000,
                    maxContentLength: 25 * 1024 * 1024
                }
            );

            imageBuffer = Buffer.from(imageResponse.data);

            const contentType =
                imageResponse.headers["content-type"];

            if (contentType?.startsWith("image/")) {
                mimetype = contentType;
            }
        }

        if (!imageBuffer || !imageBuffer.length) {
            throw new Error("Image එක Download කරගන්න බැරි වුණා.");
        }

        await sock.sendMessage(from, {
            image: imageBuffer,
            mimetype: mimetype,
            caption:
                "╭━━〔 ✨ ZANTA-XMD AI 〕━━╮\n" +
                "┃\n" +
                "┃ ✅ IMAGE GENERATED!\n" +
                "┃\n" +
                "┃ 📝 PROMPT:\n" +
                "┃ " + prompt +
                "\n┃\n" +
                "┃ 🍌 POWERED BY NANOBANANA\n" +
                "┃ 🤖 ZANTA-XMD\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

    } catch (error) {
        console.error(
            "NANOBANANA ERROR:",
            error.response?.data || error.message
        );

        const reason =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message;

        await reply(
            "╭━━〔 ❌ NANOBANANA ERROR 〕━━╮\n" +
            "┃\n" +
            "┃ " + String(reason).slice(0, 700) +
            "\n┃\n" +
            "╰━━━━━━━━━━━━━━━━━━━━╯"
        );

    } finally {
        if (waitMsg?.key) {
            await sock.sendMessage(from, {
                delete: waitMsg.key
            }).catch(() => {});
        }
    }
}

};
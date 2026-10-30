require("dotenv").config();

const axios = require("axios");

module.exports = {
name: "img",
alias: ["image", "imagine", "aiimg", "nano"],
desc: "Generate AI images using NanoBanana",
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
                "┃ ❌ Prompt එකක් ලබාදෙන්න!\n" +
                "┃\n" +
                "┃ Examples:\n" +
                "┃ .img beautiful sunset\n" +
                "┃ .img anime wallpaper\n" +
                "┃ .img 3D ZANTA-XMD logo\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const apiKey = process.env.NANOBANANA_API_KEY;

        if (!apiKey) {
            return reply("❌ NANOBANANA_API_KEY එක .env එකේ නැහැ!");
        }

        // Optional image URL
        const imageUrlMatch = input.match(/https?:\/\/\S+/i);
        const imageUrl = imageUrlMatch
            ? imageUrlMatch[0].replace(/[.,]+$/, "")
            : "";

        const prompt = imageUrl
            ? input.replace(imageUrlMatch[0], "").trim()
            : input;

        if (!prompt) {
            return reply("❌ Image prompt එකක් ලබාදෙන්න!");
        }

        waitMsg = await sock.sendMessage(from, {
            text:
                "╭━━〔 🍌 ZANTA-XMD AI 〕━━╮\n" +
                "┃\n" +
                "┃ 🎨 Generating Image...\n" +
                "┃ ⏳ Please Wait...\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

        const params = {
            apiKey,
            prompt
        };

        if (imageUrl) {
            params.imageUrl = imageUrl;
        }

        const response = await axios.get(
            "https://back.asitha.top/api/nanobanana",
            {
                params,
                timeout: 180000,
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = response.data;

        console.log(
            "NANOBANANA RESPONSE:",
            JSON.stringify(data, null, 2)
        );

        // Find generated image URL or base64
        function findImage(obj) {
            if (!obj) return null;

            if (typeof obj === "string") {
                if (/^https?:\/\/\S+\.(png|jpe?g|webp)(\?.*)?$/i.test(obj)) {
                    return { url: obj };
                }

                if (obj.startsWith("data:image/")) {
                    return { base64: obj.split(",")[1] };
                }

                return null;
            }

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const result = findImage(item);
                    if (result) return result;
                }
                return null;
            }

            if (typeof obj === "object") {
                for (const key of [
                    "imageUrl",
                    "image_url",
                    "url",
                    "output",
                    "result",
                    "image",
                    "images",
                    "data"
                ]) {
                    if (obj[key] !== undefined) {
                        const result = findImage(obj[key]);
                        if (result) return result;
                    }
                }
            }

            return null;
        }

        let image = findImage(data);

        if (!image && typeof data === "string") {
            image = findImage(data);
        }

        if (!image) {
            throw new Error(
                data?.message ||
                data?.error ||
                "API එකෙන් Image URL එකක් ලැබුණේ නැහැ. Terminal response එක බලන්න."
            );
        }

        let imageBuffer;

        if (image.base64) {
            imageBuffer = Buffer.from(image.base64, "base64");
        } else {
            const imageResponse = await axios.get(image.url, {
                responseType: "arraybuffer",
                timeout: 120000
            });

            imageBuffer = Buffer.from(imageResponse.data);
        }

        if (!imageBuffer || !imageBuffer.length) {
            throw new Error("Image එක Download කරගන්න බැරි වුණා.");
        }

        await sock.sendMessage(from, {
            image: imageBuffer,
            caption:
                "╭━━〔 ✨ ZANTA-XMD AI 〕━━╮\n" +
                "┃\n" +
                "┃ ✅ IMAGE GENERATED!\n" +
                "┃\n" +
                "┃ 📝 Prompt:\n" +
                "┃ " + prompt +
                "\n┃\n" +
                "┃ 🍌 NanoBanana AI\n" +
                "┃ ⚡ ZANTA-XMD\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

    } catch (error) {
        console.error(
            "NANOBANANA ERROR:",
            JSON.stringify(
                error.response?.data || error.message,
                null,
                2
            )
        );

        const reason =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message;

        await reply(
            "❌ NANOBANANA IMAGE ERROR\n\n" +
            "Reason: " + reason
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
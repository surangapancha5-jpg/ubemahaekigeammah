const axios = require("axios");

module.exports = {
name: "img",
alias: ["image", "imagine", "aiimg"],
desc: "Generate AI images using Gemini",
category: "ai",
use: ".img <prompt>",

async execute(sock, msg, args, from, { reply }) {
    try {
        const prompt = args.join(" ").trim();

        if (!prompt) {
            return reply(
                "╭━━〔 🤖 GEMINI AI IMAGE 〕━━╮\n" +
                "┃\n" +
                "┃ ❌ Image prompt එකක් ලබාදෙන්න!\n" +
                "┃\n" +
                "┃ උදාහරණය:\n" +
                "┃ .img beautiful sunset\n" +
                "┃ .img anime wallpaper\n" +
                "┃ .img 3D ZANTA-XMD logo\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return reply("❌ GEMINI_API_KEY එක .env file එකේ නැහැ!");
        }

        const wait = await sock.sendMessage(from, {
            text: "🎨 Gemini AI Image එක හදමින් පවතී...\n⏳ කරුණාකර රැඳී සිටින්න."
        }, { quoted: msg });

        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
                model: "gemini-nano-banana-2.1",
                input: prompt,
                response_format: {
                    type: "image",
                    mime_type: "image/jpeg",
                    aspect_ratio: "1:1",
                    image_size: "1K"
                }
            },
            {
                headers: {
                    "x-goog-api-key": apiKey,
                    "Content-Type": "application/json"
                },
                timeout: 180000
            }
        );

        let imageData = response.data?.output_image?.data;

        if (!imageData && response.data?.steps) {
            for (const step of response.data.steps) {
                if (step.type === "model_output") {
                    for (const content of (step.content || [])) {
                        if (content.type === "image" && content.data) {
                            imageData = content.data;
                            break;
                        }
                    }
                }

                if (imageData) break;
            }
        }

        if (!imageData) {
            throw new Error("Gemini API එකෙන් Image එකක් ලැබුණේ නැහැ.");
        }

        const imageBuffer = Buffer.from(imageData, "base64");

        await sock.sendMessage(from, {
            image: imageBuffer,
            caption:
                "╭━━〔 ✨ ZANTA-XMD AI 〕━━╮\n" +
                "┃\n" +
                "┃ 🎨 AI IMAGE GENERATED\n" +
                "┃\n" +
                "┃ 📝 Prompt: " + prompt +
                "\n┃\n" +
                "┃ 🤖 Powered by Gemini AI\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

        if (wait?.key) {
            await sock.sendMessage(from, {
                delete: wait.key
            }).catch(() => {});
        }

    } catch (error) {
        console.error("GEMINI IMAGE ERROR:", error.response?.data || error.message);

        const message =
            error.response?.data?.error?.message ||
            error.message;

        await reply(
            "❌ Gemini Image Generate Failed!\n\n" +
            "Reason: " + message
        );
    }
}

};
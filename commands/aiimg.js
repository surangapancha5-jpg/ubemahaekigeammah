require("dotenv").config();

const axios = require("axios");

module.exports = {
name: "img",
alias: ["image", "imagine", "aiimg"],
desc: "Generate AI images using Gemini",
category: "ai",
use: ".img <prompt>",

async execute(sock, msg, args, from, { reply }) {
    let waitMsg;

    try {
        const prompt = args.join(" ").trim();

        if (!prompt) {
            return reply(
                "╭━━〔 🎨 GEMINI AI IMAGE 〕━━╮\n" +
                "┃\n" +
                "┃ ❌ Image Prompt එකක් දෙන්න!\n" +
                "┃\n" +
                "┃ Examples:\n" +
                "┃ .img beautiful sunset\n" +
                "┃ .img anime wallpaper\n" +
                "┃ .img 3D ZANTA-XMD logo\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return reply(
                "❌ GEMINI_API_KEY එක .env file එකේ නැහැ!"
            );
        }

        waitMsg = await sock.sendMessage(from, {
            text:
                "╭━━〔 🤖 ZANTA-XMD AI 〕━━╮\n" +
                "┃\n" +
                "┃ 🎨 Image Generating...\n" +
                "┃ ⏳ Please Wait...\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
                model: "gemini-nano-banana-2.1",
                input: prompt,
                response_format: {
                    type: "image",
                    mime_type: "image/png",
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

        const data = response.data;

        let imageBase64 = data?.output_image?.data;

        // Fallback: Search image inside model output steps
        if (!imageBase64 && Array.isArray(data?.steps)) {
            for (const step of data.steps) {
                if (step.type === "model_output") {
                    for (const content of (step.content || [])) {
                        if (content.type === "image" && content.data) {
                            imageBase64 = content.data;
                            break;
                        }
                    }
                }

                if (imageBase64) break;
            }
        }

        if (!imageBase64) {
            throw new Error(
                "Gemini API එකෙන් Image Data ලැබුණේ නැහැ."
            );
        }

        const imageBuffer = Buffer.from(
            imageBase64,
            "base64"
        );

        if (!imageBuffer.length) {
            throw new Error("Generated image එක හිස්.");
        }

        await sock.sendMessage(from, {
            image: imageBuffer,
            mimetype: "image/png",
            caption:
                "╭━━〔 ✨ ZANTA-XMD AI 〕━━╮\n" +
                "┃\n" +
                "┃ ✅ IMAGE GENERATED!\n" +
                "┃\n" +
                "┃ 📝 Prompt:\n" +
                "┃ " + prompt +
                "\n┃\n" +
                "┃ 🤖 Gemini AI\n" +
                "┃ ⚡ ZANTA-XMD\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        }, { quoted: msg });

    } catch (error) {
        const apiError = error.response?.data?.error;

        console.error(
            "GEMINI IMAGE ERROR:",
            JSON.stringify(
                error.response?.data || error.message,
                null,
                2
            )
        );

        let errorMessage = "Image Generate Failed!";

        if (error.response?.status === 401) {
            errorMessage =
                "API Key එක Invalid හෝ Expired.\n" +
                "අලුත් Gemini API Key එකක් ලබාගෙන .env එකට දාන්න.";
        } else if (error.response?.status === 403) {
            errorMessage =
                "API Permission Denied.\n" +
                "Project එකේ API access සහ model availability පරීක්ෂා කරන්න.";
        } else if (error.response?.status === 404) {
            errorMessage =
                "Gemini model එක හෝ API endpoint එක හමු වුණේ නැහැ.";
        } else if (error.response?.status === 429) {
            errorMessage =
                "API quota එක අවසන් හෝ request limit එක ඉක්මවා ඇත.";
        } else if (error.code === "ECONNABORTED") {
            errorMessage =
                "Request Timeout. නැවත උත්සාහ කරන්න.";
        } else {
            errorMessage =
                apiError?.message ||
                error.message ||
                errorMessage;
        }

        await reply(
            "❌ GEMINI IMAGE ERROR\n\n" +
            errorMessage
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
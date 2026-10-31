const axios = require("axios");

// ════════════════════════════════════════════════════════
//          TIKTOK DOWNLOADER
//          TikTok Video Download කිරීම.
// ════════════════════════════════════════════════════════

// API KEY එක මෙතැනට දාන්න
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

function zantaBox(title, lines = []) {
    return (
        `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n` +
        `┃◈╭─────────────·๏\n` +
        `┃◈┃⛩️ ${title}\n` +
        `┃◈┃\n` +
        lines.map(line => `┃◈┃⛩️ ${line}\n`).join("") +
        `┃◈└───────────┈⊷\n` +
        `╰──────────────┈⊷\n` +
        `> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
    );
}

module.exports = {
    name: "tiktok",
    alias: ["tt", "ttdl", "tiktokdl"],
    desc: "TikTok Video Downloader",
    category: "download",
    use: ".tiktok <TikTok URL>",

    async execute(sock, msg, args, from, { reply, prefix }) {
        try {

            // ════════════════════════════════════════════════
            //          URL CHECK
            //          TikTok URL එක ලබාගැනීම.
            // ════════════════════════════════════════════════

            const quoted =
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            const quotedText =
                quoted?.conversation ||
                quoted?.extendedTextMessage?.text ||
                "";

            const input = [...args].join(" ") || quotedText;

            const match = input.match(
                /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+/i
            );

            if (!match) {
                return reply(zantaBox("TIKTOK DOWNLOADER", [
                    `Usage: ${prefix || "."}tiktok <URL>`,
                    "TikTok Video Link එකක් ලබාදෙන්න."
                ]));
            }

            const videoUrl = match[0].replace(/[<>]/g, "");

            // ════════════════════════════════════════════════
            //          API REQUEST
            //          TikTok API එකට Request කිරීම.
            // ════════════════════════════════════════════════

            if (!API_KEY || API_KEY === "YOUR_NEW_API_KEY") {
                return reply(zantaBox("API KEY ERROR", [
                    "tiktok.js එකේ API_KEY එක සකස් කරන්න."
                ]));
            }

            await reply(zantaBox("TIKTOK DOWNLOADER", [
                "Video එක ලබාගනිමින් පවතී...",
                "කරුණාකර රැඳී සිටින්න."
            ]));

            const response = await axios.get(
                "https://api.chamindu.site/api/v1/tiktok",
                {
                    params: {
                        url: videoUrl,
                        api_key: API_KEY
                    },
                    timeout: 60000
                }
            );

            const data = response.data;

            // ════════════════════════════════════════════════
            //          EXTRACT VIDEO URL
            //          API Response එකෙන් Video URL ගැනීම.
            // ════════════════════════════════════════════════

            function findVideoUrl(obj) {
                if (!obj || typeof obj !== "object") return null;

                const keys = [
                    "video_url",
                    "videoUrl",
                    "download_url",
                    "downloadUrl",
                    "nowm",
                    "no_watermark",
                    "noWatermark",
                    "play",
                    "url"
                ];

                for (const key of keys) {
                    const value = obj[key];

                    if (
                        typeof value === "string" &&
                        /^https?:\/\//i.test(value)
                    ) {
                        return value;
                    }
                }

                for (const value of Object.values(obj)) {
                    if (value && typeof value === "object") {
                        const result = findVideoUrl(value);
                        if (result) return result;
                    }
                }

                return null;
            }

            const downloadUrl = findVideoUrl(data);

            if (!downloadUrl) {
                console.log(
                    "TIKTOK API RESPONSE:",
                    JSON.stringify(data, null, 2)
                );

                return reply(zantaBox("TIKTOK ERROR", [
                    "API එකෙන් Video URL එකක් ලැබුණේ නැහැ.",
                    "Terminal / Heroku Logs පරීක්ෂා කරන්න."
                ]));
            }

            // ════════════════════════════════════════════════
            //          DOWNLOAD VIDEO
            //          Video එක Buffer එකක් ලෙස ලබාගැනීම.
            // ════════════════════════════════════════════════

            const videoResponse = await axios.get(downloadUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 100 * 1024 * 1024,
                maxBodyLength: 100 * 1024 * 1024
            });

            const videoBuffer = Buffer.from(videoResponse.data);

            if (!videoBuffer.length) {
                throw new Error("Empty video buffer");
            }

            // ════════════════════════════════════════════════
            //          SEND VIDEO
            //          WhatsApp වෙත Video එක යැවීම.
            // ════════════════════════════════════════════════

            await sock.sendMessage(
                from,
                {
                    video: videoBuffer,
                    mimetype: "video/mp4",
                    caption: zantaBox("TIKTOK DOWNLOADED", [
                        "Video එක සාර්ථකව Download කළා.",
                        `Size: ${(videoBuffer.length / 1048576).toFixed(2)} MB`,
                        "Powered By ZANTA-XMD"
                    ])
                },
                { quoted: msg }
            );

        } catch (error) {
            console.error(
                "TIKTOK ERROR:",
                error.response?.data || error.message
            );

            return reply(zantaBox("DOWNLOAD FAILED", [
                "TikTok Video එක Download කිරීමට නොහැකි වුණා.",
                "Link එක හෝ API එක පරීක්ෂා කරන්න."
            ]));
        }
    }
};
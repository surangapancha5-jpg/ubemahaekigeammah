const axios = require("axios");

const GIFT_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

// Cache video in memory
let videoCache = null;
let videoLoading = false;

async function getGiftVideo() {
    if (videoCache) return videoCache;

    if (videoLoading) {
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (videoCache) return videoCache;
        }

        throw new Error("Video loading timeout");
    }

    videoLoading = true;

    try {
        const response = await axios.get(GIFT_VIDEO, {
            responseType: "arraybuffer",
            timeout: 30000,
            maxContentLength: 25 * 1024 * 1024,
            maxBodyLength: 25 * 1024 * 1024,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        if (!response.data || response.data.length === 0) {
            throw new Error("Empty video response");
        }

        videoCache = Buffer.from(response.data);

        return videoCache;

    } finally {
        videoLoading = false;
    }
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return `${d}d ${h}h ${m}m ${s}s`;
}

function getTotalCommands() {
    const commands = global.commands;

    if (commands instanceof Map) return commands.size;

    if (Array.isArray(commands)) return commands.length;

    if (commands && typeof commands === "object") {
        return Object.keys(commands).length;
    }

    return 0;
}

module.exports = {
    name: "ping",
    alias: ["speed", "pong"],
    desc: "ZANTA-XMD Ping Status",
    category: "main",
    use: ".ping",

    async execute(sock, msg, args, from, { reply }) {
        const start = Date.now();

        try {
            const totalCmds = getTotalCommands();

            const timestamp = Number(msg.messageTimestamp);

            const speed = timestamp
                ? Math.max(0, start - timestamp * 1000)
                : 0;

            const message =
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${msg.pushName || "User"}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐔𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃⛩️ *𝐒𝐓𝐀𝐓𝐔𝐒* ONLINE 🟢
┃◈┃
┃◈┃⛩️ *𝐒𝐏𝐄𝐄𝐃* ${speed}ms
┃◈┃
┃◈┃⛩️ *𝐔𝐏𝐓𝐈𝐌𝐄* ${formatUptime(process.uptime())}
┃◈┃
┃◈┃⛩️ *𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* ${totalCmds}+
┃◈┃
┃◈┃⛩️ *𝐎𝐖𝐍𝐄𝐑* 𝙼𝚁 𝚂𝚄𝚁𝙰𝙽𝙶𝙰 𝙼𝙾𝙳-𝚉
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            // Load cached gift video
            let video;

            try {
                video = await getGiftVideo();
            } catch (videoError) {
                console.error("[PING VIDEO ERROR]", videoError.message);

                // Video unavailable: send status as text
                return await sock.sendMessage(
                    from,
                    { text: message },
                    { quoted: msg }
                );
            }

            // Send gift video
            await sock.sendMessage(
                from,
                {
                    video: video,
                    mimetype: "video/mp4",
                    gifPlayback: true,
                    caption: message
                },
                {
                    quoted: msg
                }
            );

        } catch (error) {
            console.error("[PING COMMAND ERROR]", error);

            try {
                await reply(
                    "❌ PING ERROR!\n" +
                    "Error: " + error.message
                );
            } catch (replyError) {
                console.error("[PING REPLY ERROR]", replyError.message);
            }
        }
    }
};
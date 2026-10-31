const axios = require("axios");

const GIFT_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return `${d}d ${h}h ${m}m ${s}s`;
}

function getTotalCommands() {
    const commands = global.commands;

    if (commands instanceof Map) {
        return commands.size;
    }

    if (Array.isArray(commands)) {
        return commands.length;
    }

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
        try {
            const start = Date.now();

            // Download Gift Video
            const response = await axios.get(GIFT_VIDEO, {
                responseType: "arraybuffer",
                timeout: 60000
            });

            const videoBuffer = Buffer.from(response.data);

            // Calculate message response speed
            const timestamp = Number(msg.messageTimestamp);

            const speed = timestamp
                ? Math.max(0, Date.now() - timestamp * 1000)
                : Date.now() - start;

            const totalCmds = getTotalCommands();

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
┃◈┃⛩️ *𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 75+
┃◈┃
┃◈┃⛩️ *𝐎𝐖𝐍𝐄𝐑* 𝙼𝚁 𝚂𝚄𝚁𝙰𝙽𝙶𝙰 𝙼𝙾𝙳-𝚉
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            // Send Gift Video with Ping Caption
            await sock.sendMessage(
                from,
                {
                    video: videoBuffer,
                    gifPlayback: true,
                    caption: message
                },
                { quoted: msg }
            );

        } catch (error) {
            console.error("[PING ERROR]", error);

            await reply(
                "❌ PING ERROR!\n\n" +
                "Gift Video එක යැවීමට නොහැකි වුණා.\n" +
                "Error: " + error.message
            );
        }
    }
};
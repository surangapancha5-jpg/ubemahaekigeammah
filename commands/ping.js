const axios = require("axios");
const fs = require("fs");
const os = require("os");

module.exports = {
name: "ping",
alias: ["speed"],
desc: "Check bot response speed",
category: "main",
use: ".ping",

async execute(sock, msg, args, from, { reply }) {
    const start = Date.now();

    try {
        const gifs = [
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297778/zanta_media_uploads/xs71mc73rbm1pmzmoomw.mp4",
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
        ];

        // Uptime
        const formatUptime = (seconds) => {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        };

        // Command count
        let totalCmds = 0;

        try {
            totalCmds = fs.readdirSync(__dirname)
                .filter(file => file.endsWith(".js")).length;
        } catch (e) {
            console.log("COMMAND COUNT:", e.message);
        }

        // System information
        const memory = process.memoryUsage();
        const ramUsage = Math.round(memory.rss / 1024 / 1024);
        const heapUsage = Math.round(memory.heapUsed / 1024 / 1024);

        const platform = process.env.DYNO
            ? "HEROKU"
            : process.platform.toUpperCase();

        const botMode = process.env.WORK_MODE ||
            process.env.MODE || "PUBLIC";

        const cpuCores = os.cpus().length;

        // Ping text
        const text = `

╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨: ${msg.pushName || "User"}
┃◈┃• 🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧: 1.0
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐔𝐒 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃⛩️ 𝐒𝐓𝐀𝐓𝐔𝐒 ONLINE 🟢
┃◈┃
┃◈┃⛩️ 𝐒𝐏𝐄𝐄𝐃 ${Date.now() - start}ms
┃◈┃
┃◈┃⛩️ 𝐔𝐏𝐓𝐈𝐌𝐄 ${formatUptime(process.uptime())}
┃◈┃
┃◈┃⛩️ 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒 ${totalCmds}+
┃◈┃
┃◈┃⛩️ 𝐁𝐎𝐓 𝐌𝐎𝐃𝐄 ${botMode}
┃◈┃
┃◈┃⛩️ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐈𝐎𝐍 CONNECTED 🟢
┃◈┃
┃◈┃⛩️ 𝐏𝐋𝐀𝐓𝐅𝐎𝐑𝐌 ${platform}
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 𝐒𝐄𝐑𝐕𝐄𝐑 𝐒𝐓𝐀𝐓𝐔𝐒 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃⛩️ 𝐍𝐎𝐃𝐄𝐉𝐒 ${process.version}
┃◈┃
┃◈┃⛩️ 𝐑𝐀𝐌 𝐔𝐒𝐀𝐆𝐄 ${ramUsage} MB
┃◈┃
┃◈┃⛩️ 𝐇𝐄𝐀𝐏 𝐔𝐒𝐀𝐆𝐄 ${heapUsage} MB
┃◈┃
┃◈┃⛩️ 𝐓𝐎𝐓𝐀𝐋 𝐑𝐀𝐌 ${Math.round(os.totalmem() / 1024 / 1024)} MB
┃◈┃
┃◈┃⛩️ 𝐅𝐑𝐄𝐄 𝐑𝐀𝐌 ${Math.round(os.freemem() / 1024 / 1024)} MB
┃◈┃
┃◈┃⛩️ 𝐂𝐏𝐔 𝐂𝐎𝐑𝐄𝐒 ${cpuCores}
┃◈┃
┃◈┃⛩️ 𝐒𝐄𝐑𝐕𝐄𝐑 ONLINE 🟢
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 𝐈𝐍𝐅𝐎 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃⛩️ 𝐎𝐖𝐍𝐄𝐑 𝙼𝚁 𝚂𝚄𝚁𝙰𝙽𝙶𝙰 𝙼𝙾𝙳-𝚉
┃◈┃
┃◈┃⛩️ 𝐁𝐎𝐓 ZANTA-XMD
┃◈┃
┃◈┃⛩️ 𝐕𝐄𝐑𝐒𝐈𝐎𝐍 1.0
┃◈└───────────┈⊷
╰──────────────┈⊷

«𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;»

        // First send text to ensure ping works
        const sent = await sock.sendMessage(
            from,
            { text },
            { quoted: msg }
        );

        // Random GIF video
        const randomGif = gifs[
            Math.floor(Math.random() * gifs.length)
        ];

        try {
            const response = await axios.get(randomGif, {
                responseType: "arraybuffer",
                timeout: 12000,
                maxContentLength: 50 * 1024 * 1024
            });

            const videoBuffer = Buffer.from(response.data);

            await sock.sendMessage(from, {
                video: videoBuffer,
                gifPlayback: true,
                caption: "⚡ ZANTA-XMD ONLINE 🟢"
            }, { quoted: msg });

        } catch (videoError) {
            console.log("PING GIF ERROR:", videoError.message);
        }

        return sent;

    } catch (error) {
        console.error("PING ERROR:", error);

        try {
            await reply("❌ PING ERROR: " + error.message);
        } catch (replyError) {
            console.error("PING REPLY ERROR:", replyError.message);
        }
    }
}

};
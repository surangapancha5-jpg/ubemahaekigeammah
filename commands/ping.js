const axios = require("axios");
const fs = require("fs");
const os = require("os");

module.exports = {
name: "ping",
alias: ["speed"],
desc: "Check bot response speed and server status",
category: "main",
use: ".ping",

async execute(sock, msg, args, from, { reply }) {
    const start = Date.now();

    try {
        // Random GIF URLs
        const gifs = [
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297778/zanta_media_uploads/xs71mc73rbm1pmzmoomw.mp4",
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4",
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297778/zanta_media_uploads/xs71mc73rbm1pmzmoomw.mp4",
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
        ];

        const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

        // Initial response
        const sent = await sock.sendMessage(from, {
            text: "⚡ Checking ZANTA-XMD MINI speed..."
        }, { quoted: msg });

        const speed = Date.now() - start;

        // Logo URL
        const logoUrl =
            process.env.BOT_LOGO ||
            process.env.LOGO ||
            process.env.BOT_LOGO_URL ||
            "";

        // Count commands
        let totalCmds = 0;

        try {
            const files = fs.readdirSync(__dirname);

            totalCmds = files.filter(file =>
                file.endsWith(".js")
            ).length;

        } catch (e) {
            console.error("COMMAND COUNT ERROR:", e.message);
        }

        // Uptime formatter
        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        }

        // RAM Usage
        const memory = process.memoryUsage();

        const ramUsage = Math.round(
            memory.rss / 1024 / 1024
        );

        const heapUsage = Math.round(
            memory.heapUsed / 1024 / 1024
        );

        const totalRam = Math.round(
            os.totalmem() / 1024 / 1024
        );

        const freeRam = Math.round(
            os.freemem() / 1024 / 1024
        );

        // CPU Information
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || "Unknown";
        const cpuCores = cpus.length;

        // Platform
        const platform = process.env.DYNO
            ? "HEROKU"
            : process.platform.toUpperCase();

        // Bot Mode
        const botMode =
            process.env.WORK_MODE ||
            process.env.MODE ||
            "PUBLIC";

        // WhatsApp connection
        const connectionStatus =
            sock?.user ? "CONNECTED 🟢" : "ACTIVE 🟢";

        // Final Message
        const text = `

╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨:  ${msg.pushName || "User"}
┃◈┃• *💋 I Am Zanta-xmd* 
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐔𝐒 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃⛩️ 𝐒𝐓𝐀𝐓𝐔𝐒 ONLINE 🟢
┃◈┃
┃◈┃⛩️ 𝐒𝐏𝐄𝐄𝐃 ${speed}ms
┃◈┃
┃◈┃⛩️ 𝐔𝐏𝐓𝐈𝐌𝐄 ${formatUptime(process.uptime())}
┃◈┃
┃◈┃⛩️ 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒 ${totalCmds}+
┃◈┃
┃◈┃⛩️ 𝐁𝐎𝐓 𝐌𝐎𝐃𝐄 ${botMode}
┃◈┃
┃◈┃⛩️ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐈𝐎𝐍 ${connectionStatus}
┃◈┃
┃◈┃⛩️ 𝐏𝐋𝐀𝐓𝐅𝐎𝐑𝐌 ${platform}
┃◈┃
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
┃◈┃⛩️ 𝐓𝐎𝐓𝐀𝐋 𝐑𝐀𝐌 ${totalRam} MB
┃◈┃
┃◈┃⛩️ 𝐅𝐑𝐄𝐄 𝐑𝐀𝐌 ${freeRam} MB
┃◈┃
┃◈┃⛩️ 𝐂𝐏𝐔 𝐂𝐎𝐑𝐄𝐒 ${cpuCores}
┃◈┃
┃◈┃⛩️ 𝐂𝐏𝐔 ${cpuModel}
┃◈┃
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

        // Download random video
        let videoBuffer = null;

        try {
            const res = await axios.get(randomGif, {
                responseType: "arraybuffer",
                timeout: 20000,
                maxContentLength: 50 * 1024 * 1024
            });

            videoBuffer = Buffer.from(res.data);

        } catch (e) {
            console.error("PING VIDEO ERROR:", e.message);
        }

        // Download logo if video fails
        let imageBuffer = null;

        if (!videoBuffer && logoUrl) {
            try {
                const res = await axios.get(logoUrl, {
                    responseType: "arraybuffer",
                    timeout: 15000
                });

                imageBuffer = Buffer.from(res.data);

            } catch (e) {
                console.error("PING LOGO ERROR:", e.message);
            }
        }

        // Send final status
        if (videoBuffer) {
            await sock.sendMessage(from, {
                video: videoBuffer,
                gifPlayback: true,
                caption: text
            }, { quoted: msg });

        } else if (imageBuffer) {
            await sock.sendMessage(from, {
                image: imageBuffer,
                caption: text
            }, { quoted: msg });

        } else {
            await sock.sendMessage(from, {
                text: text
            }, { quoted: msg });
        }

        // Delete temporary message
        try {
            await sock.sendMessage(from, {
                delete: sent.key
            });
        } catch (e) {
            console.log("PING DELETE ERROR:", e.message);
        }

    } catch (error) {
        console.error("PING ERROR:", error);

        try {
            await reply("❌ Ping command failed!");
        } catch (_) {}
    }
}

};
const axios = require("axios");
const fs = require("fs");
const path = require("path");

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
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4",
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297778/zanta_media_uploads/xs71mc73rbm1pmzmoomw.mp4",
            "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
        ];

        const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

        // Initial ping message
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
                file.endsWith(".js") &&
                file !== "index.js"
            ).length;
        } catch (e) {
            totalCmds = 0;
        }

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

        // Download logo fallback
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

        // Uptime
        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        }

        // ORIGINAL MESSAGE DESIGN - UNCHANGED
        const text = `

╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨:  ${msg.pushName || "User"}
┃◈┃• 🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧:  1.0
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
┃◈┃
┃◈┃⛩️ 𝐎𝐖𝐍𝐄𝐑 𝙼𝚁 𝚂𝚄𝚁𝙰𝙽𝙶𝙰 𝙼𝙾𝙳-𝚉
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

«𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;»

        // Send final result
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

        // Delete temporary checking message
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
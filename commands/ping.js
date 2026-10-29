const axios = require("axios");

module.exports = {
name: "ping",
alias: ["speed"],
desc: "Check bot response speed",
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

        // Send initial response to measure actual bot response time
        const sent = await sock.sendMessage(from, {
            text: "⚡ Checking ZANTA-XMD MINI speed..."
        }, { quoted: msg });

        const speed = Date.now() - start;

        // Read logo URL from .env (support common variable names)
        const logoUrl =
            process.env.BOT_LOGO ||
            process.env.LOGO ||
            process.env.BOT_LOGO_URL ||
            "";

        let imageBuffer = null;
        let gifBuffer = null;

        if (logoUrl) {
            try {
                const res = await axios.get(logoUrl, {
                    responseType: "arraybuffer",
                    timeout: 15000
                });
                imageBuffer = Buffer.from(res.data);
            } catch (e) {
                console.error("Logo download failed:", e.message);
            }
        }

        try {
            const res = await axios.get(randomGif, {
                responseType: "arraybuffer",
                timeout: 15000
            });
            gifBuffer = Buffer.from(res.data);
        } catch (e) {
            console.error("GIF download failed:", e.message);
        }

        const text =
            "╭━━━〔 ⚡ ZANTA-XMD MINI 〕━━━╮\n" +
            "┃\n" +
            `┃ 🚀 Status : Online\n` +
            `┃ ⚡ Speed  : ${speed} ms\n` +
            `┃ ⏱️ Uptime : ${formatUptime(process.uptime())}\n` +
            "┃\n" +
            "╰━━━━━━━━━━━━━━━━━━━━╯";

        // WhatsApp doesn't support a regular image and GIF as two
        // separate media attachments inside one message.
        // Use the GIF as an animated video with the status text.
        if (gifBuffer) {
            await sock.sendMessage(from, {
                video: gifBuffer,
                gifPlayback: true,
                caption: text
            }, { quoted: msg });
        } else if (imageBuffer) {
            await sock.sendMessage(from, {
                image: imageBuffer,
                caption: text
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text }, { quoted: msg });
        }

        // Remove the temporary "checking" message
        try {
            await sock.sendMessage(from, {
                delete: sent.key
            });
        } catch (_) {}

    } catch (error) {
        console.error("PING ERROR:", error);
        await reply("❌ Ping command failed!");
    }
}

};

function formatUptime(seconds) {
const days = Math.floor(seconds / 86400);
const hours = Math.floor((seconds % 86400) / 3600);
const minutes = Math.floor((seconds % 3600) / 60);
const secs = Math.floor(seconds % 60);

return `${days}d ${hours}h ${minutes}m ${secs}s`;

}
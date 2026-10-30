const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "menu",
    alias: ["memu2", "allmenu", "help"],
    desc: "Show full bot menu",
    category: "main",
    use: ".menu",

    async execute(sock, msg, args, from, { reply }) {

        const start = Date.now();
        let sent;

        try {

            // Loading Message
            sent = await sock.sendMessage(from, {
                text: "✨ *ZANTA-XMD MINI MENU Loading...*"
            }, { quoted: msg });

            // Gift Video
            const giftVideoUrl =
                "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

            // Commands Count
            const commandsPath = __dirname;

            const files = fs.readdirSync(commandsPath)
                .filter(f => f.endsWith(".js"));

            const totalCmds = files.length;

            // Speed
            const speed = Date.now() - start;

            // Menu Text
            const menuText = `
╭━━━〔 *⚡ ZANTA-XMD MINI ⚡* 〕━━━┈⊷
┃
┃ *╭───────────────*
┃ │  *USER:* ${msg.pushName || "User"}
┃ │  *SPEED:* ${speed}ms
┃ │  *UPTIME:* ${formatUptime(process.uptime())}
┃ │  *COMMANDS:* ${totalCmds}+
┃ │  *MODE:* Public
┃ *╰───────────────*
┃
┃ *┏━━━━━━━━━━━━━━━━━━┓*
┃ *┃  MAIN MENU*
┃ *┗━━━━━━━━━━━━━━━━━━┛*
┃  ◈ .ping / .speed
┃  ◈ .menu / .memu
┃  ◈ .alive
┃  ◈ .owner
┃
┃ *┏━━━━━━━━━━━━━━━━━━┓*
┃ *┃  DOWNLOAD MENU*
┃ *┗━━━━━━━━━━━━━━━━━━┛*
┃  ◈ .song
┃  ◈ .video
┃  ◈ .fb
┃  ◈ .tiktok
┃  ◈ .ig
┃
┃ *┏━━━━━━━━━━━━━━━━━━┓*
┃ *┃  GROUP MENU*
┃ *┗━━━━━━━━━━━━━━━━━━┛*
┃  ◈ .kick
┃  ◈ .add
┃  ◈ .promote
┃  ◈ .demote
┃  ◈ .tagall
┃  ◈ .hidetag
┃
┃ *┏━━━━━━━━━━━━━━━━━━┓*
┃ *┃  AI & TOOLS*
┃ *┗━━━━━━━━━━━━━━━━━━┛*
┃  ◈ .ai
┃  ◈ .gpt
┃  ◈ .img
┃
╰━━━━━━━━━━━━━━━━━━━━┈⊷

> *© POWERED BY ZANTA MD | 2026* 💫
`;

            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363411691471139@newsletter",
                    newsletterName: "ZANTA-XMD MINI 🌟",
                    serverMessageId: 100
                }
            };

            let videoBuffer = null;

            // Download Video
            try {

                const res = await axios.get(giftVideoUrl, {
                    responseType: "arraybuffer",
                    timeout: 20000,
                    maxContentLength: 50 * 1024 * 1024
                });

                videoBuffer = Buffer.from(res.data);

            } catch (err) {

                console.log("VIDEO DOWNLOAD ERROR:", err.message);

            }

            let menuSent = false;

            // Try Video Menu
            if (videoBuffer && videoBuffer.length > 0) {

                try {

                    await sock.sendMessage(from, {
                        video: videoBuffer,
                        caption: menuText,
                        mimetype: "video/mp4",
                        gifPlayback: false,
                        viewOnce: true,
                        contextInfo
                    }, { quoted: msg });

                    menuSent = true;

                } catch (err) {

                    console.log("VIDEO SEND ERROR:", err.message);

                }
            }

            // Fallback Text Menu
            if (!menuSent) {

                await sock.sendMessage(from, {
                    text: menuText,
                    contextInfo
                }, { quoted: msg });

            }

            // Delete Loading Message
            if (sent && sent.key) {

                try {
                    await sock.sendMessage(from, {
                        delete: sent.key
                    });
                } catch (err) {
                    console.log("DELETE ERROR:", err.message);
                }

            }

        } catch (error) {

            console.error("MENU ERROR:", error);

            try {
                if (sent && sent.key) {
                    await sock.sendMessage(from, {
                        delete: sent.key
                    });
                }
            } catch (_) {}

            await reply("❌ Menu command failed! Please try again.");

        }
    }
};


// Uptime Formatter
function formatUptime(seconds) {

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}
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
    try {
        const sent = await sock.sendMessage(from, {
            text: "✨ *ZANTA-XMD MINI MENU Loading...*"
        }, { quoted: msg });

        // ඔයා දුන්න Gift Video එක
        const giftVideoUrl = "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

        let videoBuffer = null;
        try {
            const res = await axios.get(giftVideoUrl, {
                responseType: "arraybuffer",
                timeout: 20000
            });
            videoBuffer = Buffer.from(res.data);
        } catch (e) {
            console.error("Gift Video download failed:", e.message);
        }

        // Auto Commands Read
        const commandsPath = path.join(__dirname);
        const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
        let totalCmds = files.length;
        const speed = Date.now() - start;

        const text = `
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

        if (videoBuffer) {
            await sock.sendMessage(from, {
                video: videoBuffer,
                caption: text,
                gifPlayback: false,
                viewOnce: true, // GIFT එක වගේ යන්නෙ මේකෙන්
                contextInfo: contextInfo
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: text,
                contextInfo: contextInfo
            }, { quoted: msg });
        }

        try { await sock.sendMessage(from, { delete: sent.key }); } catch(_){}

    } catch (error) {
        console.error("MENU ERROR:", error);
        await reply("❌ Menu command failed!");
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
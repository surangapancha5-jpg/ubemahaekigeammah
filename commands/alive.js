const axios = require("axios");

module.exports = {
    name: "alive",
    alias: ["online", "status"],
    desc: "Check bot status",
    category: "main",
    use: ".alive",

    async execute(sock, msg, args, from, { reply }) {
        try {
            const videos = [
                "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297778/zanta_media_uploads/xs71mc73rbm1pmzmoomw.mp4",
                "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
            ];

            await reply("🤖 *ZANTA AI SYSTEM INITIALIZING...*");

            // Send both videos
            for (let i = 0; i < videos.length; i++) {
                try {
                    const response = await axios.get(videos[i], {
                        responseType: "arraybuffer",
                        timeout: 30000
                    });

                    await sock.sendMessage(from, {
                        video: Buffer.from(response.data),
                        mimetype: "video/mp4",
                        caption: i === 0
                            ? "🤖 *ZANTA AI • SYSTEM ONLINE*"
                            : "⚡ *AI VISUAL MODULE • ACTIVE*"
                    }, { quoted: msg });

                } catch (videoError) {
                    console.error(`ALIVE VIDEO ${i + 1} ERROR:`, videoError.message);
                }
            }

            // AI-style alive message
            const startTime = Date.now();

            const message = `
╭━━━〔 🤖 ZANTA AI SYSTEM 〕━━━╮

   ✨ *ARTIFICIAL INTELLIGENCE*
   🟢 *SYSTEM STATUS : ONLINE*

╰━━━━━━━━━━━━━━━━━━━━╯

👋 Hello, ${getPushName(msg)}!

> 🧠 Intelligence Engine : ACTIVE
> ⚡ Response System     : READY
> 🌐 Network Connection  : CONNECTED
> 🔋 Performance Mode    : OPTIMIZED
> 🛡️ Security Module     : ENABLED

╭━━━〔 ⚙️ SYSTEM DETAILS 〕━━━╮

📡 Bot Name : ZANTA-XMD MINI
⏱️ Uptime   : ${formatUptime(process.uptime())}
💚 Status   : Fully Operational
🚀 Latency  : ${Date.now() - startTime} ms

╰━━━━━━━━━━━━━━━━━━━━╯

_This message was generated automatically by ZANTA AI._

> 💻 Powered by ZANTA-XMD
`;

            await sock.sendMessage(from, {
                text: message
            }, { quoted: msg });

        } catch (error) {
            console.error("ALIVE COMMAND ERROR:", error);
            await reply("❌ *Alive command failed!*\n\n" + (error.message || "Unknown error"));
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

function getPushName(msg) {
    return msg.pushName || "User";
}
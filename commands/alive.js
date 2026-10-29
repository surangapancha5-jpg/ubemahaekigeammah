const axios = require("axios");

const VIDEOS = [
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297778/zanta_media_uploads/xs71mc73rbm1pmzmoomw.mp4",
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
];

// Alternate videos between alive commands
let videoIndex = 0;

module.exports = {
    name: "alive",
    alias: ["online", "status"],
    desc: "AI style alive message",
    category: "main",
    use: ".alive",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // Pick the next video
            const videoUrl = VIDEOS[videoIndex];
            videoIndex = (videoIndex + 1) % VIDEOS.length;

            const startTime = Date.now();

            // Download selected video
            const response = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024
            });

            const videoBuffer = Buffer.from(response.data);
            const speed = Date.now() - startTime;

            // AI generated-style caption attached to the video
            const caption = `
╭━━━〔 🤖 ZANTA AI 〕━━━╮

     ✨ SYSTEM ACTIVATED ✨

╰━━━━━━━━━━━━━━━━━━╯

👋 Hello, ${msg.pushName || "User"}!

┏━━━━━━━━━━━━━━━━━━
┃ 🟢 STATUS   : ONLINE
┃ ⚡ SPEED    : ${speed} ms
┃ 🧠 AI CORE  : ACTIVE
┃ 🌐 NETWORK  : CONNECTED
┃ 🔋 SYSTEM   : OPERATIONAL
┃ ⏱️ UPTIME   : ${formatUptime(process.uptime())}
┗━━━━━━━━━━━━━━━━━━

💚 Your AI assistant is ready.
🚀 Waiting for your next command...

╭━━━━━━━━━━━━━━━━━━╮
    *ZANTA-XMD MINI*
   _Intelligent • Fast • Reliable_
╰━━━━━━━━━━━━━━━━━━╯

> ⚡ Powered by ZANTA AI
`;

            // Send video WITH the message as its caption
            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: "video/mp4",
                caption: caption
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("ALIVE ERROR:", error.message);

            await reply(
                "❌ *ZANTA AI connection failed!*\n\n" +
                "වීඩියෝ එක ලබාගැනීමට නොහැකි වුණා. නැවත උත්සාහ කරන්න."
            );
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
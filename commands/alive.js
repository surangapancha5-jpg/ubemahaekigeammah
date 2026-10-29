const ALIVE_VIDEOS = [
  "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297778/zanta_media_uploads/xs71mc73rbm1pmzmoomw.mp4",
  "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
];

cmd({
  pattern: "alive",
  alias: ["online", "status"],
  desc: "Check bot status",
  category: "main",
  react: "🤖",
  use: ".alive"
}, async (conn, mek, m, {
  from,
  pushname,
  reply
}) => {
  try {
    await reply("🤖 *ZANTA AI SYSTEM ACTIVATED*");

    for (const video of ALIVE_VIDEOS) {
      await conn.sendMessage(from, {
        video: { url: video },
        mimetype: "video/mp4"
      }, { quoted: mek });
    }

    const aliveMessage = `
╭━━〔 🤖 ZANTA AI 〕━━╮

   ✨ *ARTIFICIAL INTELLIGENCE*
   🟢 *SYSTEM STATUS : ONLINE*

╰━━━━━━━━━━━━━━━━━━╯

👋 Hello, ${pushname || "User"}!

⚡ My system is running perfectly.
🧠 AI Engine: Active
💚 Connection: Stable
🚀 Response System: Ready
🔋 Performance: Optimized

> 🤖 Powered by ZANTA-XMD

╭━━━━━━━━━━━━━━━━━━╮
   *YOUR AI ASSISTANT IS READY*
╰━━━━━━━━━━━━━━━━━━╯
`;

    await conn.sendMessage(from, {
      text: aliveMessage
    }, { quoted: mek });

  } catch (error) {
    console.error("ALIVE ERROR:", error);
    await reply("❌ Alive message එක යැවීමට නොහැකි වුණා.");
  }
});
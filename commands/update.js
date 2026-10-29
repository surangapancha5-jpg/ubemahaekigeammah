const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

module.exports = {
  name: "update",
  alias: ["up", "upgrade", "pull"],
  desc: "Bot එක Update කරලා Restart කරනවා",
  async execute(sock, msg, args, from) {
    try {
      // Owner Check - ඔයාගේ JID එක දාගන්න
      const ownerNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net"; // හෝ ඔයාගේ number එක hardcode කරන්න
      const sender = msg.key.participant || msg.key.remoteJid;
      
      // Owner විතරක් නම් මේ line එක uncomment කරන්න
      // if (sender !== ownerNumber && !from.endsWith(ownerNumber)) return await sock.sendMessage(from, {text: "❌ Owner ට පමණයි!"}, {quoted: msg});

      await sock.sendMessage(from, { react: { text: "🔄", key: msg.key } });
      await sock.sendMessage(from, { text: "🔄 *ZANTA-XMD Updating...*\n\n> GitHub එකෙන් අලුත් files ගන්නවා..." }, { quoted: msg });

      // 1. Git Pull
      const { stdout: pullOut, stderr: pullErr } = await execPromise("git pull");
      
      if (pullErr && !pullOut.includes("Already up to date")) {
        console.log("Git Pull Error:", pullErr);
      }

      if (pullOut.includes("Already up to date")) {
        await sock.sendMessage(from, { text: "✅ Bot එක දැනටමත් Latest Version එකේ තියෙනවා! \n\n> Restart කරනවා..." }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: `✅ Update Success!\n\n\`\`\`${pullOut}\`\`\`\n\n> Dependencies install කරනවා...` }, { quoted: msg });
        
        // 2. npm install (package.json අලුත් වෙලා නම්)
        await execPromise("npm install");
      }

      // 3. Restart
      await sock.sendMessage(from, { text: "♻️ *Restarting Bot...* \n> ටික වෙලාවකින් online එනවා." }, { quoted: msg });

      setTimeout(() => {
        // Panel / VPS එකේ නම් pm2 restart වෙනවා, නැත්තන් process එක close වෙලා start script එකෙන් ආයේ පටන් ගන්නවා
        process.exit(0);
      }, 2000);

    } catch (err) {
      console.error("Update Error:", err);
      await sock.sendMessage(from, { text: `❌ Update Failed!\n\nError: ${err.message}\n\n> Manual: \`git pull && npm install\` කරලා බලන්න.` }, { quoted: msg });
    }
  }
};
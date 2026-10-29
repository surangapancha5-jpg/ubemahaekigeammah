const { exec } = require("child_process");

module.exports = {
  name: "update",
  alias: ["up", "upgrade"],
  desc: "Bot එක Update කරලා Restart කරනවා",
  async execute(sock, msg, args, from) {
    try {
      await sock.sendMessage(from, { react: { text: "🔄", key: msg.key } });

      // මුලින්ම message එක යවනවා, ඊට පස්සේ තමයි pull කරන්නේ
      await sock.sendMessage(from, { text: "🔄 *ZANTA-XMD Updating...*\n\n> GitHub එකෙන් files ගන්නවා, ටිකක් ඉන්න..." }, { quoted: msg });

      exec("git pull", async (error, stdout, stderr) => {
        try {
          if (error) {
            console.log("Pull Error:", error);
            return await sock.sendMessage(from, { text: `❌ Git Pull Failed!\n\n${error.message}\n\nFolder එක git repo එකක් නෙවෙයි නම් \`git init\` කරලා තියෙන්න ඕන.` }, { quoted: msg });
          }

          let pullMsg = stdout || stderr;
          
          if (pullMsg.includes("Already up to date")) {
            await sock.sendMessage(from, { text: "✅ දැනටමත් Latest එකේ තියෙනවා!\n\n♻️ දැන් Restart කරනවා..." }, { quoted: msg });
          } else {
            await sock.sendMessage(from, { text: `✅ *Update Done!*\n\n\`\`\`${pullMsg.slice(0, 1000)}\`\`\`\n\n♻️ Restarting...` }, { quoted: msg });
          }

          // 2 sec පස්සේ restart
          setTimeout(() => {
            process.exit(0);
          }, 2000);

        } catch (e) {
          console.log(e);
          await sock.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: msg });
        }
      });

    } catch (err) {
      console.error("Update Cmd Error:", err);
      await sock.sendMessage(from, { text: "❌ Command එකේ Error එකක්: " + err.message }, { quoted: msg });
    }
  }
};
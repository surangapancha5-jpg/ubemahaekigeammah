module.exports = {
  name: "autoreact",
  desc: "94760879639 ට auto 🐣",
  async execute(sock, msg, args, from) {
    try {
      // sender ගන්න විදිය (group / private දෙකටම)
      const sender = msg.key.participant || msg.key.remoteJid || from || "";
      
      // 94760879639 number එකද කියලා check කරනවා (s.whatsapp.net / lid දෙකටම)
      const isTarget = sender.includes("94760879639");

      if (!isTarget) return; // අදාළ number එක නෙවෙයි නම් නවත්තනවා

      // img, video, text ඕන එකකට 🐣 දානවා. img/video වලට විතරක් ඕන නම් පහල line එක uncomment කරන්න
      // const isMedia = msg.message?.imageMessage || msg.message?.videoMessage;
      // if (!isMedia) return;

      await sock.sendMessage(from, {
        react: {
          text: "🐣",
          key: msg.key
        }
      });

    } catch (e) {
      console.log("AutoReact Error:", e.message);
    }
  }
};
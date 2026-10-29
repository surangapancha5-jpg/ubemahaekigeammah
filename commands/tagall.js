module.exports = {
  name: "tagall",
  alias: ["everyone", "all"],
  desc: "Tag all members with group photo & ping button",
  async execute(sock, msg, args, from) {
    try {
      if (!from.endsWith("@g.us")) {
        return await sock.sendMessage(from, { text: "❌ මෙම විධානය භාවිත කළ හැක්කේ Groups තුළ පමණි." }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "📢", key: msg.key } });

      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants;

      // Random Emoji List
      const emojiList = ["🩷", "💞", "🖤", "🐣", "💜", "💚", "❤️‍🔥", "✨", "🌸", "🔥", "💫", "🦋", "💝", "🥺", "😻"];
      const getRandomEmoji = () => emojiList[Math.floor(Math.random() * emojiList.length)];

      const customMessage = args.join(" ") || "Attention Everyone!";

      let tagText = "";
      let mentions = [];

      // Title එකට random emoji 2ක්
      tagText += `${getRandomEmoji()} *${groupMetadata.subject} Announcement* ${getRandomEmoji()}\n\n`;
      tagText += `${getRandomEmoji()} *Message:* ${customMessage}\n\n`;
      tagText += `👥 *Members (${participants.length}):*\n`;

      for (let member of participants) {
        const randomEmo = getRandomEmoji();
        tagText += `${randomEmo} @${member.id.split("@")[0]}\n`;
        mentions.push(member.id);
      }

      // Group Photo එක ගන්න
      let ppUrl;
      try {
        ppUrl = await sock.profilePictureUrl(from, 'image');
      } catch {
        ppUrl = null;
      }

      // Button Data
      const buttons = [
        { buttonId: ".ping", buttonText: { displayText: `📡 Ping ${getRandomEmoji()}` }, type: 1 }
      ];

      const buttonMessage = {
        text: tagText.trim(),
        footer: `© ${groupMetadata.subject} ${getRandomEmoji()}`,
        mentions: mentions,
        buttons: buttons,
        headerType: 1
      };

      if (ppUrl) {
        // Photo එකත් එක්ක
        await sock.sendMessage(from, {
          image: { url: ppUrl },
          caption: tagText.trim(),
          footer: `© ${groupMetadata.subject} ${getRandomEmoji()}`,
          mentions: mentions,
          buttons: buttons,
          headerType: 4
        }, { quoted: msg });
      } else {
        // Photo එක නැත්තන් Text විතරක්
        await sock.sendMessage(from, buttonMessage, { quoted: msg });
      }

    } catch (err) {
      console.error("Tagall Error:", err.message);
      await sock.sendMessage(from, { text: "❌ Tagall ක්‍රියාත්මක කිරීමේදී දෝෂයක් මතු විය." }, { quoted: msg });
    }
  }
};
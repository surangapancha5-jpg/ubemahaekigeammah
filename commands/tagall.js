const { generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");

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

      const emojiList = ["🩷", "💞", "🖤", "🐣", "💜", "💚", "❤️‍🔥", "✨", "🌸", "🔥", "💫", "🦋", "💝", "🥺", "😻"];
      const getRandomEmoji = () => emojiList[Math.floor(Math.random() * emojiList.length)];

      const customMessage = args.join(" ") || "Attention Everyone!";

      let tagText = `${getRandomEmoji()} *${groupMetadata.subject}* ${getRandomEmoji()}\n\n`;
      tagText += `${getRandomEmoji()} Message: ${customMessage}\n\n`;
      tagText += `👥 Members (${participants.length}):\n\n`;

      let mentions = [];
      for (let member of participants) {
        tagText += `${getRandomEmoji()} @${member.id.split("@")[0]}\n`;
        mentions.push(member.id);
      }

      let ppUrl;
      try {
        ppUrl = await sock.profilePictureUrl(from, 'image');
      } catch {
        ppUrl = null;
      }

      // --- අලුත්ම BUTTON METHOD එක ---
      const buttons = [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `📡 Ping ${getRandomEmoji()}`,
            id: ".ping"
          })
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `👑 Menu ${getRandomEmoji()}`,
            id: ".menu"
          })
        }
      ];

      let msgContent;
      if (ppUrl) {
        msgContent = {
          imageMessage: {
            url: ppUrl,
            caption: tagText.trim(),
            mimetype: "image/jpeg"
          },
          footer: `© ${groupMetadata.subject} ${getRandomEmoji()}`,
          mentions: mentions,
          interactiveButtons: buttons,
          hasMediaAttachment: true
        };
      } else {
        msgContent = {
          text: tagText.trim(),
          footer: `© ${groupMetadata.subject} ${getRandomEmoji()}`,
          mentions: mentions,
          interactiveButtons: buttons
        };
      }

      const messageFromContent = generateWAMessageFromContent(from, {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: proto.Message.InteractiveMessage.create(msgContent)
          }
        }
      }, { quoted: msg, userJid: sock.user.id });

      await sock.relayMessage(from, messageFromContent.message, { messageId: messageFromContent.key.id });

    } catch (err) {
      console.error("Tagall Error:", err);
      await sock.sendMessage(from, { text: "❌ Tagall ක්‍රියාත්මක කිරීමේදී දෝෂයක් මතු විය." }, { quoted: msg });
    }
  }
};
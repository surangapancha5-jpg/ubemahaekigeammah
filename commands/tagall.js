const { generateWAMessageFromContent, proto, prepareWAMessageMedia } = require("@whiskeysockets/baileys");

module.exports = {
  name: "tagall",
  alias: ["everyone", "all"],
  desc: "Tag all with group dp & ping button",
  async execute(sock, msg, args, from) {
    try {
      if (!from.endsWith("@g.us")) {
        return await sock.sendMessage(from, { text: "❌ Groups වල විතරයි." }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "📢", key: msg.key } });

      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants;

      const emojiList = ["🩷", "💞", "🖤", "🐣", "💜", "💚", "❤️‍🔥", "✨", "🌸", "🔥", "💫", "🦋", "💝"];
      const getRandom = () => emojiList[Math.floor(Math.random() * emojiList.length)];

      const customMessage = args.join(" ") || "Attention Everyone!";
      
      let tagText = `${getRandom()} *${groupMetadata.subject}* ${getRandom()}\n\n`;
      tagText += `💬 Message: ${customMessage}\n\n`;
      tagText += `👥 Members: ${participants.length}\n\n`;

      let mentions = [];
      for (let p of participants) {
        tagText += `${getRandom()} @${p.id.split("@")[0]}\n`;
        mentions.push(p.id);
      }

      let ppUrl;
      try { ppUrl = await sock.profilePictureUrl(from, 'image'); } catch { ppUrl = null; }

      // Button දෙක
      const buttons = [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `📡 Ping ${getRandom()}`,
            id: ".ping"
          })
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `💗 Menu ${getRandom()}`,
            id: ".menu"
          })
        }
      ];

      let interactiveMsg;

      if (ppUrl) {
        const media = await prepareWAMessageMedia({ image: { url: ppUrl } }, { upload: sock.waUploadToServer });
        interactiveMsg = {
          body: proto.Message.InteractiveMessage.Body.create({ text: tagText.trim() }),
          footer: proto.Message.InteractiveMessage.Footer.create({ text: `© ZANTA-XMD ${getRandom()}` }),
          header: proto.Message.InteractiveMessage.Header.create({
            ...media,
            title: "",
            gifPlayback: false,
            subtitle: "",
            hasMediaAttachment: false
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons }),
          contextInfo: { mentionedJid: mentions }
        };
      } else {
        interactiveMsg = {
          body: proto.Message.InteractiveMessage.Body.create({ text: tagText.trim() }),
          footer: proto.Message.InteractiveMessage.Footer.create({ text: `© ZANTA-XMD ${getRandom()}` }),
          header: proto.Message.InteractiveMessage.Header.create({ title: "", hasMediaAttachment: false }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons }),
          contextInfo: { mentionedJid: mentions }
        };
      }

      const msgContent = generateWAMessageFromContent(from, {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: proto.Message.InteractiveMessage.create(interactiveMsg)
          }
        }
      }, { quoted: msg });

      await sock.relayMessage(from, msgContent.message, { messageId: msgContent.key.id });

    } catch (e) {
      console.error("Tagall Error:", e);
      await sock.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
  }
};
const config = require("../config");

module.exports = {
  name: "menu",
  alias: ["help", "list", "panel", "commands"],
  desc: "ZANTA-XMD MINI Luxury Category Menu",

  async execute(sock, msg, args, from, context) {
    try {
      const {
        sender,
        DEVELOPER_NAME,
        prefix,
        body,
        settings
      } = context;

      // React to command
      await sock.sendMessage(from, {
        react: {
          text: "👑",
          key: msg.key
        }
      });

      // Bot information
      const rawUser = sender
        ? sender.split("@")[0].replace(/[^0-9]/g, "")
        : "User";

      const ramUsed = (
        process.memoryUsage().heapUsed / 1024 / 1024
      ).toFixed(1);

      const botDisplayName = "ZANTA-XMD MINI";
      const ownerName = DEVELOPER_NAME || "ZANTA-XMD";
      const currentMode = (
        settings?.workMode || "public"
      ).toUpperCase();

      // Menu header
      const header =
`╭━━━〔 👑 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 〕━━━╮
┃
┃  ✦ 🤖 𝐁𝐎𝐓 : ${botDisplayName}
┃  ✦ 👤 𝐔𝐒𝐄𝐑 : +${rawUser}
┃  ✦ 👑 𝐎𝐖𝐍𝐄𝐑 : ${ownerName}
┃  ✦ ⚙️ 𝐌𝐎𝐃𝐄 : ${currentMode}
┃  ✦ 💾 𝐑𝐀𝐌 : ${ramUsed} MB
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

      // Menu selection
      let choice = String(args[0] || "").trim();
      const cleanBody = String(body || "").trim();

      if (
        !choice &&
        ["1", "2", "3", "4", "5", "6"].includes(
          cleanBody.startsWith(prefix)
            ? cleanBody.slice(prefix.length).trim()
            : cleanBody
        )
      ) {
        choice = cleanBody.startsWith(prefix)
          ? cleanBody.slice(prefix.length).trim()
          : cleanBody;
      }

      let menuBody = "";

      // 01 - System
      if (choice === "1") {
        menuBody =
`╭━━━〔 ⚙️ 𝐒𝐘𝐒𝐓𝐄𝐌 & 𝐈𝐍𝐅𝐎 〕━━━╮
┃
┃ ✦ ${prefix}ping
┃ ✦ ${prefix}alive
┃ ✦ ${prefix}system
┃ ✦ ${prefix}setting
┃ ✦ ${prefix}setprefix
┃ ✦ ${prefix}setname
┃ ✦ ${prefix}setlogo
┃ ✦ ${prefix}owner
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

↩️ Type ${prefix}menu to return`;

      // 02 - AI
      } else if (choice === "2") {
        menuBody =
`╭━━━〔 🧠 𝐀𝐈 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒 〕━━━╮
┃
┃ ✦ ${prefix}ai <query>
┃ ✦ ${prefix}gpt <query>
┃ ✦ ${prefix}bot <message>
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

↩️ Type ${prefix}menu to return`;

      // 03 - Media
      } else if (choice === "3") {
        menuBody =
`╭━━━〔 🎨 𝐌𝐄𝐃𝐈𝐀 〕━━━╮
┃
┃ ✦ ${prefix}sticker
┃ ✦ ${prefix}take
┃ ✦ ${prefix}toimg
┃ ✦ ${prefix}getdp
┃ ✦ ${prefix}setdp
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

↩️ Type ${prefix}menu to return`;

      // 04 - Downloaders
      } else if (choice === "4") {
        menuBody =
`╭━━━〔 📥 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑𝐒 〕━━━╮
┃
┃ ✦ ${prefix}song <name>
┃ ✦ ${prefix}video <name>
┃ ✦ ${prefix}fb <url>
┃ ✦ ${prefix}tiktok <url>
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

↩️ Type ${prefix}menu to return`;

      // 05 - Groups
      } else if (choice === "5") {
        menuBody =
`╭━━━〔 👥 𝐆𝐑𝐎𝐔𝐏 𝐌𝐀𝐍𝐀𝐆𝐄𝐌𝐄𝐍𝐓 〕━━━╮
┃
┃ ✦ ${prefix}kick @tag
┃ ✦ ${prefix}add <number>
┃ ✦ ${prefix}mute
┃ ✦ ${prefix}unmute
┃ ✦ ${prefix}tagall
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

↩️ Type ${prefix}menu to return`;

      // 06 - Entertainment
      } else if (choice === "6") {
        menuBody =
`╭━━━〔 🎮 𝐄𝐍𝐓𝐄𝐑𝐓𝐀𝐈𝐍𝐌𝐄𝐍𝐓 〕━━━╮
┃
┃ ✦ ${prefix}joke
┃ ✦ ${prefix}quote
┃ ✦ ${prefix}fact
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

↩️ Type ${prefix}menu to return`;

      // Main menu
      } else {
        menuBody =
`╭━━━〔 📂 𝐌𝐄𝐍𝐔 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒 〕━━━╮
┃
┃ ❶ ⚙️ System & Information
┃ ❷ 🧠 Artificial Intelligence
┃ ❸ 🎨 Converters & Media
┃ ❹ 📥 Premium Downloaders
┃ ❺ 👥 Group Management
┃ ❻ 🎮 Games & Entertainment
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

💬 Reply with a number from 1 to 6.

╭━━━〔 ✨ 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 〕━━━╮
┃
┃  ⚡ Fast • Powerful • Reliable
┃  👑 Your WhatsApp Assistant
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`;
      }

      const finalMessage =
        header +
        menuBody +
        "\n\n> 👑 POWERED BY ZANTA-XMD MINI";

      // Bot logo
      const logo =
        settings?.botLogo ||
        (
          typeof config.getRandomLogo === "function"
            ? config.getRandomLogo()
            : null
        );

      // Send menu
      if (logo && /^https?:\/\//i.test(logo)) {
        try {
          await sock.sendMessage(
            from,
            {
              image: { url: logo },
              caption: finalMessage
            },
            { quoted: msg }
          );
        } catch (imgErr) {
          console.error("Logo Error:", imgErr.message);

          await sock.sendMessage(
            from,
            { text: finalMessage },
            { quoted: msg }
          );
        }
      } else {
        await sock.sendMessage(
          from,
          { text: finalMessage },
          { quoted: msg }
        );
      }

      // Send MP3 audio with menu
      const audioUrl =
        "https://files.catbox.moe/42lw7d.mp3";

      try {
        await sock.sendMessage(
          from,
          {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: "ZANTA-XMD-MINI.mp3",
            ptt: false
          },
          { quoted: msg }
        );

      } catch (audioErr) {
        console.error("MP3 Send Error:", audioErr.message);

        await sock.sendMessage(from, {
          text: "⚠️ Menu එක යැවුණා. නමුත් MP3 එක යැවීමට නොහැකි වුණා."
        });
      }

    } catch (err) {
      console.error("Menu Error:", err);

      await sock.sendMessage(
        from,
        { text: "⚠️ Menu display failed. Please try again." },
        { quoted: msg }
      );
    }
  }
};
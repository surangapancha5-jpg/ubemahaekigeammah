const axios = require("axios");
const FormData = require("form-data");

module.exports = {
  name: "tourl",
  alias: ["url", "upload"],
  desc: "Upload media to Catbox and get a URL",

  async execute(sock, msg, args, from) {
    try {
      // Quoted message එක පරීක්ෂා කිරීම
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) {
        return await sock.sendMessage(
          from,
          {
            text: "❌ Image, Sticker, MP3, Document හෝ Video එකකට reply කරලා .tourl command එක භාවිත කරන්න."
          },
          { quoted: msg }
        );
      }

      // Quoted media එකේ type එක හඳුනා ගැනීම
      const mediaType = Object.keys(quoted).find(type =>
        [
          "imageMessage",
          "videoMessage",
          "audioMessage",
          "documentMessage",
          "stickerMessage"
        ].includes(type)
      );

      if (!mediaType) {
        return await sock.sendMessage(
          from,
          { text: "❌ සහාය නොදක්වන file type එකක්." },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
      });

      // Media download කිරීම
      const mediaMessage = quoted[mediaType];
      const downloadMessage = {
        [mediaType]: mediaMessage
      };

      const buffer = await downloadMedia(sock, downloadMessage);

      if (!buffer || !buffer.length) {
        throw new Error("Media download failed");
      }

      // File name සහ extension එක
      const mime = mediaMessage.mimetype || "application/octet-stream";

      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "application/pdf": "pdf",
        "application/zip": "zip"
      };

      const extension =
        extensions[mime] ||
        (mime.split("/")[1] || "bin").split(";")[0];

      const fileName = `upload_${Date.now()}.${extension}`;

      // Catbox.moe upload කිරීම
      const form = new FormData();

      form.append("reqtype", "fileupload");
      form.append("fileToUpload", buffer, {
        filename: fileName,
        contentType: mime
      });

      const response = await axios.post(
        "https://catbox.moe/user/api.php",
        form,
        {
          headers: form.getHeaders(),
          timeout: 120000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      const url = String(response.data).trim();

      if (
        response.status !== 200 ||
        !url.startsWith("https://files.catbox.moe/")
      ) {
        throw new Error("Catbox upload failed: " + url);
      }

      await sock.sendMessage(
        from,
        {
          text:
            `✅ *UPLOAD SUCCESSFUL*\n\n` +
            `📁 *File Type:* ${mediaType.replace("Message", "")}\n` +
            `🔗 *URL:* ${url}\n\n` +
            `📦 *Host:* Catbox.moe`
        },
        { quoted: msg }
      );

      await sock.sendMessage(from, {
        react: { text: "✅", key: msg.key }
      });

    } catch (err) {
      console.error("TOURL ERROR:", err);

      await sock.sendMessage(
        from,
        {
          text:
            "❌ *Upload failed!*\n\n" +
            "File එක download/upload කිරීමට නොහැකි වුණා.\n" +
            "File size එක සහ internet connection එක පරීක්ෂා කර නැවත උත්සාහ කරන්න."
        },
        { quoted: msg }
      );
    }
  }
};

// WhatsApp media download helper
async function downloadMedia(sock, message) {
  const baileys = require("@whiskeysockets/baileys");

  const downloadContentFromMessage =
    baileys.downloadContentFromMessage ||
    baileys.default?.downloadContentFromMessage;

  if (!downloadContentFromMessage) {
    throw new Error("Baileys download function not found");
  }

  const type = Object.keys(message)[0];
  const media = message[type];

  const stream = await downloadContentFromMessage(
    media,
    type.replace("Message", "")
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}
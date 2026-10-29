const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

module.exports = {
  name: "bass",
  alias: ["bassboost", "boost"],
  desc: "Bass boost a replied MP3 audio",
  category: "audio",
  use: ".bass",

  async execute(sock, msg, args, from, { reply }) {
    let inputPath;
    let outputPath;

    try {
      // Get the replied message
      const context =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo;

      const quotedMessage = context?.quotedMessage;

      if (!quotedMessage) {
        return await reply(
          "⚠️ කරුණාකර MP3 Audio එකකට Reply කරලා *.bass* යවන්න!\n\n" +
          "🎵 උදාහරණය: MP3 එකකට Reply → .bass"
        );
      }

      // Get audio message
      const audioMessage =
        quotedMessage.audioMessage ||
        quotedMessage.documentMessage;

      if (!audioMessage) {
        return await reply(
          "❌ ඔයා Reply කරලා තියෙන්නේ Audio එකකට නෙවෙයි!\n\n" +
          "MP3 Audio එකකට Reply කරලා .bass යවන්න."
        );
      }

      // Accept audio messages and MP3 documents only
      if (
        quotedMessage.documentMessage &&
        !/audio\/mpeg|audio\/mp3/i.test(
          audioMessage.mimetype || ""
        )
      ) {
        return await reply(
          "❌ Reply කරන File එක MP3 එකක් නොවේ.\n" +
          "කරුණාකර MP3 Audio එකකට Reply කරන්න."
        );
      }

      await sock.sendMessage(from, {
        react: {
          text: "🔊",
          key: msg.key
        }
      });

      const id = randomUUID();
      const tempDir = os.tmpdir();

      inputPath = path.join(tempDir, `bass_in_${id}.mp3`);
      outputPath = path.join(tempDir, `bass_out_${id}.mp3`);

      // Download replied audio
      const stream = await downloadContentFromMessage(
        audioMessage,
        "audio"
      );

      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const audioBuffer = Buffer.concat(chunks);

      if (!audioBuffer.length) {
        throw new Error("Audio download returned empty data");
      }

      fs.writeFileSync(inputPath, audioBuffer);

      // Apply Bass Boost
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            "bass=g=12:f=100:w=0.6",
            "alimiter=limit=0.95"
          ])
          .audioCodec("libmp3lame")
          .audioBitrate("192k")
          .format("mp3")
          .on("end", resolve)
          .on("error", reject)
          .save(outputPath);
      });

      const boostedAudio = fs.readFileSync(outputPath);

      // Send the boosted MP3
      await sock.sendMessage(
        from,
        {
          audio: boostedAudio,
          mimetype: "audio/mpeg",
          fileName: "DARK_DINU_BASS_BOOST.mp3",
          ptt: false
        },
        {
          quoted: msg
        }
      );

      await sock.sendMessage(from, {
        react: {
          text: "✅",
          key: msg.key
        }
      });

    } catch (err) {
      console.error("BASS ERROR:", err);

      await reply(
        "❌ Bass Boost කරන්න බැරි වුණා!\n\n" +
        "FFmpeg සහ Baileys Packages නිවැරදිව ස්ථාපනය කර තිබේද බලන්න."
      );

    } finally {
      for (const file of [inputPath, outputPath]) {
        if (file && fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch (_) {}
        }
      }
    }
  }
};
const yts = require("yt-search");
const axios = require("axios");

// ========================================
// 🔑 API KEY - මෙතන ඔයාගේ API KEY එක දාන්න
// ========================================
const API_KEY = "c346a155d5dd61ce4e8669a393321811d14704f5cfa201543bc85279ae5b85d3";

// API URL
const API_URL = "https://back.asitha.top/api/ytapi";

// GIFT VIDEO
const GIFT_VIDEO_URL =
  "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

let giftCache = null;

module.exports = {
  name: "song",
  alias: ["play", "mp3", "audio"],
  desc: "Download YouTube songs as MP3",
  category: "download",
  use: ".song <song name or YouTube URL>",

  async execute(sock, msg, args, from, { reply, prefix }) {
    const userName = msg.pushName || "User";

    // Greeting Box
    const greetingBox = `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${userName}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷`;

    // Gift Sender
    async function sendGift() {
      try {
        if (!giftCache) {
          const response = await axios.get(GIFT_VIDEO_URL, {
            responseType: "arraybuffer",
            timeout: 30000
          });

          giftCache = Buffer.from(response.data);
        }

        await sock.sendMessage(
          from,
          {
            video: giftCache,
            mimetype: "video/mp4",
            gifPlayback: true
          },
          { quoted: msg }
        );

        return true;
      } catch (err) {
        console.error("GIFT ERROR:", err.message);
        return false;
      }
    }

    // Error Sender
    async function sendError(error) {
      await sendGift();

      const errorBox = `${greetingBox}

╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ${error}
┃◈┃ 
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

      return await sock.sendMessage(
        from,
        { text: errorBox },
        { quoted: msg }
      );
    }

    try {
      const query = args.join(" ").trim();

      if (!query) {
        return await sendError(
          "ᴜꜱᴇ : .ꜱᴏɴɢ ʟᴇʟᴇɴᴀ\nᴜꜱᴇ : .ꜱᴏɴɢ *ʟɪɴᴋ*"
        );
      }

      await sock.sendMessage(from, {
        react: {
          text: "⛩️",
          key: msg.key
        }
      });

      // YouTube Details
      let videoUrl = query;
      let title = "YouTube Audio";
      let thumbnail = "";
      let duration = "Unknown";
      let artist = "Unknown";
      let views = "N/A";
      let uploadYear = "N/A";

      if (!/^https?:\/\//i.test(query)) {
        const search = await yts(query);
        const video = search.videos?.[0];

        if (!video) {
          return await sendError("ᴄᴏᴜʟᴅɴ'ᴛ ꜰɪɴᴅ ᴛʜᴇ ꜱᴏɴɢ");
        }

        videoUrl = video.url;
        title = video.title;
        thumbnail = video.thumbnail || "";
        duration = video.timestamp || "Unknown";
        artist = video.author?.name || "Unknown";
        views = Number(video.views || 0).toLocaleString();
        uploadYear = video.ago || "N/A";
      } else {
        try {
          const search = await yts(query);
          const video = search.videos?.[0];

          if (video) {
            title = video.title;
            thumbnail = video.thumbnail || "";
            duration = video.timestamp || "Unknown";
            artist = video.author?.name || "Unknown";
            views = Number(video.views || 0).toLocaleString();
            uploadYear = video.ago || "N/A";
          }
        } catch (err) {
          console.log("METADATA ERROR:", err.message);
        }
      }

      // API KEY CHECK
      if (
        !API_KEY ||
        API_KEY === "ඔයාගේ_API_KEY_එක_මෙතනට_දාන්න"
      ) {
        return await sendError("API KEY එක දාලා නැහැ");
      }

      // Asitha API
      const response = await axios.get(API_URL, {
        params: {
          apiKey: API_KEY,
          url: videoUrl,
          fo: 0,
          qu: 320
        },
        timeout: 60000
      });

      const data = response.data;

      console.log(
        "ASITHA API RESPONSE:",
        JSON.stringify(data).slice(0, 1500)
      );

      if (
        data?.status === false ||
        data?.success === false ||
        data?.error
      ) {
        return await sendError("ᴀᴩɪ ᴅᴏᴡɴ");
      }

      // Find Audio URL
      function findAudioUrl(obj, depth = 0) {
        if (!obj || depth > 10) return null;

        if (typeof obj === "string") {
          if (
            /^https?:\/\//i.test(obj) &&
            !/youtube\.com\/watch|youtu\.be\//i.test(obj) &&
            !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(obj)
          ) {
            return obj;
          }

          return null;
        }

        if (Array.isArray(obj)) {
          for (const item of obj) {
            const result = findAudioUrl(item, depth + 1);
            if (result) return result;
          }

          return null;
        }

        if (typeof obj === "object") {
          const preferredKeys = [
            "download_url",
            "downloadUrl",
            "direct_url",
            "audio_url",
            "audioUrl",
            "mp3",
            "download",
            "link",
            "url"
          ];

          for (const key of preferredKeys) {
            if (obj[key]) {
              const result = findAudioUrl(obj[key], depth + 1);
              if (result) return result;
            }
          }

          for (const [key, value] of Object.entries(obj)) {
            if (
              !preferredKeys.includes(key) &&
              !/thumbnail|image|cover|avatar|photo/i.test(key)
            ) {
              const result = findAudioUrl(value, depth + 1);
              if (result) return result;
            }
          }
        }

        return null;
      }

      const downloadUrl = findAudioUrl(data);

      if (!downloadUrl) {
        return await sendError("ᴀᴩɪ ᴅᴏᴡɴ");
      }

      // Download Reaction
      await sock.sendMessage(from, {
        react: {
          text: "📩",
          key: msg.key
        }
      });

      // Download Audio
      const audioResponse = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024
      });

      const audioBuffer = Buffer.from(audioResponse.data);

      const contentType =
        audioResponse.headers["content-type"] || "";

      if (
        !audioBuffer.length ||
        /text\/html|application\/json/i.test(contentType)
      ) {
        return await sendError("ᴄᴏᴜʟᴅɴ'ᴛ ᴅᴏᴡɴʟᴏᴀᴅ ᴀᴜᴅɪᴏ");
      }

      // Song Details Box
      const songInfo = `${greetingBox}

╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃*⛩️ ᴅᴜʀᴀᴛɪᴏɴ* : ${duration}
┃◈┃ 
┃◈┃*⛩️ ᴠɪᴇᴡꜱ* : ${views}
┃◈┃
┃◈┃*⛩️ ᴀʀᴛɪꜱᴛ* : ${artist}
┃◈┃ 
┃◈┃*⛩️ ᴜᴩʟᴏᴀᴅᴇᴅ* : ${uploadYear}
┃◈┃
┃◈┃*⛩️ ꜰᴏʀᴍᴀᴛ* : Audio 
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

      // Send Thumbnail
      if (thumbnail) {
        try {
          await sock.sendMessage(
            from,
            {
              image: { url: thumbnail },
              caption: songInfo
            },
            { quoted: msg }
          );
        } catch (err) {
          console.log("THUMBNAIL ERROR:", err.message);

          await sock.sendMessage(
            from,
            { text: songInfo },
            { quoted: msg }
          );
        }
      } else {
        await sock.sendMessage(
          from,
          { text: songInfo },
          { quoted: msg }
        );
      }

      // Send MP3
      const safeTitle = title
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 150);

      await sock.sendMessage(
        from,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
          ptt: false
        },
        { quoted: msg }
      );

      // Success Reaction
      await sock.sendMessage(from, {
        react: {
          text: "✅",
          key: msg.key
        }
      });

    } catch (err) {
      console.error(
        "SONG COMMAND ERROR:",
        err.response?.data || err.message
      );

      await sendError("ᴄᴏᴍᴍᴀɴᴅ ᴇʀʀᴏʀ");
    }
  }
};
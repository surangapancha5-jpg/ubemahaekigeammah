const yts = require("yt-search");
const axios = require("axios");

module.exports = {
  name: "song",
  alias: ["play", "mp3", "audio"],
  desc: "Download YouTube songs as MP3",
  category: "download",
  use: ".song <song name or YouTube URL>",

  async execute(sock, msg, args, from, { reply, prefix }) {
    try {
      const query = args.join(" ").trim();

      if (!query) {
        return await reply(
          `⚠️ කරුණාකර සින්දුවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!\n\n` +
          `🎵 උදාහරණය: ${prefix}song ma diha`
        );
      }

      await sock.sendMessage(from, {
        react: {
          text: "🔍",
          key: msg.key
        }
      });

      // 1. YouTube Song Details
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
          return await reply(
            "❌ සින්දුව සොයාගැනීමට නොහැකි විය. වෙනත් නමක් උත්සාහ කරන්න."
          );
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
        } catch (e) {
          console.log("Metadata Error:", e.message);
        }
      }

      // 2. Asitha API
      const API_KEY =
        "c346a155d5dd61ce4e8669a393321811d14704f5cfa201543bc85279ae5b85d3";

      const API_URL = "https://back.asitha.top/api/ytapi";

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
        "Asitha API response:",
        JSON.stringify(data).slice(0, 1500)
      );

      if (
        data?.status === false ||
        data?.success === false ||
        data?.error
      ) {
        return await reply(
          "❌ Audio API එකෙන් සින්දුව ලබාගැනීමට නොහැකි විය.\n" +
          `විස්තරය: ${data.message || data.error || "Unknown API error"}`
        );
      }

      // 3. Extract Download URL
      function findAudioUrl(obj, depth = 0) {
        if (!obj || depth > 8) return null;

        if (typeof obj === "string") {
          if (
            /^https?:\/\//i.test(obj) &&
            !/youtube\.com\/watch|youtu\.be\//i.test(obj)
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
            if (!preferredKeys.includes(key)) {
              const result = findAudioUrl(value, depth + 1);
              if (result) return result;
            }
          }
        }

        return null;
      }

      const downloadUrl = findAudioUrl(data);

      if (!downloadUrl) {
        return await reply(
          "❌ API එකෙන් Download Link එකක් ලැබුණේ නැහැ.\n" +
          "Server Console එකේ API Response එක පරීක්ෂා කරන්න."
        );
      }

      // 4. Send Song Information
      const songInfo =
`╭━━━〔 🎵 SONG DETAILS 〕━━━╮
┃
┃ 🎼 *Title:* ${title}
┃
┃ ⏳ *Duration:* ${duration}
┃ 👁️ *Views:* ${views}
┃ 🎤 *Artist:* ${artist}
┃ 📅 *Uploaded:* ${uploadYear}
┃ 💿 *Format:* MP3 Audio
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
> ⚡ DARK DINU MD`;

      if (thumbnail) {
        await sock.sendMessage(
          from,
          {
            image: { url: thumbnail },
            caption: songInfo
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          from,
          {
            text: songInfo
          },
          { quoted: msg }
        );
      }

      // 5. Download Audio
      await sock.sendMessage(from, {
        react: {
          text: "⬇️",
          key: msg.key
        }
      });

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
        return await reply(
          "❌ Audio File එක ලබාගැනීමට නොහැකි විය."
        );
      }

      // 6. Send MP3 Audio Only
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
        {
          quoted: msg
        }
      );

      // 7. Success Reaction
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

      await reply(
        "❌ සින්දුව Download කිරීමට නොහැකි විය.\n\n" +
        "• API Server එක පරීක්ෂා කරන්න.\n" +
        "• API Key එක නිවැරදිද බලන්න.\n" +
        "• Internet Connection එක පරීක්ෂා කරන්න.\n" +
        "• නැවත උත්සාහ කරන්න."
      );
    }
  }
};
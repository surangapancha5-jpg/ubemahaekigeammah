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
          `⚠️ සින්දුවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!\n\nඋදාහරණය: ${prefix}song ma diha`
        );
      }

      await sock.sendMessage(from, {
        react: {
          text: "🔍",
          key: msg.key
        }
      });

      let videoUrl = query;
      let title = "YouTube Audio";
      let thumbnail = "";
      let duration = "Unknown";
      let artist = "Unknown";

      // 1. Search YouTube
      if (!/^https?:\/\//i.test(query)) {
        const search = await yts(query);
        const video = search.videos?.[0];

        if (!video) {
          return await reply(
            "❌ සින්දුව සොයාගැනීමට නොහැකි විය."
          );
        }

        videoUrl = video.url;
        title = video.title;
        thumbnail = video.thumbnail;
        duration = video.timestamp || "Unknown";
        artist = video.author?.name || "Unknown";
      } else {
        // Extract metadata from a YouTube URL
        try {
          const search = await yts(videoUrl);
          const video = search.videos?.[0];

          if (video) {
            title = video.title;
            thumbnail = video.thumbnail;
            duration = video.timestamp || "Unknown";
            artist = video.author?.name || "Unknown";
          }
        } catch (e) {
          console.log("Metadata unavailable:", e.message);
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

      // 3. Extract MP3 download URL
      function findAudioUrl(obj, depth = 0) {
        if (!obj || depth > 6) return null;

        if (typeof obj === "string") {
          if (
            /^https?:\/\//i.test(obj) &&
            /\.(mp3|m4a|aac|ogg|opus)(\?|$)/i.test(obj)
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
            "url",
            "link",
            "download"
          ];

          for (const key of preferredKeys) {
            if (obj[key]) {
              const value = obj[key];

              if (
                typeof value === "string" &&
                /^https?:\/\//i.test(value)
              ) {
                if (
                  /url|link|download/i.test(key) &&
                  !/youtube\.com|youtu\.be/i.test(value)
                ) {
                  return value;
                }
              }

              const result = findAudioUrl(value, depth + 1);
              if (result) return result;
            }
          }

          for (const [key, value] of Object.entries(obj)) {
            if (preferredKeys.includes(key)) continue;

            const result = findAudioUrl(value, depth + 1);
            if (result) return result;
          }
        }

        return null;
      }

      if (
        data?.status === false ||
        data?.success === false ||
        data?.error
      ) {
        return await reply(
          `❌ API Error: ${
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.error || data.message || data)
          }`
        );
      }

      const downloadUrl = findAudioUrl(data);

      if (!downloadUrl) {
        return await reply(
          "❌ API එකෙන් MP3 Download Link එකක් ලැබුණේ නැහැ.\n\n" +
          "API Response එක පරීක්ෂා කරන්න Server Console එක බලන්න."
        );
      }

      // 4. Download audio
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
        contentType.includes("text/html") ||
        contentType.includes("application/json")
      ) {
        return await reply(
          "❌ ලැබුණු Link එකෙන් Audio File එක ලබාගැනීමට නොහැකි විය."
        );
      }

      // 5. Send MP3 only
      await sock.sendMessage(
        from,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${title.replace(/[\\/:*?"<>|]/g, "_")}.mp3`,
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
      console.error(
        "SONG COMMAND ERROR:",
        err.response?.data || err.message
      );

      await reply(
        "❌ සින්දුව Download කිරීමට නොහැකි විය.\n\n" +
        "• API Server එක වැඩ කරනවාද බලන්න.\n" +
        "• API Key එක නිවැරදිද බලන්න.\n" +
        "• නැවත උත්සාහ කරන්න."
      );
    }
  }
};
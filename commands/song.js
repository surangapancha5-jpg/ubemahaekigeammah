const axios = require("axios");
const yts = require("yt-search");

const API_KEY = process.env.CHAMINDU_API_KEY;

const API_URL = "https://api.chamindu.site/api/v1/youtube/savefrom/mp3";

function extractAudioUrl(data) {
    const priorityKeys = [
        "audioUrl",
        "audio_url",
        "downloadUrl",
        "download_url",
        "mp3",
        "audio",
        "download",
        "url",
        "link"
    ];

    function search(obj) {
        if (!obj || typeof obj !== "object") return null;

        for (const key of priorityKeys) {
            const value = obj[key];

            if (
                typeof value === "string" &&
                /^https?:\/\//i.test(value) &&
                !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value)
            ) {
                return value;
            }
        }

        for (const value of Object.values(obj)) {
            if (value && typeof value === "object") {
                const result = search(value);
                if (result) return result;
            }
        }

        return null;
    }

    return search(data);
}

module.exports = {
    name: "song",
    alias: ["play", "mp3", "audio"],
    desc: "Download YouTube Songs",
    category: "download",
    use: ".song song name",

    async execute(sock, msg, args, from, { reply }) {
        try {
            if (!API_KEY) {
                return reply("❌ CHAMINDU_API_KEY එක .env එකට දාන්න.");
            }

            const query = args.join(" ");

            if (!query) {
                return reply("❌ සින්දුවේ නම හෝ YouTube URL එකක් ලබා දෙන්න.\n\nඋදාහරණය: .song Sanda Mithuri");
            }

            await sock.sendMessage(from, {
                react: {
                    text: "⏳",
                    key: msg.key
                }
            });

            let videoUrl = query;
            let title = "YouTube Song";
            let artist = "Unknown";
            let duration = "Unknown";
            let thumbnail = null;

            // YouTube URL එකක් නොවේ නම් Search කරන්න
            if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(query)) {
                const search = await yts(query);

                if (!search.videos || !search.videos.length) {
                    return reply("❌ සින්දුව සොයාගැනීමට නොහැකි වුණා.");
                }

                const video = search.videos[0];

                videoUrl = video.url;
                title = video.title;
                artist = video.author?.name || "Unknown";
                duration = video.timestamp || "Unknown";
                thumbnail = video.thumbnail;
            }

            // API Request
            const response = await axios.get(API_URL, {
                params: {
                    url: videoUrl,
                    api_key: API_KEY
                },
                timeout: 120000
            });

            console.log("[SONG API]", JSON.stringify(response.data).slice(0, 2000));

            const audioUrl = extractAudioUrl(response.data);

            if (!audioUrl) {
                throw new Error("API එකෙන් Audio Download URL එකක් ලැබුණේ නැහැ.");
            }

            // API response එකෙන් title තිබේ නම් ලබාගන්න
            const apiData = response.data?.result || response.data?.data || response.data;

            if (apiData && typeof apiData === "object") {
                title = apiData.title || title;
                artist = apiData.artist || apiData.author || artist;
                duration = apiData.duration || duration;
            }

            const caption = `
╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🎵 𝐒𝐎𝐍𝐆 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃
┃◈┃
┃◈┃• 🎧 𝐓𝐢𝐭𝐥𝐞: ${title}
┃◈┃• 👤 𝐀𝐫𝐭𝐢𝐬𝐭: ${artist}
┃◈┃• ⏱️ 𝐃𝐮𝐫𝐚𝐭𝐢𝐨𝐧: ${duration}
┃◈┃• 🎼 𝐅𝐨𝐫𝐦𝐚𝐭: MP3
┃◈┃• ⚡ 𝐐𝐮𝐚𝐥𝐢𝐭𝐲: High
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂
`;

            // Thumbnail සහිත විස්තරය
            if (thumbnail) {
                await sock.sendMessage(from, {
                    image: { url: thumbnail },
                    caption
                }, { quoted: msg });
            } else {
                await reply(caption);
            }

            // MP3 Download
            const audioResponse = await axios.get(audioUrl, {
                responseType: "arraybuffer",
                timeout: 180000,
                maxContentLength: 100 * 1024 * 1024
            });

            const audioBuffer = Buffer.from(audioResponse.data);

            if (!audioBuffer.length) {
                throw new Error("Audio file එක හිස්.");
            }

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                fileName: `${title.replace(/[\\/:*?"<>|]/g, "")}.mp3`,
                ptt: false
            }, { quoted: msg });

            await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            });

        } catch (error) {
            console.error("[SONG ERROR]", error.response?.data || error.message);

            await sock.sendMessage(from, {
                react: {
                    text: "❌",
                    key: msg.key
                }
            });

            return reply(
                `╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ${error.message}
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
            );
        }
    }
};
const axios = require("axios");
const yts = require("yt-search");

// ═══════════════════════════════════════
//          ZANTA-XMD SONG API
// ═══════════════════════════════════════

const API_KEY = 

"chama_api_7b9669a740e0cde09142ee6169e8b575"

const API_URL =
    "https://api.chamindu.site/api/v1/youtube/savefrom/mp3";

const MAX_AUDIO_SIZE = 80 * 1024 * 1024;

// ═══════════════════════════════════════
//          EXTRACT AUDIO URL
// ═══════════════════════════════════════

function extractAudioUrl(data) {
    if (!data) return null;

    const keys = [
        "audioUrl",
        "audio_url",
        "downloadUrl",
        "download_url",
        "download_link",
        "mp3Url",
        "mp3_url",
        "audio",
        "mp3"
    ];

    function findUrl(obj) {
        if (!obj || typeof obj !== "object") return null;

        for (const key of keys) {
            const value = obj[key];

            if (
                typeof value === "string" &&
                /^https?:\/\//i.test(value)
            ) {
                return value;
            }

            if (value && typeof value === "object") {
                const result = findUrl(value);
                if (result) return result;
            }
        }

        for (const value of Object.values(obj)) {
            if (value && typeof value === "object") {
                const result = findUrl(value);
                if (result) return result;
            }
        }

        return null;
    }

    return findUrl(data);
}

// ═══════════════════════════════════════
//          FAST AUDIO DOWNLOAD
// ═══════════════════════════════════════

async function downloadAudio(url) {
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`[SONG] Download attempt ${attempt}`);

            const response = await axios.get(url, {
                responseType: "arraybuffer",
                timeout: 180000,
                maxContentLength: MAX_AUDIO_SIZE,
                maxBodyLength: MAX_AUDIO_SIZE,
                maxRedirects: 10,
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "audio/mpeg,audio/*,*/*"
                }
            });

            const contentType =
                response.headers["content-type"] || "";

            if (
                contentType.includes("text/html") ||
                contentType.includes("application/json")
            ) {
                throw new Error("Invalid audio download response.");
            }

            const buffer = Buffer.from(response.data);

            if (!buffer.length) {
                throw new Error("Empty audio file.");
            }

            if (buffer.length > MAX_AUDIO_SIZE) {
                throw new Error("Audio file is too large.");
            }

            console.log(
                `[SONG] Download completed: ${buffer.length} bytes`
            );

            return buffer;

        } catch (error) {
            lastError = error;

            console.error(
                `[SONG] Download failed:`,
                error.message
            );

            if (attempt < 2) {
                await new Promise(resolve =>
                    setTimeout(resolve, 1000)
                );
            }
        }
    }

    throw lastError;
}

// ═══════════════════════════════════════
//          SONG COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: "song",
    alias: ["play", "mp3", "audio"],
    desc: "Download YouTube Songs",
    category: "download",
    use: ".song song name",

    async execute(sock, msg, args, from, { reply }) {

        try {
            const query = args.join(" ").trim();

            if (!query) {
                return reply(
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃• 🎵 ᴇɴᴛᴇʀ ꜱᴏɴɢ ɴᴀᴍᴇ
┃◈┃
┃◈┃• ᴇxᴀᴍᴘʟᴇ: .song song name
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
                );
            }

            if (!API_KEY) {
                throw new Error("CHAMINDU_API_KEY is missing.");
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

            // ═══════════════════════════════
            //          YOUTUBE SEARCH
            // ═══════════════════════════════

            if (
                !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(query)
            ) {
                const search = await yts(query);

                if (!search.videos?.length) {
                    throw new Error("Song not found.");
                }

                const video = search.videos[0];

                videoUrl = video.url;
                title = video.title;
                artist = video.author?.name || "Unknown";
                duration = video.timestamp || "Unknown";
            }

            // ═══════════════════════════════
            //             API REQUEST
            // ═══════════════════════════════

            const response = await axios.get(API_URL, {
                params: {
                    url: videoUrl,
                    api_key: API_KEY
                },
                timeout: 120000,
                maxRedirects: 10
            });

            const data = response.data;

            if (
                data?.success === false ||
                data?.status === false
            ) {
                throw new Error(
                    data.message || "API request failed."
                );
            }

            const apiData =
                data?.result ||
                data?.data ||
                data;

            const audioUrl = extractAudioUrl(data);

            if (!audioUrl) {
                throw new Error("Audio URL not found.");
            }

            if (apiData && typeof apiData === "object") {
                title = apiData.title || title;
                artist = apiData.artist || apiData.author || artist;
                duration = apiData.duration || duration;
            }

            // ═══════════════════════════════
            //          DOWNLOAD MP3
            // ═══════════════════════════════

            const audioBuffer = await downloadAudio(audioUrl);

            // ═══════════════════════════════
            //          FILE NAME
            // ═══════════════════════════════

            const safeTitle = title
                .replace(/[\\/:*?"<>|]/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 100) || "ZANTA-SONG";

            // ═══════════════════════════════
            //          MP3 CAPTION
            // ═══════════════════════════════

            const caption =
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨: ${msg.pushName || "User"}
┃◈┃• 🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧: 1.0
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 🎵 𝐒𝐎𝐍𝐆 𝐃𝐄𝐓𝐀𝐈𝐋𝐒 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃🍁 𝐓𝐢𝐭𝐥𝐞:
┃◈┃${title}
┃◈┃
┃◈┃⛩️ 𝐀𝐫𝐭𝐢𝐬𝐭: ${artist}
┃◈┃
┃◈┃⏱️ 𝐃𝐮𝐫𝐚𝐭𝐢𝐨𝐧: ${duration}
┃◈┃
┃◈┃🎧 𝐅𝐨𝐫𝐦𝐚𝐭: MP3
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            // ═══════════════════════════════
            //       SEND MP3 WITH TITLE
            // ═══════════════════════════════

            console.log("[SONG] Sending MP3...");

            await sock.sendMessage(from, {
                document: audioBuffer,
                mimetype: "audio/mpeg",
                fileName: `${safeTitle}.mp3`,
                caption: caption
            }, {
                quoted: msg
            });

            console.log("[SONG] MP3 sent successfully!");

            await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            });

        } catch (error) {

            console.error("[ZANTA SONG ERROR]", error.message);

            await sock.sendMessage(from, {
                react: {
                    text: "❌",
                    key: msg.key
                }
            }).catch(() => {});

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
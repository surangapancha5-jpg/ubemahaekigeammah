const axios = require("axios");
const yts = require("yt-search");

// ═══════════════════════════════════════
//          ZANTA-XMD SONG API
// ═══════════════════════════════════════

const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

const API_URL =
    "https://api.chamindu.site/api/v1/youtube/savefrom/mp3";

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
        "mp3",
        "download",
        "link",
        "url"
    ];

    function findUrl(obj) {
        if (!obj || typeof obj !== "object") return null;

        for (const key of keys) {
            const value = obj[key];

            if (
                typeof value === "string" &&
                /^https?:\/\//i.test(value) &&
                !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value)
            ) {
                return value;
            }

            if (
                value &&
                typeof value === "object"
            ) {
                const nested = findUrl(value);
                if (nested) return nested;
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
//          DOWNLOAD AUDIO WITH RETRY
// ═══════════════════════════════════════

async function downloadAudio(url) {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`[SONG] Download Attempt: ${attempt}`);

            const response = await axios.get(url, {
                responseType: "arraybuffer",
                timeout: 300000,
                maxContentLength: 80 * 1024 * 1024,
                maxBodyLength: 80 * 1024 * 1024,
                maxRedirects: 10,
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "audio/mpeg,audio/*,*/*"
                },
                validateStatus: status =>
                    status >= 200 && status < 300
            });

            const buffer = Buffer.from(response.data);

            if (!buffer.length) {
                throw new Error("Downloaded audio is empty.");
            }

            const contentType =
                response.headers["content-type"] || "";

            if (
                contentType.includes("text/html") ||
                contentType.includes("application/json")
            ) {
                throw new Error(
                    `Audio වෙනුවට වෙනත් Response එකක් ලැබුණා: ${contentType}`
                );
            }

            console.log(
                "[SONG] Download Success:",
                buffer.length,
                "bytes"
            );

            return buffer;

        } catch (error) {
            lastError = error;

            console.error(
                `[SONG] Attempt ${attempt} Failed:`,
                error.message
            );

            if (attempt < 3) {
                await new Promise(resolve =>
                    setTimeout(resolve, 2000)
                );
            }
        }
    }

    throw lastError;
}

// ═══════════════════════════════════════
//              SONG COMMAND
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
┃◈┃• ᴇxᴀᴍᴘʟᴇ: .song sanda mithuri
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
                );
            }

            if (!API_KEY || API_KEY === "YOUR_NEW_API_KEY") {
                return reply("❌ API Key එක සකස් කරන්න.");
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

            // ═══════════════════════════════
            //          YOUTUBE SEARCH
            // ═══════════════════════════════

            if (
                !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(query)
            ) {
                const search = await yts(query);

                if (!search.videos || !search.videos.length) {
                    throw new Error("Song එක සොයාගැනීමට නොහැකි වුණා.");
                }

                const video = search.videos[0];

                videoUrl = video.url;
                title = video.title;
                artist = video.author?.name || "Unknown";
                duration = video.timestamp || "Unknown";
                thumbnail = video.thumbnail;
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
                maxRedirects: 10,
                validateStatus: () => true
            });

            console.log("========== CHAMINDU API ==========");
            console.log("STATUS:", response.status);
            console.log(
                "DATA:",
                JSON.stringify(response.data, null, 2)
            );
            console.log("==================================");

            if (response.status < 200 || response.status >= 300) {
                throw new Error(`API HTTP Error: ${response.status}`);
            }

            const apiData =
                response.data?.result ||
                response.data?.data ||
                response.data;

            if (
                response.data?.success === false ||
                response.data?.status === false
            ) {
                throw new Error(
                    response.data?.message || "API Request Failed"
                );
            }

            const audioUrl = extractAudioUrl(response.data);

            if (!audioUrl) {
                throw new Error(
                    "Audio URL එක API Response එකෙන් හමු වුණේ නැහැ."
                );
            }

            console.log("[SONG] Audio URL Found:", audioUrl);

            if (apiData && typeof apiData === "object") {
                title = apiData.title || title;
                artist = apiData.artist || apiData.author || artist;
                duration = apiData.duration || duration;
            }

            // ═══════════════════════════════
            //           SONG DETAILS
            // ═══════════════════════════════

            const caption = `
╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨: *${msg.pushName || "User"}*
┃◈┃• 🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧: 1.0
┃◈└───────────┈⊷
╰──────────────┈⊷

> 🍁 𝐓𝐢𝐭𝐥𝐞:
${title}

> ⓘ 𝐃𝐮𝐫𝐚𝐭𝐢𝐨𝐧:
▶︎ 00.00 ──────●───── ${duration}

╭━━〔 🎵 𝐒𝐎𝐍𝐆 𝐃𝐄𝐓𝐀𝐈𝐋𝐒 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ 𝐀𝐫𝐭𝐢𝐬𝐭: ${artist}
┃◈┃
┃◈┃⛩️ 𝐅𝐨𝐫𝐦𝐚𝐭: MP3
┃◈┃
┃◈┃⛩️ 𝐐𝐮𝐚𝐥𝐢𝐭𝐲: High
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂
`;

            if (thumbnail) {
                await sock.sendMessage(from, {
                    image: { url: thumbnail },
                    caption
                }, { quoted: msg });
            } else {
                await reply(caption);
            }

            // ═══════════════════════════════
            //           AUDIO DOWNLOAD
            // ═══════════════════════════════

            const audioBuffer = await downloadAudio(audioUrl);

            // ═══════════════════════════════
            //           SEND MP3
            // ═══════════════════════════════

            console.log("[SONG] Sending Audio to WhatsApp...");

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                fileName: `${title.replace(/[\\/:*?"<>|]/g, "")}.mp3`,
                ptt: false
            }, { quoted: msg });

            console.log("[SONG] Audio Sent Successfully!");

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
            });

            return reply(
                `╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ${error.message}
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
            );
        }
    }
};
const axios = require("axios");
const ytSearch = require("yt-search");

// ════════════════════════════════════════════════════════
//          API CONFIGURATION
//          API URL සහ API KEY මෙතැනින් වෙනස් කරන්න.
// ════════════════════════════════════════════════════════

const API_URL = "https://api.chamindu.site/api/v1/adult/xmaza";
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

// ════════════════════════════════════════════════════════
//          SEARCH FUNCTION
//          නමක් ලබාදුන් විට YouTube එකෙන් Search කරයි.
// ════════════════════════════════════════════════════════

async function searchMedia(query) {
    const search = await ytSearch(query);

    if (!search.videos || search.videos.length === 0) {
        throw new Error("Search result not found");
    }

    const video = search.videos[0];

    return {
        url: video.url,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.timestamp
    };
}

// ════════════════════════════════════════════════════════
//          API DOWNLOAD FUNCTION
//          API එකෙන් Download Link එක ලබාගනී.
// ════════════════════════════════════════════════════════

async function downloadMedia(url) {
    const response = await axios.get(API_URL, {
        params: {
            url: url,
            apikey: API_KEY
        },
        timeout: 120000
    });

    const data = response.data;

    const downloadUrl =
        data.download ||
        data.url ||
        data.result?.download ||
        data.result?.url ||
        data.data?.download ||
        data.data?.url;

    if (!downloadUrl) {
        console.log("[DOWNLOAD API RESPONSE]", data);
        throw new Error("Download URL not found");
    }

    return {
        url: downloadUrl,
        title:
            data.title ||
            data.result?.title ||
            "ZANTA DOWNLOAD"
    };
}

// ════════════════════════════════════════════════════════
//          FILE FETCH FUNCTION
//          Download Link එකෙන් Media Buffer එක ලබාගනී.
// ════════════════════════════════════════════════════════

async function fetchFile(url) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 180000,
        maxContentLength: MAX_FILE_SIZE,
        maxBodyLength: MAX_FILE_SIZE
    });

    return {
        buffer: Buffer.from(response.data),
        mimetype: response.headers["content-type"] ||
            "application/octet-stream"
    };
}

// ════════════════════════════════════════════════════════
//          MAIN DOWNLOAD COMMAND
//          Link සහ Search දෙකම ක්‍රියාත්මක කරයි.
// ════════════════════════════════════════════════════════

module.exports = {
    name: "download",
    alias: ["dl"],

    desc: "Universal Media Downloader",
    category: "download",
    use: ".download <name or url>",

    async execute(sock, msg, args, from, { reply }) {

        try {

            // ════════════════════════════════════════════════
            //          INPUT VALIDATION
            // ════════════════════════════════════════════════

            const input = args.join(" ").trim();

            if (!input) {
                return reply(
                    "╭━━〔 👑 ZANTA-XMD DOWNLOAD 〕━━╮\n\n" +
                    "┃ 📌 භාවිතය:\n\n" +
                    "┃ 🔎 නමෙන් Search:\n" +
                    "┃ .download song name\n\n" +
                    "┃ 🔗 Link එකෙන්:\n" +
                    "┃ .download https://link.com\n\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯\n" +
                    "> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂"
                );
            }

            // ════════════════════════════════════════════════
            //          SEARCH OR URL DETECTION
            // ════════════════════════════════════════════════

            let mediaUrl = input;
            let mediaTitle = "ZANTA DOWNLOAD";
            let thumbnail = null;
            let duration = null;

            if (!/^https?:\/\//i.test(input)) {

                await reply(
                    "╭━━〔 🔎 SEARCHING 〕━━╮\n\n" +
                    "┃ 🔍 " + input + "\n" +
                    "┃ ⏳ Searching media...\n\n" +
                    "╰━━━━━━━━━━━━━━━━━━╯"
                );

                const result = await searchMedia(input);

                mediaUrl = result.url;
                mediaTitle = result.title;
                thumbnail = result.thumbnail;
                duration = result.duration;
            }

            // ════════════════════════════════════════════════
            //          API PROCESSING
            // ════════════════════════════════════════════════

            await reply(
                "╭━━〔 ⏳ DOWNLOADING 〕━━╮\n\n" +
                "┃ 📁 " + mediaTitle + "\n" +
                "┃ ⚡ Please wait...\n\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
            );

            const result = await downloadMedia(mediaUrl);

            // ════════════════════════════════════════════════
            //          FILE DOWNLOADING
            // ════════════════════════════════════════════════

            const file = await fetchFile(result.url);

            const title = result.title !== "ZANTA DOWNLOAD"
                ? result.title
                : mediaTitle;

            const caption =
                "╭━━〔 👑 ZANTA-XMD 〕━━╮\n\n" +
                "┃ 📁 " + title + "\n" +
                (duration ? "┃ ⏱️ " + duration + "\n" : "") +
                "┃ ✅ Download Completed\n\n" +
                "╰━━━━━━━━━━━━━━━━━━╯\n" +
                "> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂";

            // ════════════════════════════════════════════════
            //          MEDIA TYPE DETECTION
            //          File එකේ වර්ගය අනුව WhatsApp වෙත යවයි.
            // ════════════════════════════════════════════════

            const mime = file.mimetype.toLowerCase();

            if (mime.startsWith("video/")) {

                await sock.sendMessage(from, {
                    video: file.buffer,
                    mimetype: mime,
                    caption: caption
                }, { quoted: msg });

            } else if (mime.startsWith("image/")) {

                await sock.sendMessage(from, {
                    image: file.buffer,
                    mimetype: mime,
                    caption: caption
                }, { quoted: msg });

            } else if (mime.startsWith("audio/")) {

                await sock.sendMessage(from, {
                    audio: file.buffer,
                    mimetype: mime,
                    fileName: "ZANTA-DOWNLOAD.mp3"
                }, { quoted: msg });

            } else {

                await sock.sendMessage(from, {
                    document: file.buffer,
                    mimetype: mime,
                    fileName: "ZANTA-DOWNLOAD",
                    caption: caption
                }, { quoted: msg });

            }

        } catch (error) {

            // ════════════════════════════════════════════════
            //          ERROR HANDLER
            //          Download අසාර්ථක වූ විට Error එක පෙන්වයි.
            // ════════════════════════════════════════════════

            console.error("[ZANTA DOWNLOAD ERROR]", error.message);

            return reply(
                "╭━━〔 ❌ DOWNLOAD ERROR 〕━━╮\n\n" +
                "┃ Download කරන්න බැරි වුණා.\n" +
                "┃ API එක හෝ Link එක පරීක්ෂා කරන්න.\n\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯\n" +
                "> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂"
            );
        }
    }
};
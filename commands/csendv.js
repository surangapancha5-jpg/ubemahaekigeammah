// ════════════════ IMPORTS ════════════════════════
const axios = require("axios");
const yts = require("yt-search");

// ════════════════ CONFIGURATION ════════════════════════
const API_URL = "https://api.chamindu.site/api/v1/youtube/download";
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

const QUALITY = "360p";
const INTERVAL_MS = 180000;
const MAX_FILE_SIZE = 64 * 1024 * 1024;

// ════════════════ SESSION STORAGE ════════════════════════
if (!global.csendVideoSessions) {
    global.csendVideoSessions = new Map();
}

// ════════════════ CATEGORY SEARCH ════════════════════════
function buildQuery(category, searchTerm = "") {
    const queries = {
        cartoon: `${searchTerm} Sinhala cartoon`,
        songs: `${searchTerm} DJ slowed remix Sinhala song`,
        drama: `${searchTerm} Sinhala teledrama episode`
    };

    return queries[category];
}

// ════════════════ SESSION STOP ════════════════════════
function stopSession(key) {
    const session = global.csendVideoSessions.get(key);

    if (session?.timer) {
        clearTimeout(session.timer);
    }

    global.csendVideoSessions.delete(key);
}

// ════════════════ YOUTUBE DOWNLOAD ════════════════════════
async function downloadVideo(videoUrl) {
    if (!API_KEY) {
        throw new Error("YOUTUBE_DOWNLOAD_API_KEY configure කරන්න.");
    }

    const response = await axios.get(API_URL, {
        params: {
            url: videoUrl,
            quality: QUALITY,
            format: "mp4",
            api_key: API_KEY
        },
        timeout: 120000
    });

    const result = response.data;

    if (!result || result.success === false) {
        throw new Error(result?.message || "Download API failed.");
    }

    const data = result.data || result.result || result;

    const downloadUrl =
        data.download_url ||
        data.downloadUrl ||
        data.url ||
        data.link;

    const title =
        data.title ||
        result.title ||
        "ZANTA-XMD VIDEO";

    if (!downloadUrl) {
        throw new Error("API response එකේ download URL එක නැහැ.");
    }

    const file = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: 180000,
        maxContentLength: MAX_FILE_SIZE,
        maxBodyLength: MAX_FILE_SIZE
    });

    const contentType = file.headers["content-type"] || "";

    if (
        contentType.includes("application/json") ||
        contentType.includes("text/html")
    ) {
        throw new Error("Download URL එකෙන් Video එකක් ලැබුණේ නැහැ.");
    }

    const buffer = Buffer.from(file.data);

    if (!buffer.length || buffer.length > MAX_FILE_SIZE) {
        throw new Error("Video file එක හිස් හෝ 64MB ඉක්මවා ඇත.");
    }

    return {
        buffer,
        title,
        filename: data.filename || "zanta-video.mp4"
    };
}

// ════════════════ SEND NEXT VIDEO ════════════════════════
async function sendNext(sock, from, key) {
    const session = global.csendVideoSessions.get(key);

    if (!session || !session.running) return;

    try {
        const query = buildQuery(session.category, session.searchTerm);

        await sock.sendMessage(from, {
            text:
                "╭━━〔 🎬 ZANTA-XMD 〕━━╮\n" +
                `┃ 📂 ${session.category.toUpperCase()}\n` +
                "┃ 🔎 Searching YouTube...\n" +
                "┃ 🎥 Quality: 360p\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
        });

        // Search YouTube.
        const results = await yts(query);

        if (!results?.videos?.length) {
            throw new Error("YouTube results හමු වුණේ නැහැ.");
        }

        // Use a result from the search.
        const video = results.videos[session.searchIndex % results.videos.length];

        // Avoid sending the same video repeatedly.
        session.searchIndex++;

        const downloaded = await downloadVideo(video.url);

        if (!global.csendVideoSessions.has(key)) return;

        await sock.sendMessage(from, {
            video: downloaded.buffer,
            mimetype: "video/mp4",
            fileName: downloaded.filename,
            caption:
                "╭━━〔 🎬 ZANTA-XMD VIDEO 〕━━╮\n" +
                `┃ 📌 ${downloaded.title}\n` +
                `┃ 📂 ${session.category.toUpperCase()}\n` +
                "┃ 🎥 Quality: 360p\n" +
                "┃ ✅ Download Completed\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
        });

        session.sent++;

    } catch (error) {
        console.error("[CSENDVIDEO]", error.message);

        await sock.sendMessage(from, {
            text: `⚠️ Video error: ${error.message}`
        });
    }

    if (!global.csendVideoSessions.has(key)) return;

    session.timer = setTimeout(() => {
        sendNext(sock, from, key).catch(error => {
            console.error("[CSENDVIDEO TIMER]", error.message);
            stopSession(key);
        });
    }, INTERVAL_MS);
}

// ════════════════ MAIN COMMAND ════════════════════════
module.exports = {
    name: "csendvideo",
    alias: ["csvideo", "sendvideo"],
    desc: "Automatic YouTube video sender",
    category: "media",
    use: ".csendvideo on cartoon",

    async execute(sock, msg, args, from, ctx = {}) {
        const reply = ctx.reply || (async text => {
            await sock.sendMessage(from, { text }, { quoted: msg });
        });

        const key =
            `${from}:${ctx.senderClean || ctx.sender || "unknown"}`;

        const input = String(args.join(" ") || "").trim();

        // ════════════════ STOP ════════════════════════
        if (/^(stop|off)$/i.test(input)) {
            if (!global.csendVideoSessions.has(key)) {
                return reply("ℹ️ Active session එකක් නැහැ.");
            }

            stopSession(key);
            return reply("⛔ CSENDVIDEO Auto-send නතර කළා.");
        }

        // ════════════════ OWNER CHECK ════════════════════════
        if (!ctx.isOwner && !ctx.isDev) {
            return reply("❌ Owner only command.");
        }

        // ════════════════ COMMAND VALIDATION ════════════════════════
        const match = input.match(
            /^on\s+(cartoon|songs|drama)(?:\s+(.+))?$/i
        );

        if (!match) {
            return reply(
                "╭━━〔 🎬 CSENDVIDEO 〕━━╮\n" +
                "┃\n" +
                "┃ 🎨 .csendvideo on cartoon\n" +
                "┃ 🎵 .csendvideo on songs\n" +
                "┃ 📺 .csendvideo on drama\n" +
                "┃ ⛔ .csendvideo stop\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const category = match[1].toLowerCase();
        const searchTerm = (match[2] || "").trim();

        if (!API_KEY) {
            return reply("❌ YOUTUBE_DOWNLOAD_API_KEY configure කර නැහැ.");
        }

        if (global.csendVideoSessions.has(key)) {
            stopSession(key);
        }

        // ════════════════ CREATE SESSION ════════════════════════
        global.csendVideoSessions.set(key, {
            running: true,
            category,
            searchTerm,
            searchIndex: 0,
            sent: 0,
            timer: null,
            startedAt: Date.now()
        });

        await reply(
            "╭━━〔 🎬 CSENDVIDEO STARTED 〕━━╮\n" +
            `┃ 📂 Category: ${category.toUpperCase()}\n` +
            `┃ 🔎 Search: ${searchTerm || "Automatic"}\n` +
            "┃ 🎥 Quality: 360p\n" +
            "┃ ⏱️ Interval: 3 Minutes\n" +
            "┃ 🏷️ Title Message: ON\n" +
            "┃\n" +
            "┃ ⛔ Stop: .csendvideo stop\n" +
            "╰━━━━━━━━━━━━━━━━━━━━━━━━╯"
        );

        await sendNext(sock, from, key);
    }
};
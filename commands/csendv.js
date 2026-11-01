// ════════════════ IMPORTS ════════════════════════
const axios = require("axios");
const yts = require("yt-search");

// ════════════════ CONFIGURATION ════════════════════════
const API_URL = "https://api.chamindu.site/api/v1/youtube/download";
const API_KEY = process.env.YOUTUBE_DOWNLOAD_API_KEY;

const QUALITY = "360p";
const INTERVAL_MS = 180000;
const MAX_FILE_SIZE = 64 * 1024 * 1024;

// ════════════════ SESSION STORAGE ════════════════════════
if (!global.vsendSessions) {
    global.vsendSessions = new Map();
}

// ════════════════ TEXT NORMALIZER ════════════════════════
function normalizeText(text = "") {
    return String(text)
        .toLowerCase()
        .normalize("NFC")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ════════════════ EPISODE PARSER ════════════════════════
function parseDramaInput(input) {

    const patterns = [
        /(\d+)\s*කොටස/i,
        /(?:episode|ep|part)\s*#?\s*(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = input.match(pattern);

        if (match) {
            const episode = Number(match[1]);

            if (episode > 0) {
                const dramaName = input
                    .replace(pattern, "")
                    .trim();

                return {
                    dramaName,
                    startEpisode: episode,
                    nextEpisode: episode + 1
                };
            }
        }
    }

    return null;
}

// ════════════════ CATEGORY SEARCH ════════════════════════
function buildQuery(session) {

    if (session.category === "cartoon") {
        return `${session.searchTerm} Sinhala cartoon`;
    }

    if (session.category === "songs") {
        return `${session.searchTerm} song`;
    }

    if (session.category === "drama") {
        return `${session.searchTerm} ${session.nextEpisode} කොටස`;
    }

    return session.searchTerm;
}

// ════════════════ TITLE VALIDATION ════════════════════════
function matchesSearchName(title, searchTerm) {

    const normalizedTitle = normalizeText(title);
    const normalizedSearch = normalizeText(searchTerm);

    if (!normalizedTitle || !normalizedSearch) {
        return false;
    }

    return normalizedTitle.includes(normalizedSearch);
}

// ════════════════ EPISODE VALIDATION ════════════════════════
function getEpisodeNumber(title) {

    const patterns = [
        /(\d+)\s*කොටස/i,
        /(?:episode|ep|part)\s*#?\s*(\d+)/i,
        /(?:episode|ep|part)\s*(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);

        if (match) {
            return Number(match[1]);
        }
    }

    return null;
}

// ════════════════ STOP SESSION ════════════════════════
function stopSession(key) {

    const session = global.vsendSessions.get(key);

    if (session?.timer) {
        clearTimeout(session.timer);
    }

    global.vsendSessions.delete(key);
}

// ════════════════ YOUTUBE SEARCH ════════════════════════
async function searchVideo(session) {

    const query = buildQuery(session);

    console.log("[VSEND SEARCH]", query);

    const results = await yts(query);

    if (!results?.videos?.length) {
        return null;
    }

    for (const video of results.videos) {

        const title = video.title || "";

        // ════════════════ DRAMA FILTER ════════════════════════
        if (session.category === "drama") {

            if (
                !matchesSearchName(title, session.searchTerm)
            ) {
                continue;
            }

            const episode = getEpisodeNumber(title);

            // Only the exact next episode.
            if (episode !== session.nextEpisode) {
                continue;
            }

            return video;
        }

        // ════════════════ CARTOON / SONG FILTER ════════════════
        if (
            !matchesSearchName(title, session.searchTerm)
        ) {
            continue;
        }

        // Avoid previously sent videos.
        if (session.sentUrls.has(video.url)) {
            continue;
        }

        return video;
    }

    return null;
}

// ════════════════ YOUTUBE DOWNLOAD ════════════════════════
async function downloadVideo(videoUrl) {

    if (!API_KEY) {
        throw new Error(
            "YOUTUBE_DOWNLOAD_API_KEY configure කරන්න."
        );
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
        throw new Error(
            result?.message || "Download API failed."
        );
    }

    const data = result.data || result.result || result;

    const downloadUrl =
        data.download_url ||
        data.downloadUrl ||
        data.url ||
        data.link;

    if (!downloadUrl) {
        throw new Error("Download URL එක හමු වුණේ නැහැ.");
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
        throw new Error("Invalid video response.");
    }

    const buffer = Buffer.from(file.data);

    if (!buffer.length || buffer.length > MAX_FILE_SIZE) {
        throw new Error("Video size invalid or exceeds 64MB.");
    }

    return {
        buffer,
        title: data.title || "ZANTA-XMD VIDEO",
        filename: data.filename || "zanta-video.mp4"
    };
}

// ════════════════ SEND VIDEO ════════════════════════
async function sendNext(sock, from, key) {

    const session = global.vsendSessions.get(key);

    if (!session || !session.running || session.busy) {
        return;
    }

    session.busy = true;

    try {

        // ════════════════ SEARCH ════════════════════════
        const video = await searchVideo(session);

        if (!global.vsendSessions.has(key)) return;

        // ════════════════ VIDEO NOT FOUND ════════════════════════
        if (!video) {

            let message = "";

            if (session.category === "drama") {

                message =
                    "╭━━〔 🎬 VSEND WAITING 〕━━╮\n" +
                    `┃ 📺 Drama: ${session.searchTerm}\n` +
                    `┃ 🔢 Waiting Episode: ${session.nextEpisode}\n` +
                    "┃ ⏳ YouTube Upload එකක් බලාපොරොත්තුවෙන්...\n" +
                    "┃ 🔍 නැවත Search කරනවා.\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯";

            } else {

                message =
                    "╭━━〔 🎬 VSEND SEARCH 〕━━╮\n" +
                    `┃ 📂 ${session.category.toUpperCase()}\n` +
                    `┃ 🔎 ${session.searchTerm}\n` +
                    "┃ ⏳ Matching video එකක් හමු වුණේ නැහැ.\n" +
                    "┃ 🔄 නැවත Search කරනවා.\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯";
            }

            await sock.sendMessage(from, {
                text: message
            });

            return;
        }

        // ════════════════ DOWNLOAD ════════════════════════
        await sock.sendMessage(from, {
            text:
                "╭━━〔 🎬 ZANTA-XMD 〕━━╮\n" +
                `┃ 📌 ${video.title}\n` +
                "┃ ⬇️ Downloading...\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
        });

        const downloaded = await downloadVideo(video.url);

        if (!global.vsendSessions.has(key)) return;

        // ════════════════ FINAL VALIDATION ════════════════════════
        if (session.category === "drama") {

            if (
                !matchesSearchName(
                    downloaded.title,
                    session.searchTerm
                )
            ) {
                throw new Error("Drama title mismatch.");
            }

            const episode = getEpisodeNumber(downloaded.title);

            if (episode !== session.nextEpisode) {
                throw new Error("Episode number mismatch.");
            }
        }

        // ════════════════ SEND VIDEO ════════════════════════
        await sock.sendMessage(from, {
            video: downloaded.buffer,
            mimetype: "video/mp4",
            fileName: downloaded.filename,
            caption:
                "╭━━〔 🎬 ZANTA-XMD VIDEO 〕━━╮\n" +
                `┃ 📌 ${downloaded.title}\n` +
                `┃ 📂 ${session.category.toUpperCase()}\n` +
                (
                    session.category === "drama"
                        ? `┃ 🔢 Episode: ${session.nextEpisode}\n`
                        : ""
                ) +
                "┃ 🎥 Quality: 360p\n" +
                "┃ ✅ Download Completed\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        });

        // ════════════════ UPDATE SESSION ════════════════
        if (session.category === "drama") {

            // Increase only after successful sending.
            session.sent++;
            session.nextEpisode++;

        } else {

            session.sent++;
            session.sentUrls.add(video.url);
        }

        console.log(
            `[VSEND] Sent: ${downloaded.title}`
        );

    } catch (error) {

        console.error("[VSEND ERROR]", error.message);

        if (global.vsendSessions.has(key)) {
            await sock.sendMessage(from, {
                text: `⚠️ VSEND Error: ${error.message}`
            }).catch(() => {});
        }

    } finally {

        const current = global.vsendSessions.get(key);

        if (current) {

            current.busy = false;

            current.timer = setTimeout(() => {
                sendNext(sock, from, key).catch(console.error);
            }, INTERVAL_MS);
        }
    }
}

// ════════════════ MAIN COMMAND ════════════════════════
module.exports = {

    name: "vsend",
    alias: ["vsendvideo", "vs"],

    desc: "Automatic YouTube Video Sender",

    category: "media",

    use: ".vsend on cartoon Garfield",

    async execute(sock, msg, args, from, ctx = {}) {

        const reply = ctx.reply || (async text => {
            await sock.sendMessage(
                from,
                { text },
                { quoted: msg }
            );
        });

        const key =
            `${from}:${ctx.senderClean || ctx.sender || "unknown"}`;

        const input = String(args.join(" ") || "").trim();

        // ════════════════ STOP ════════════════════════
        if (/^(stop|off)$/i.test(input)) {

            if (!global.vsendSessions.has(key)) {
                return reply("ℹ️ Active VSEND session එකක් නැහැ.");
            }

            stopSession(key);

            return reply(
                "⛔ VSEND Auto Sender නතර කළා."
            );
        }

        // ════════════════ OWNER CHECK ════════════════════════
        if (!ctx.isOwner && !ctx.isDev) {
            return reply("❌ Owner only command.");
        }

        // ════════════════ COMMAND VALIDATION ════════════════════════
        const match = input.match(
            /^on\s+(cartoon|songs|drama)\s+(.+)$/i
        );

        if (!match) {

            return reply(
                "╭━━〔 🎬 VSEND SYSTEM 〕━━╮\n" +
                "┃\n" +
                "┃ 🎨 Cartoon:\n" +
                "┃ .vsend on cartoon Garfield\n" +
                "┃\n" +
                "┃ 🎵 Songs:\n" +
                "┃ .vsend on songs Sinhala DJ\n" +
                "┃\n" +
                "┃ 📺 Drama:\n" +
                "┃ .vsend on drama කූබියො 80 කොටස\n" +
                "┃\n" +
                "┃ ⛔ Stop:\n" +
                "┃ .vsend stop\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const category = match[1].toLowerCase();

        const searchInput = match[2].trim();

        // ════════════════ DRAMA CONFIGURATION ════════════════
        let searchTerm = searchInput;
        let nextEpisode = null;

        if (category === "drama") {

            const parsed = parseDramaInput(searchInput);

            if (!parsed || !parsed.dramaName) {

                return reply(
                    "❌ Drama format එක වැරදියි.\n\n" +
                    "උදාහරණය:\n" +
                    ".vsend on drama කූබියො 80 කොටස"
                );
            }

            searchTerm = parsed.dramaName;
            nextEpisode = parsed.nextEpisode;
        }

        // ════════════════ API KEY CHECK ════════════════
        if (!API_KEY) {

            return reply(
                "❌ YOUTUBE_DOWNLOAD_API_KEY configure කර නැහැ."
            );
        }

        // ════════════════ OLD SESSION STOP ════════════════
        if (global.vsendSessions.has(key)) {
            stopSession(key);
        }

        // ════════════════ CREATE SESSION ════════════════
        global.vsendSessions.set(key, {

            running: true,

            category,

            searchTerm,

            nextEpisode,

            sent: 0,

            sentUrls: new Set(),

            timer: null,

            busy: false,

            startedAt: Date.now()
        });

        // ════════════════ START MESSAGE ════════════════
        await reply(
            "╭━━〔 🎬 VSEND STARTED 〕━━╮\n" +
            `┃ 📂 Category: ${category.toUpperCase()}\n` +
            `┃ 🔎 Name: ${searchTerm}\n` +
            (
                category === "drama"
                    ? `┃ 🔢 Next Episode: ${nextEpisode}\n`
                    : ""
            ) +
            "┃ 🎥 Quality: 360p\n" +
            "┃ ⏱️ Interval: 3 Minutes\n" +
            "┃ 🔍 Exact Matching: ON\n" +
            "┃ 🔄 Auto Search: ON\n" +
            "┃\n" +
            "┃ ⛔ Stop: .vsend stop\n" +
            "╰━━━━━━━━━━━━━━━━━━━━╯"
        );

        // ════════════════ START SEARCH ════════════════════════
        await sendNext(sock, from, key);
    }
};
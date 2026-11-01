// ════════════════ IMPORTS ════════════════════════
const axios = require("axios");
const yts = require("yt-search");

// ════════════════ CONFIGURATION ════════════════════════
const API_URL = "https://api.chamindu.site/api/v1/youtube/download";
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

const QUALITY = "720p";
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

// ════════════════ DRAMA INPUT PARSER ════════════════════════
function parseDramaInput(input) {

    const match = input.match(
        /^(.+?)\s+(itn|rupavahini|swarnavahini|derana)\s+(\d+)\s*කොටස$/i
    );

    if (!match) return null;

    return {
        dramaName: match[1].trim(),
        channel: match[2].toUpperCase(),
        startEpisode: Number(match[3]),
        nextEpisode: Number(match[3]) + 1
    };
}

// ════════════════ EPISODE NUMBER DETECTOR ════════════════════════
function getEpisodeNumber(title = "") {

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

// ════════════════ NAME VALIDATION ════════════════════════
function matchesSearchName(title, searchTerm) {

    const normalizedTitle = normalizeText(title);
    const normalizedSearch = normalizeText(searchTerm);

    if (!normalizedTitle || !normalizedSearch) {
        return false;
    }

    return normalizedTitle.includes(normalizedSearch);
}

// ════════════════ SEARCH QUERY BUILDER ════════════════════════
function buildQuery(session) {

    if (session.category === "drama") {

        return `"${session.searchTerm}" ${session.channel} ${session.nextEpisode} කොටස`;
    }

    if (session.category === "cartoon") {

        return `${session.searchTerm} Sinhala cartoon`;
    }

    if (session.category === "songs") {

        return `${session.searchTerm} song`;
    }

    return session.searchTerm;
}

// ════════════════ DRAMA SEARCH FILTER ════════════════════════
function searchDrama(results, session) {

    if (!results?.videos?.length) return null;

    for (const video of results.videos) {

        const title = normalizeText(video.title || "");

        const channel = normalizeText(
            video.author?.name || ""
        );

        const drama = normalizeText(session.searchTerm);

        const requiredChannel = normalizeText(
            session.channel
        );

        // Drama name validation
        if (!title.includes(drama)) continue;

        // Exact episode validation
        const episode = getEpisodeNumber(video.title);

        if (episode !== session.nextEpisode) continue;

        // Channel validation
        if (!channel.includes(requiredChannel)) continue;

        return video;
    }

    return null;
}

// ════════════════ VIDEO SEARCH ════════════════════════
async function searchVideo(session) {

    const query = buildQuery(session);

    console.log("[VSEND SEARCH]", query);

    const results = await yts(query);

    if (session.category === "drama") {

        return searchDrama(results, session);
    }

    if (!results?.videos?.length) return null;

    for (const video of results.videos) {

        if (
            !matchesSearchName(
                video.title,
                session.searchTerm
            )
        ) continue;

        if (session.sentUrls.has(video.url)) continue;

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

    const data =
        result.data ||
        result.result ||
        result;

    const downloadUrl =
        data.download_url ||
        data.downloadUrl ||
        data.url ||
        data.link;

    if (!downloadUrl) {

        throw new Error(
            "API response එකේ download URL එක නැහැ."
        );
    }

    const file = await axios.get(downloadUrl, {

        responseType: "arraybuffer",
        timeout: 180000,

        maxContentLength: MAX_FILE_SIZE,
        maxBodyLength: MAX_FILE_SIZE
    });

    const contentType =
        file.headers["content-type"] || "";

    if (
        contentType.includes("application/json") ||
        contentType.includes("text/html")
    ) {

        throw new Error(
            "Download URL එකෙන් Video එකක් ලැබුණේ නැහැ."
        );
    }

    const buffer = Buffer.from(file.data);

    if (
        !buffer.length ||
        buffer.length > MAX_FILE_SIZE
    ) {

        throw new Error(
            "Video file එක හිස් හෝ 64MB ඉක්මවා ඇත."
        );
    }

    return {

        buffer,

        title:
            data.title ||
            "ZANTA-XMD VIDEO",

        filename:
            data.filename ||
            "zanta-video.mp4"
    };
}

// ════════════════ STOP SESSION ════════════════════════
function stopSession(key) {

    const session =
        global.vsendSessions.get(key);

    if (session?.timer) {

        clearTimeout(session.timer);
    }

    global.vsendSessions.delete(key);
}

// ════════════════ SEND NEXT VIDEO ════════════════════════
async function sendNext(sock, from, key) {

    const session =
        global.vsendSessions.get(key);

    if (
        !session ||
        !session.running ||
        session.busy
    ) return;

    session.busy = true;

    try {

        // ════════════════ SEARCH MESSAGE ════════════════════════
        await sock.sendMessage(from, {

            text:
                "╭━━〔 🎬 ZANTA-XMD 〕━━╮\n" +
                `┃ 📂 ${session.category.toUpperCase()}\n` +
                `┃ 🔎 ${session.searchTerm}\n` +
                (
                    session.category === "drama"
                        ? `┃ 🔢 Episode: ${session.nextEpisode}\n`
                        : ""
                ) +
                "┃ 🔍 Searching YouTube...\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
        });

        // ════════════════ SEARCH VIDEO ════════════════════════
        const video = await searchVideo(session);

        if (!global.vsendSessions.has(key)) return;

        // ════════════════ VIDEO NOT FOUND ════════════════════════
        if (!video) {

            await sock.sendMessage(from, {

                text:
                    "╭━━〔 ⏳ VSEND WAITING 〕━━╮\n" +
                    `┃ 📺 ${session.searchTerm}\n` +
                    (
                        session.category === "drama"
                            ? `┃ 🔢 Episode: ${session.nextEpisode}\n`
                            : ""
                    ) +
                    "┃ ⚠️ Matching video එකක් හමු වුණේ නැහැ.\n" +
                    "┃ 🔄 නැවත Search කරනවා.\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━╯"
            });

            return;
        }

        // ════════════════ DOWNLOAD MESSAGE ════════════════════════
        await sock.sendMessage(from, {

            text:
                "╭━━〔 ⬇️ DOWNLOADING 〕━━╮\n" +
                `┃ 📌 ${video.title}\n` +
                "┃ 🎥 Quality: 360p\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
        });

        // ════════════════ DOWNLOAD VIDEO ════════════════════════
        const downloaded =
            await downloadVideo(video.url);

        if (!global.vsendSessions.has(key)) return;

        // ════════════════ FINAL DRAMA VALIDATION ════════════════════════
        if (session.category === "drama") {

            if (
                !matchesSearchName(
                    downloaded.title,
                    session.searchTerm
                )
            ) {

                throw new Error(
                    "Drama title mismatch."
                );
            }

            const episode =
                getEpisodeNumber(downloaded.title);

            if (episode !== session.nextEpisode) {

                throw new Error(
                    "Episode number mismatch."
                );
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

        // ════════════════ UPDATE SESSION ════════════════════════
        if (!global.vsendSessions.has(key)) return;

        session.sent++;

        if (session.category === "drama") {

            session.nextEpisode++;

        } else {

            session.sentUrls.add(video.url);
        }

        console.log(
            `[VSEND] Sent: ${downloaded.title}`
        );

    } catch (error) {

        console.error(
            "[VSEND ERROR]",
            error.message
        );

        if (global.vsendSessions.has(key)) {

            await sock.sendMessage(from, {

                text:
                    `⚠️ VSEND Error: ${error.message}`

            }).catch(() => {});
        }

    } finally {

        const current =
            global.vsendSessions.get(key);

        if (current) {

            current.busy = false;

            current.timer = setTimeout(() => {

                sendNext(sock, from, key)
                    .catch(console.error);

            }, INTERVAL_MS);
        }
    }
}

// ════════════════ MAIN COMMAND ════════════════════════
module.exports = {

    name: "vsend",

    alias: [
        "vsendvideo",
        "vs"
    ],

    desc: "Automatic YouTube Video Sender",

    category: "media",

    use: ".vsend on drama කෝපි කඩේ itn 709 කොටස",

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

        const input =
            String(args.join(" ") || "").trim();

        // ════════════════ STOP COMMAND ════════════════════════
        if (/^(stop|off)$/i.test(input)) {

            if (!global.vsendSessions.has(key)) {

                return reply(
                    "ℹ️ Active VSEND session එකක් නැහැ."
                );
            }

            stopSession(key);

            return reply(
                "⛔ VSEND Auto Sender නතර කළා."
            );
        }

        // ════════════════ OWNER CHECK ════════════════════════
        if (!ctx.isOwner && !ctx.isDev) {

            return reply(
                "❌ Owner only command."
            );
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
                "┃ .vsend on drama කෝපි කඩේ itn 709 කොටස\n" +
                "┃\n" +
                "┃ ⛔ Stop:\n" +
                "┃ .vsend stop\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const category =
            match[1].toLowerCase();

        const searchInput =
            match[2].trim();

        // ════════════════ SESSION CONFIGURATION ════════════════════════
        let searchTerm = searchInput;
        let channel = null;
        let nextEpisode = null;

        // ════════════════ DRAMA CONFIGURATION ════════════════════════
        if (category === "drama") {

            const parsed =
                parseDramaInput(searchInput);

            if (!parsed) {

                return reply(
                    "❌ Drama format එක වැරදියි.\n\n" +
                    "නිවැරදි Format එක:\n" +
                    ".vsend on drama කෝපි කඩේ itn 709 කොටස"
                );
            }

            searchTerm = parsed.dramaName;

            channel = parsed.channel;

            nextEpisode = parsed.nextEpisode;
        }

        // ════════════════ API KEY CHECK ════════════════════════
        if (!API_KEY) {

            return reply(
                "❌ YOUTUBE_DOWNLOAD_API_KEY configure කර නැහැ."
            );
        }

        // ════════════════ STOP OLD SESSION ════════════════════════
        if (global.vsendSessions.has(key)) {

            stopSession(key);
        }

        // ════════════════ CREATE NEW SESSION ════════════════════════
        global.vsendSessions.set(key, {

            running: true,

            category,

            searchTerm,

            channel,

            nextEpisode,

            sent: 0,

            sentUrls: new Set(),

            timer: null,

            busy: false,

            startedAt: Date.now()
        });

        // ════════════════ START MESSAGE ════════════════════════
        await reply(

            "╭━━〔 🎬 VSEND STARTED 〕━━╮\n" +
            `┃ 📂 Category: ${category.toUpperCase()}\n` +
            `┃ 🔎 Name: ${searchTerm}\n` +
            (
                category === "drama"
                    ? `┃ 📡 Channel: ${channel}\n`
                    : ""
            ) +
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

        // ════════════════ START SENDING ════════════════════════
        await sendNext(sock, from, key);
    }
};
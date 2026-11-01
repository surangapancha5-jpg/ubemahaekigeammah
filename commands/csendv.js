// ════════════════ IMPORTS ════════════════════════════════

const axios = require("axios");

// ════════════════ API CONFIGURATION ══════════════════════

const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

// ════════════════ SYSTEM CONFIGURATION ═══════════════════

const INTERVAL = 3 * 60 * 1000;

if (!global.csendVideoSessions) {
global.csendVideoSessions = new Map();
}

// ════════════════ YOUTUBE SEARCH ═════════════════════════

async function searchYouTube(query, type = "video") {
const response = await axios.get(
"https://www.googleapis.com/youtube/v3/search",
{
params: {
part: "snippet",
q: query,
type,
maxResults: 25,
regionCode: "LK",
relevanceLanguage: "si",
order: "relevance",
key: API_KEY
},
timeout: 20000
}
);

return response.data.items || [];

}

// ════════════════ GET PLAYLIST VIDEOS ════════════════════

async function getPlaylistVideos(playlistId) {
const videos = [];
let pageToken = "";

while (true) {
    const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/playlistItems",
        {
            params: {
                part: "snippet",
                playlistId,
                maxResults: 50,
                pageToken,
                key: API_KEY
            },
            timeout: 20000
        }
    );

    videos.push(...response.data.items);

    pageToken = response.data.nextPageToken;

    if (!pageToken || videos.length >= 500) break;
}

return videos;

}

// ════════════════ EPISODE NUMBER DETECTOR ════════════════

function getEpisodeNumber(title) {
const patterns = [
/episode\s*[-#:]?\s*(\d+)/i,
/ep\s*[-#:]?\s*(\d+)/i,
/කොටස\s*[-:]?\s*(\d+)/i,
/(\d+)\sවන\sකොටස/i
];

for (const pattern of patterns) {
    const match = title.match(pattern);

    if (match) return Number(match[1]);
}

return null;

}

// ════════════════ SONG SEARCH QUERIES ════════════════════

function getSongQuery() {
const queries = [
"Sinhala DJ Remix",
"Sinhala Slowed Reverb",
"Sinhala Bass Boost",
"Sinhala Speed Up Remix",
"Sinhala DJ Mashup"
];

return queries[
    Math.floor(Math.random() * queries.length)
];

}

// ════════════════ CARTOON SEARCH QUERIES ═════════════════

function getCartoonQuery() {
const queries = [
"සිංහල හඬකැවූ කාටුන්",
"Sinhala dubbed cartoon",
"Sinhala cartoon full episode",
"සිංහල කාටුන් සම්පූර්ණ කොටස්"
];

return queries[
    Math.floor(Math.random() * queries.length)
];

}

// ════════════════ SEND VIDEO LINK ════════════════════════

async function sendVideo(sock, from, video, category) {
const videoId =
video.id?.videoId ||
video.snippet?.resourceId?.videoId;

if (!videoId) return false;

const title = video.snippet?.title || "YouTube Video";

const url =
    `https://www.youtube.com/watch?v=${videoId}`;

await sock.sendMessage(from, {
    text:

`╭━━〔 🎬 ZANTA AUTO VIDEO 〕━━╮
┃
┃ 📌 ${title}
┃
┃ 📂 Category : ${category}
┃
┃ ▶️ Watch Video:
┃ ${url}
┃
┃ ⏱️ Next Video : 3 Minutes
┃
╰━━━━━━━━━━━━━━━━━━━━╯

«𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃`
});»

return true;

}

// ════════════════ AUTO SEARCH SYSTEM ═════════════════════

async function startAutoSearch(sock, from, session) {

if (session.running) return;

session.running = true;

const run = async () => {

    if (!session.running) return;

    try {
        let video = null;

        // ════════════════ SONGS ═══════════════════════

        if (session.category === "songs") {

            const results = await searchYouTube(
                getSongQuery()
            );

            video = results.find(item =>
                item.id?.videoId &&
                !session.sent.has(item.id.videoId)
            );
        }

        // ════════════════ SINHALA CARTOONS ════════════

        if (session.category === "cartoons") {

            const results = await searchYouTube(
                getCartoonQuery()
            );

            video = results.find(item => {

                const title =
                    item.snippet?.title || "";

                const channel =
                    item.snippet?.channelTitle || "";

                const text = `${title} ${channel}`
                    .toLowerCase();

                const validWords = [
                    "sinhala",
                    "සිංහල",
                    "dubbed",
                    "හඬකැවූ"
                ];

                return (
                    item.id?.videoId &&
                    !session.sent.has(item.id.videoId) &&
                    validWords.some(word =>
                        text.includes(word)
                    )
                );
            });
        }

        // ════════════════ TELEDRAMA ═══════════════════

        if (session.category === "teledrama") {

            const episodes = session.episodes || [];

            if (session.position >= episodes.length) {

                session.running = false;

                await sock.sendMessage(from, {
                    text:
                        "✅ Playlist එකේ සියලුම Episodes අවසන්."
                });

                return;
            }

            video = episodes[session.position];

            if (video) {
                session.position++;
            }
        }

        // ════════════════ SEND VIDEO ══════════════════

        if (video) {

            const sent = await sendVideo(
                sock,
                from,
                video,
                session.category
            );

            if (sent && video.id?.videoId) {
                session.sent.add(video.id.videoId);
            }

        } else if (session.category !== "teledrama") {

            await sock.sendMessage(from, {
                text:
                    "🔍 අලුත් Video එකක් හමු වුණේ නැහැ."
            });
        }

    } catch (error) {

        console.error(
            "[CSENDVIDEO ERROR]",
            error.response?.data || error.message
        );
    }

    // ════════════════ NEXT INTERVAL ═══════════════════

    if (session.running) {
        session.timer = setTimeout(run, INTERVAL);
    }
};

await run();

}

// ════════════════ MAIN COMMAND ═══════════════════════════

module.exports = {

name: "csendvideo",
alias: ["autovideo", "sendvideo"],

desc: "Auto Search Video Sender",
category: "owner",
use: ".csendvideo",

async execute(sock, msg, args, from, { reply }) {

    try {

        // ════════════════ API CHECK ═══════════════════

        if (
            !API_KEY ||
            API_KEY === "YOUR_YOUTUBE_API_KEY"
        ) {
            return reply(
                "❌ Code එකේ API_KEY එකට ඔයාගේ YouTube API Key එක දාන්න."
            );
        }

        const input = args.join(" ").trim();

        // ════════════════ STOP SYSTEM ═════════════════

        if (input.toLowerCase() === "stop") {

            const session =
                global.csendVideoSessions.get(from);

            if (session) {

                session.running = false;

                clearTimeout(session.timer);

                global.csendVideoSessions.delete(from);
            }

            return reply(
                "⏹️ Auto Video System එක නතර කළා."
            );
        }

        // ════════════════ CATEGORY MENU ═══════════════

        if (!input) {

            global.csendVideoSessions.set(from, {
                category: "waiting_category",
                sent: new Set(),
                running: false
            });

            return reply(

"╭━━〔 🎬 CSEND VIDEO 〕━━╮ ┃ ┃ 1️⃣ SONGS ┃ ┃ 🎵 DJ Remix ┃ 🎵 Slowed ┃ 🎵 Bass Boost ┃ 🎵 Speed Up ┃ ┃ 2️⃣ SINHALA CARTOONS ┃ ┃ 🎬 Sinhala Dubbed ┃ ┃ 3️⃣ TELEDRAMA ┃ ┃ 📺 Episode 1 → Final ┃ ┃ ━━━━━━━━━━━━━━━━━━━ ┃ ┃ Number එක Reply කරන්න. ┃ ┃ ⏱️ Interval : 3 Minutes ┃ ┃ Stop : .csendvideo stop ┃ ╰━━━━━━━━━━━━━━━━━━━━╯"
);
}

        // ════════════════ CATEGORY REPLY ══════════════

        const current =
            global.csendVideoSessions.get(from);

        if (
            current?.category === "waiting_category" &&
            ["1", "2", "3"].includes(input)
        ) {

            // ════════════════ SONGS ═══════════════════

            if (input === "1") {

                const session = {
                    category: "songs",
                    sent: new Set(),
                    running: false
                };

                global.csendVideoSessions.set(
                    from,
                    session
                );

                await reply(
                    "🎵 SONGS Auto Search ආරම්භ කළා!"
                );

                return startAutoSearch(
                    sock,
                    from,
                    session
                );
            }

            // ════════════════ CARTOONS ════════════════

            if (input === "2") {

                const session = {
                    category: "cartoons",
                    sent: new Set(),
                    running: false
                };

                global.csendVideoSessions.set(
                    from,
                    session
                );

                await reply(
                    "🎬 Sinhala Cartoon Auto Search ආරම්භ කළා!"
                );

                return startAutoSearch(
                    sock,
                    from,
                    session
                );
            }

            // ════════════════ TELEDRAMA ══════════════

            if (input === "3") {

                current.category = "waiting_name";

                return reply(
                    "📺 ටෙලිනාට්‍යයේ නම ලබා දෙන්න."
                );
            }
        }

        // ════════════════ TELEDRAMA NAME ══════════════

        if (current?.category === "waiting_name") {

            await reply(
                "🔍 ටෙලිනාට්‍යයේ Playlist සොයමින්..."
            );

            const playlists = await searchYouTube(
                `${input} Sinhala full episodes`,
                "playlist"
            );

            if (!playlists.length) {
                return reply(
                    "❌ Playlist එකක් හමු වුණේ නැහැ."
                );
            }

            current.playlists = playlists.slice(0, 5);

            current.category = "waiting_playlist";

            let menu =

"╭━━〔 📺 SELECT PLAYLIST 〕━━╮ ┃ ";

            current.playlists.forEach((item, index) => {

                menu +=

"┃ ${index + 1}. ${item.snippet.title} ┃ ";
});

            menu +=

`╰━━━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`;

            return reply(menu);
        }

        // ════════════════ PLAYLIST SELECTION ══════════

        if (
            current?.category === "waiting_playlist" &&
            /^[1-5]$/.test(input)
        ) {

            const selected =
                current.playlists[Number(input) - 1];

            if (!selected) {
                return reply(
                    "❌ වැරදි Playlist Number එකක්."
                );
            }

            await reply(
                "⏳ Episodes ලබාගනිමින්..."
            );

            const items = await getPlaylistVideos(
                selected.id.playlistId
            );

            const episodes = items
                .map(item => ({
                    item,
                    number: getEpisodeNumber(
                        item.snippet.title
                    )
                }))
                .filter(item =>
                    item.number !== null
                )
                .sort((a, b) =>
                    a.number - b.number
                )
                .map(item => ({
                    id: {
                        videoId:
                            item.item.snippet.resourceId.videoId
                    },
                    snippet: item.item.snippet
                }));

            if (!episodes.length) {
                return reply(
                    "❌ Episode අංක හඳුනාගත නොහැකි වුණා."
                );
            }

            const session = {
                category: "teledrama",
                name: selected.snippet.title,
                episodes,
                position: 0,
                sent: new Set(),
                running: false
            };

            global.csendVideoSessions.set(
                from,
                session
            );

            await reply(

"╭━━〔 ✅ PLAYLIST READY 〕━━╮ ┃ ┃ 📺 ${session.name} ┃ ┃ 🎬 Episodes : ${episodes.length} ┃ ⏱️ Interval : 3 Minutes ┃ ┃ Auto Sending Started! ┃ ╰━━━━━━━━━━━━━━━━━━━━╯"
);

            return startAutoSearch(
                sock,
                from,
                session
            );
        }

        return reply(
            "❌ වැරදි Option එකක්. .csendvideo නැවත ගහන්න."
        );

    } catch (error) {

        console.error(
            "[CSENDVIDEO]",
            error.response?.data || error
        );

        return reply(
            `❌ ERROR: ${error.message}`
        );
    }
}

};
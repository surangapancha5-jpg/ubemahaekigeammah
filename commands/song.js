const yts = require("yt-search");
const axios = require("axios");

if (!global.songSessions) {
    global.songSessions = new Map();
}

module.exports = {
    name: "song",
    alias: ["play", "mp3", "audio"],
    desc: "Download YouTube audio",
    category: "download",

    async execute(sock, msg, args, from, { reply, prefix }) {
        try {
            const query = args.join(" ").trim();

            if (!query) {
                return await reply(
                    `⚠️ *SONG DOWNLOADER*\n\n` +
                    `සින්දුවේ නම හෝ YouTube link එකක් ලබාදෙන්න.\n\n` +
                    `උදාහරණය:\n${prefix}song ma diha`
                );
            }

            if (!process.env.YT_API_KEY) {
                return await reply(
                    "❌ YT_API_KEY එක .env file එකේ සකස් කර නැහැ."
                );
            }

            await sock.sendMessage(from, {
                react: {
                    text: "🔍",
                    key: msg.key
                }
            });

            // 1. Search YouTube
            let videoUrl = query;
            let title = "";
            let duration = "";
            let views = "";
            let artist = "";
            let uploadYear = "";
            let thumbnail = "";

            if (!/^https?:\/\//i.test(query)) {
                const search = await yts(query);
                const video = search.videos?.[0];

                if (!video) {
                    return await reply(
                        "❌ සින්දුව සොයාගැනීමට නොහැකි විය."
                    );
                }

                videoUrl = video.url;
                title = video.title || "";
                duration = video.timestamp || "Unknown";
                views = Number(video.views || 0).toLocaleString();
                artist = video.author?.name || "YouTube Artist";
                uploadYear = video.ago || "N/A";
                thumbnail = video.thumbnail || "";
            } else {
                // Validate the supplied YouTube URL
                let parsedUrl;

                try {
                    parsedUrl = new URL(videoUrl);
                } catch {
                    return await reply("❌ URL එක නිවැරදි නැහැ.");
                }

                const host = parsedUrl.hostname
                    .toLowerCase()
                    .replace(/^www\./, "");

                if (
                    !["youtube.com", "m.youtube.com", "youtu.be",
                      "music.youtube.com"].includes(host)
                ) {
                    return await reply(
                        "❌ කරුණාකර නිවැරදි YouTube link එකක් ලබාදෙන්න."
                    );
                }

                try {
                    const search = await yts(videoUrl);
                    const video = search.videos?.[0];

                    if (video) {
                        title = video.title || "";
                        duration = video.timestamp || "Unknown";
                        views = Number(video.views || 0).toLocaleString();
                        artist = video.author?.name || "YouTube Artist";
                        uploadYear = video.ago || "N/A";
                        thumbnail = video.thumbnail || "";
                    }
                } catch (e) {
                    console.log("Metadata lookup failed:", e.message);
                }
            }

            await reply("⏳ *Song එක සකස් කරමින් පවතී...*");

            // 2. Download API engines
            let downloadUrl = null;

            // NEW ENGINE: Asitha API
            try {
                const response = await axios.get(
                    "https://back.asitha.top/api/ytapi",
                    {
                        params: {
                            apiKey: process.env.YT_API_KEY,
                            url: videoUrl,
                            fo: 1,
                            qu: 360
                        },
                        timeout: 25000
                    }
                );

                const data = response.data;

                console.log(
                    "Asitha API response:",
                    JSON.stringify(data).slice(0, 1500)
                );

                // Try common audio URL fields
                const candidates = [
                    data?.result?.download_url,
                    data?.result?.downloadUrl,
                    data?.result?.url,
                    data?.result?.link,
                    data?.result?.audio,
                    data?.data?.download_url,
                    data?.data?.downloadUrl,
                    data?.data?.url,
                    data?.data?.link,
                    data?.download_url,
                    data?.downloadUrl,
                    data?.audio_url,
                    data?.audioUrl,
                    data?.url,
                    data?.link
                ];

                downloadUrl = candidates.find(
                    value =>
                        typeof value === "string" &&
                        /^https?:\/\//i.test(value)
                ) || null;

                // Also support nested response objects
                if (!downloadUrl && data && typeof data === "object") {
                    const findUrl = (obj, depth = 0) => {
                        if (!obj || typeof obj !== "object" || depth > 5) {
                            return null;
                        }

                        for (const [key, value] of Object.entries(obj)) {
                            if (
                                typeof value === "string" &&
                                /^https?:\/\//i.test(value) &&
                                /(url|link|download|audio|mp3)/i.test(key)
                            ) {
                                return value;
                            }

                            if (value && typeof value === "object") {
                                const found = findUrl(value, depth + 1);
                                if (found) return found;
                            }
                        }

                        return null;
                    };

                    downloadUrl = findUrl(data);
                }

            } catch (e) {
                console.log(
                    "Asitha API failed:",
                    e.response?.data || e.message
                );
            }

            // ENGINE 2: Chamindu API
            if (!downloadUrl) {
                try {
                    const apiKey =
                        process.env.CHAMINDU_API_KEY;

                    if (apiKey) {
                        const res = await axios.get(
                            "https://api.chamindu.site/api/v1/youtube/mp3",
                            {
                                params: {
                                    url: videoUrl,
                                    quality: "320kbps",
                                    api_key: apiKey
                                },
                                timeout: 12000
                            }
                        );

                        if (res.data?.status && res.data?.data) {
                            downloadUrl =
                                res.data.data.download_url ||
                                res.data.data.direct_url ||
                                null;
                        }
                    }
                } catch (e) {
                    console.log("Chamindu API failed:", e.message);
                }
            }

            // ENGINE 3: BK9 API
            if (!downloadUrl) {
                try {
                    const res = await axios.get(
                        "https://bk9.fun/download/youtube",
                        {
                            params: { url: videoUrl },
                            timeout: 15000
                        }
                    );

                    if (res.data?.BK9?.BK8) {
                        downloadUrl = res.data.BK9.BK8;
                    }
                } catch (e) {
                    console.log("BK9 API failed:", e.message);
                }
            }

            // ENGINE 4: Vreden API
            if (!downloadUrl) {
                try {
                    const res = await axios.get(
                        "https://api.vreden.my.id/api/ytmp3",
                        {
                            params: { url: videoUrl },
                            timeout: 15000
                        }
                    );

                    downloadUrl =
                        res.data?.result?.download?.url || null;
                } catch (e) {
                    console.log("Vreden API failed:", e.message);
                }
            }

            if (!downloadUrl) {
                return await reply(
                    "❌ Audio link එක ලබාගැනීමට නොහැකි වුණා.\n\n" +
                    "API response එක පරීක්ෂා කරන්න."
                );
            }

            // 3. Song information card
            const finalTitle = title || "YouTube Audio";

            const songCard =
`╭───『 𝐃𝐀𝐑𝐊 𝐃𝐈𝐍𝐔 𝐒𝐎𝐍𝐆 』───◆
│
│ 🎼 *ᴛɪᴛʟᴇ:* ${finalTitle}
│ ⏳ *ᴅᴜʀᴀᴛɪᴏɴ:* ${duration || "Unknown"}
│ 👁️ *ᴠɪᴇᴡs:* ${views || "N/A"}
│ 🎙️ *ᴀʀᴛɪsᴛ:* ${artist || "YouTube Artist"}
│ 📅 *ᴜᴘʟᴏᴀᴅ:* ${uploadYear || "N/A"}
│
├───『 📥 𝐒𝐄𝐋𝐄𝐂𝐓 𝐅𝐎𝐑𝐌𝐀𝐓 』───
│
│  [1] 🎵 Audio (MP3)
│  [2] 📁 Document (File)
│  [3] 🎙️ Voice Note (PTT)
│
╰──────────────────────────◆
> Reply to this message with 1, 2, or 3
> ᴅᴀʀᴋ ᴅɪɴᴜ ᴍᴅ 🐦‍🔥`;

            let sentMsg;

            if (thumbnail) {
                sentMsg = await sock.sendMessage(
                    from,
                    {
                        image: { url: thumbnail },
                        caption: songCard
                    },
                    { quoted: msg }
                );
            } else {
                sentMsg = await sock.sendMessage(
                    from,
                    {
                        text: songCard
                    },
                    { quoted: msg }
                );
            }

            // 4. Save session for format selection
            if (sentMsg?.key?.id) {
                global.songSessions.set(sentMsg.key.id, {
                    title: finalTitle,
                    url: downloadUrl,
                    from,
                    createdAt: Date.now()
                });

                setTimeout(() => {
                    global.songSessions.delete(sentMsg.key.id);
                }, 10 * 60 * 1000);
            }

            await sock.sendMessage(from, {
                react: {
                    text: "⚡",
                    key: msg.key
                }
            });

        } catch (err) {
            console.error(
                "Song Error:",
                err.response?.data || err.message
            );

            await reply(
                "❌ Song command එකේ දෝෂයක් ඇති වුණා.\n" +
                "කරුණාකර නැවත උත්සාහ කරන්න."
            );
        }
    }
};
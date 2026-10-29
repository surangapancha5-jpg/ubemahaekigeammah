const axios = require("axios");

cmd({
    pattern: "song",
    alias: ["play", "ytaudio"],
    desc: "Download a song from YouTube",
    category: "download",
    use: ".song <YouTube URL>",
    react: "🎵"
}, async (conn, mek, m, {
    from, q, reply
}) => {
    try {
        if (!q) {
            return reply(
                "🎵 *SONG DOWNLOADER*\n\n" +
                "කරුණාකර YouTube link එකක් ලබා දෙන්න.\n\n" +
                "උදාහරණය:\n.song https://www.youtube.com/watch?v=VIDEO_ID"
            );
        }

        const videoUrl = q.trim();

        if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(videoUrl)) {
            return reply(
                "❌ කරුණාකර නිවැරදි YouTube URL එකක් ලබා දෙන්න."
            );
        }

        await reply("⏳ *Song එක ලබාගනිමින් පවතී...*");

        const apiUrl = "https://back.asitha.top/api/ytapi";

        const response = await axios.get(apiUrl, {
            params: {
                apiKey: process.env.YT_API_KEY,
                url: videoUrl,
                fo: 1,
                qu: 360
            },
            timeout: 60000
        });

        const data = response.data;

        // API response එකේ audio URL එක හඳුනාගැනීම
        const audioUrl =
            data?.result?.url ||
            data?.result?.downloadUrl ||
            data?.result?.download_url ||
            data?.url ||
            data?.downloadUrl ||
            data?.download_url;

        if (!audioUrl) {
            console.log("Song API response:", data);

            return reply(
                "❌ Audio link එක API response එකෙන් හමු වුණේ නැහැ.\n" +
                "API response එක පරීක්ෂා කරන්න."
            );
        }

        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: "song.mp3",
            ptt: false
        }, {
            quoted: mek
        });

    } catch (error) {
        console.error(
            "SONG ERROR:",
            error.response?.data || error.message
        );

        return reply(
            "❌ Song එක download කරන්න බැරි වුණා.\n" +
            "API key එක සහ API response එක පරීක්ෂා කරන්න."
        );
    }
});
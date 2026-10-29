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
            // ==========================================
            // PART 1: FORMAT SELECTION (1,2,3) HANDLER
            // ==========================================
            const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
            const selectedText = args.join(" ").trim() || msg.message?.extendedTextMessage?.text?.trim() || msg.message?.conversation?.trim();

            if (quotedId && global.songSessions.has(quotedId) && ["1", "2", "3"].includes(selectedText)) {
                const session = global.songSessions.get(quotedId);
                if (session.from !== from) return;

                await sock.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

                try {
                    const res = await axios.get(session.url, {
                        responseType: 'arraybuffer',
                        timeout: 60000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });

                    const buffer = Buffer.from(res.data);
                    const fileName = `${session.title.replace(/[\\/:*?"<>|]/g, '')}.mp3`.slice(0, 80);

                    if (selectedText === "1") {
                        await sock.sendMessage(from, {
                            audio: buffer,
                            mimetype: 'audio/mpeg',
                            fileName: fileName
                        }, { quoted: msg });
                    } else if (selectedText === "2") {
                        await sock.sendMessage(from, {
                            document: buffer,
                            mimetype: 'audio/mpeg',
                            fileName: fileName
                        }, { quoted: msg });
                    } else if (selectedText === "3") {
                        await sock.sendMessage(from, {
                            audio: buffer,
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: msg });
                    }

                    global.songSessions.delete(quotedId);
                    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

                } catch (e) {
                    console.log("Send failed:", e.message);
                    await reply("❌ File එක යවන්න බැරි වුණා. Link එක expire වෙලා. නැවත `"+prefix+"song` කියලා හොයන්න.");
                    global.songSessions.delete(quotedId);
                }
                return;
            }

            // ==========================================
            // PART 2: SEARCH & GET DOWNLOAD LINK
            // ==========================================
            const query = args.join(" ").trim();
            if (!query) {
                return await reply(`⚠️ *SONG DOWNLOADER*\n\nසින්දුවේ නම හෝ YouTube link එකක් ලබාදෙන්න.\n\nඋදා: ${prefix}song ma diha`);
            }

            await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });

            let videoUrl = query;
            let title = "", duration = "", views = "", artist = "", uploadYear = "", thumbnail = "";

            // Search
            try {
                let searchQuery = query;
                if (/^https?:\/\//i.test(query)) searchQuery = query;
                
                const search = await yts(searchQuery);
                const video = search.videos?.[0];
                if (!video) return await reply("❌ සින්දුව සොයාගැනීමට නොහැකි විය.");

                videoUrl = video.url;
                title = video.title || "YouTube Audio";
                duration = video.timestamp || "Unknown";
                views = Number(video.views || 0).toLocaleString();
                artist = video.author?.name || "YouTube Artist";
                uploadYear = video.ago || "N/A";
                thumbnail = video.thumbnail || "";
            } catch (e) {
                console.log("YT Search failed:", e.message);
                return await reply("❌ YouTube search එක block වෙලා. VPN / වෙන VPS එකක් try කරන්න.");
            }

            await sock.sendMessage(from, { text: "⏳ *Song එක සකස් කරමින් පවතී...*" }, { quoted: msg });

            // --- ROBUST MULTI-ENGINE ---
            let downloadUrl = null;

            const getAsitha = async () => {
                if (!process.env.YT_API_KEY) throw new Error("No YT_API_KEY");
                const res = await axios.get("https://back.asitha.top/api/ytapi", {
                    params: { apiKey: process.env.YT_API_KEY, url: videoUrl, fo: 1, qu: 128 },
                    timeout: 20000
                });
                const d = res.data;
                return d?.result?.download_url || d?.result?.downloadUrl || d?.data?.download_url || d?.download_url || d?.url || null;
            };

            const getChamindu = async () => {
                if (!process.env.CHAMINDU_API_KEY) throw new Error("No Chamindu Key");
                const res = await axios.get("https://api.chamindu.site/api/v1/youtube/mp3", {
                    params: { url: videoUrl, quality: "128kbps", api_key: process.env.CHAMINDU_API_KEY },
                    timeout: 15000
                });
                return res.data?.data?.download_url || res.data?.data?.direct_url || null;
            };

            const getBk9 = async () => {
                const res = await axios.get("https://bk9.fun/download/youtube", {
                    params: { url: videoUrl },
                    timeout: 15000
                });
                return res.data?.BK9?.BK8 || null;
            };

            const getVreden = async () => {
                const res = await axios.get("https://api.vreden.my.id/api/ytmp3", {
                    params: { url: videoUrl },
                    timeout: 15000
                });
                return res.data?.result?.download?.url || null;
            };

            const engines = [getAsitha, getChamindu, getBk9, getVreden];

            try {
                // එක පාර ඔක්කොම run කරලා මුලින්ම එන එක ගන්නවා
                const results = await Promise.allSettled(engines.map(f => f()));
                for (const r of results) {
                    if (r.status === 'fulfilled' && r.value && /^https?:\/\//i.test(r.value)) {
                        downloadUrl = r.value;
                        break;
                    }
                }
            } catch (e) {
                console.log("Engine error", e.message);
            }

            if (!downloadUrl) {
                return await reply("❌ Audio link එක ලබාගැනීමට නොහැකි වුණා. API ඔක්කොම down. විනාඩි 2කින් නැවත උත්සාහ කරන්න.");
            }

            // --- CARD ---
            const songCard = `╭───『 𝐃𝐀𝐑𝐊 𝐃𝐈𝐍𝐔 𝐒𝐎𝐍𝐆 』───◆\n│\n│ 🎼 *ᴛɪᴛʟᴇ:* ${title}\n│ ⏳ *ᴅᴜʀᴀᴛɪᴏɴ:* ${duration}\n│ 👁️ *ᴠɪᴇᴡs:* ${views}\n│ 🎙️ *ᴀʀᴛɪsᴛ:* ${artist}\n│ 📅 *ᴜᴘʟᴏᴀᴅ:* ${uploadYear}\n│\n├───『 📥 𝐒𝐄𝐋𝐄𝐂𝐓 𝐅𝐎𝐑𝐌𝐀𝐓 』───\n│\n│  [1] 🎵 Audio (MP3)\n│  [2] 📁 Document (File)\n│  [3] 🎙️ Voice Note (PTT)\n│\n╰──────────────────────────◆\n> Reply to this message with 1, 2, or 3\n> ᴅᴀʀᴋ ᴅɪɴᴜ ᴍᴅ 🐦‍🔥`;

            let sentMsg;
            if (thumbnail) {
                sentMsg = await sock.sendMessage(from, { image: { url: thumbnail }, caption: songCard }, { quoted: msg });
            } else {
                sentMsg = await sock.sendMessage(from, { text: songCard }, { quoted: msg });
            }

            if (sentMsg?.key?.id) {
                global.songSessions.set(sentMsg.key.id, {
                    title: title,
                    url: downloadUrl,
                    from,
                    createdAt: Date.now()
                });
                setTimeout(() => global.songSessions.delete(sentMsg.key.id), 3 * 60 * 1000); // 3min only - link expire වෙන නිසා
            }

            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });

        } catch (err) {
            console.error("Song Error:", err.message);
            await reply("❌ දෝෂයක් ඇති වුණා. නැවත උත්සාහ කරන්න.");
        }
    }
};
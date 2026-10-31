const yts = require("yt-search");
const axios = require("axios");

const API_KEY = process.env.YT_API_KEY;
const API_URL = "https://back.asitha.top/api/ytapi";

const GIFT_VIDEO =
  "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

module.exports = {
    name: "song",
    alias: ["play", "mp3", "audio"],
    desc: "Download YouTube songs as MP3",
    category: "download",
    use: ".song <song name or YouTube URL>",

    async execute(sock, msg, args, from, { reply, prefix }) {
        try {
            const query = args.join(" ").trim();
            const sender = msg.pushName || "User";

            // BOX DESIGN
            const makeBox = (content) => `
╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨: ${sender}
┃◈┃• 🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧: 1.0
┃◈└───────────┈⊷
╰──────────────┈⊷

${content}

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            const errorBox = (error) => makeBox(`
╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ${error}
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷`);

            // SEND GIFT VIDEO WITH CAPTION
            async function sendGift(caption) {
                try {
                    const response = await axios.get(GIFT_VIDEO, {
                        responseType: "arraybuffer",
                        timeout: 60000
                    });

                    const videoBuffer = Buffer.from(response.data);

                    await sock.sendMessage(
                        from,
                        {
                            video: videoBuffer,
                            mimetype: "video/mp4",
                            gifPlayback: true,
                            caption: caption
                        },
                        { quoted: msg }
                    );

                    return true;
                } catch (error) {
                    console.error("GIFT VIDEO ERROR:", error.message);

                    await sock.sendMessage(
                        from,
                        { text: caption },
                        { quoted: msg }
                    );

                    return false;
                }
            }

            // 1. CHECK QUERY
            if (!query) {
                return await reply(makeBox(`
╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴜꜱᴇ : .ꜱᴏɴɢ ʟᴇʟᴇɴᴀ
┃◈┃⛩️ ᴜꜱᴇ : .ꜱᴏɴɢ ʟɪɴᴋ
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷`));
            }

            // 2. CHECK API KEY
            if (!API_KEY) {
                return await reply(
                    errorBox("YT_API_KEY ᴍɪꜱꜱɪɴɢ ɪɴ ᴇɴᴠ")
                );
            }

            await sock.sendMessage(from, {
                react: {
                    text: "⛩️",
                    key: msg.key
                }
            });

            // 3. YOUTUBE DETAILS
            let videoUrl = query;
            let title = "YouTube Audio";
            let duration = "Unknown";
            let artist = "Unknown";
            let views = "N/A";
            let uploadYear = "N/A";

            if (!/^https?:\/\//i.test(query)) {
                const search = await yts(query);
                const video = search.videos?.[0];

                if (!video) {
                    return await sendGift(
                        errorBox("ᴄᴏᴜʟᴅɴ'ᴛ ꜰɪɴᴅ ᴛʜᴇ ꜱᴏɴɢ")
                    );
                }

                videoUrl = video.url;
                title = video.title;
                duration = video.timestamp || "Unknown";
                artist = video.author?.name || "Unknown";
                views = Number(video.views || 0).toLocaleString();
                uploadYear = video.ago || "N/A";

            } else {
                try {
                    const search = await yts(query);
                    const video = search.videos?.find(
                        v => v.url === query
                    ) || search.videos?.[0];

                    if (video) {
                        title = video.title;
                        duration = video.timestamp || "Unknown";
                        artist = video.author?.name || "Unknown";
                        views = Number(video.views || 0).toLocaleString();
                        uploadYear = video.ago || "N/A";
                    }
                } catch (e) {
                    console.log("Metadata Error:", e.message);
                }
            }

            // 4. ASITHA API
            let response;

            try {
                response = await axios.get(API_URL, {
                    params: {
                        apiKey: API_KEY,
                        url: videoUrl,
                        fo: 0,
                        qu: 320
                    },
                    timeout: 60000
                });

            } catch (apiError) {
                console.error(
                    "ASITHA API ERROR:",
                    apiError.response?.status,
                    apiError.response?.data || apiError.message
                );

                return await sendGift(
                    errorBox("ᴀᴩɪ ᴅᴏᴡɴ / ᴀᴩɪ ʀᴇQᴜᴇꜱᴛ ꜰᴀɪʟᴇᴅ")
                );
            }

            const data = response.data;

            console.log(
                "Asitha API response:",
                JSON.stringify(data).slice(0, 1500)
            );

            if (
                data?.status === false ||
                data?.success === false ||
                data?.error
            ) {
                return await sendGift(
                    errorBox("ᴀᴩɪ ᴅᴏᴡɴ")
                );
            }

            // 5. FIND AUDIO URL
            function findAudioUrl(obj, depth = 0) {
                if (!obj || depth > 10) return null;

                const preferredKeys = [
                    "download_url",
                    "downloadUrl",
                    "audio_url",
                    "audioUrl",
                    "mp3",
                    "download",
                    "direct_url",
                    "url",
                    "link"
                ];

                if (typeof obj === "string") {
                    if (
                        /^https?:\/\//i.test(obj) &&
                        !/youtube\.com\/watch|youtu\.be\//i.test(obj) &&
                        !/\.(jpg|jpeg|png|webp)(\?|$)/i.test(obj)
                    ) {
                        return obj;
                    }

                    return null;
                }

                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        const result = findAudioUrl(item, depth + 1);
                        if (result) return result;
                    }

                    return null;
                }

                if (typeof obj === "object") {
                    for (const key of preferredKeys) {
                        if (obj[key]) {
                            const result = findAudioUrl(
                                obj[key],
                                depth + 1
                            );

                            if (result) return result;
                        }
                    }

                    for (const [key, value] of Object.entries(obj)) {
                        if (!preferredKeys.includes(key)) {
                            const result = findAudioUrl(
                                value,
                                depth + 1
                            );

                            if (result) return result;
                        }
                    }
                }

                return null;
            }

            const downloadUrl = findAudioUrl(data);

            if (!downloadUrl) {
                console.log(
                    "AUDIO URL NOT FOUND:",
                    JSON.stringify(data).slice(0, 2000)
                );

                return await sendGift(
                    errorBox("ᴀᴩɪ ᴅᴏᴡɴ - ᴀᴜᴅɪᴏ ᴜʀʟ ɴᴏᴛ ꜰᴏᴜɴᴅ")
                );
            }

            // 6. SONG INFORMATION BOX
            const songInfo = makeBox(`
╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨: ${sender}
┃◈┃• 🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧: 1.0
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴅᴜʀᴀᴛɪᴏɴ : ${duration}
┃◈┃
┃◈┃⛩️ ᴠɪᴇᴡꜱ : ${views}
┃◈┃
┃◈┃⛩️ ᴀʀᴛɪꜱᴛ : ${artist}
┃◈┃
┃◈┃⛩️ ᴜᴩʟᴏᴀᴅᴇᴅ : ${uploadYear}
┃◈┃
┃◈┃⛩️ ꜰᴏʀᴍᴀᴛ : Audio
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷`);

            // 7. SEND GIFT VIDEO + SONG BOX TOGETHER
            await sendGift(songInfo);

            // 8. DOWNLOAD AUDIO
            await sock.sendMessage(from, {
                react: {
                    text: "📩",
                    key: msg.key
                }
            });

            const audioResponse = await axios.get(downloadUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 50 * 1024 * 1024,
                maxBodyLength: 50 * 1024 * 1024
            });

            const audioBuffer = Buffer.from(audioResponse.data);

            const contentType =
                audioResponse.headers["content-type"] || "";

            if (
                !audioBuffer.length ||
                /text\/html|application\/json/i.test(contentType)
            ) {
                return await sendGift(
                    errorBox("ᴄᴏᴜʟᴅɴ'ᴛ ᴅᴏᴡɴʟᴏᴀᴅ ᴀᴜᴅɪᴏ")
                );
            }

            // 9. SEND MP3
            const safeTitle = title
                .replace(/[\\/:*?"<>|]/g, "_")
                .slice(0, 150);

            await sock.sendMessage(
                from,
                {
                    audio: audioBuffer,
                    mimetype: "audio/mpeg",
                    fileName: `${safeTitle}.mp3`,
                    ptt: false
                },
                { quoted: msg }
            );

            // 10. SUCCESS REACTION
            await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            });

        } catch (err) {
            console.error(
                "SONG COMMAND ERROR:",
                err.response?.data || err.message
            );

            const sender = msg.pushName || "User";

            const errorMessage = `
╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• 🤠 𝐇𝐞𝐥𝐥𝐨: ${sender}
┃◈┃• 🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧: 1.0
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ᴄᴏᴜʟᴅɴ'ᴛ ꜰɪɴᴅ ᴛʜᴇ ꜱᴏɴɢ
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            try {
                const videoResponse = await axios.get(GIFT_VIDEO, {
                    responseType: "arraybuffer",
                    timeout: 60000
                });

                await sock.sendMessage(
                    from,
                    {
                        video: Buffer.from(videoResponse.data),
                        mimetype: "video/mp4",
                        gifPlayback: true,
                        caption: errorMessage
                    },
                    { quoted: msg }
                );

            } catch (giftError) {
                console.error("ERROR GIFT:", giftError.message);
                await reply(errorMessage);
            }
        }
    }
};
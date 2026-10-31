const axios = require("axios");

const GIFT_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

let giftCache = null;

async function getGiftVideo() {
    if (!giftCache) {
        const response = await axios.get(GIFT_VIDEO, {
            responseType: "arraybuffer",
            timeout: 60000
        });

        giftCache = Buffer.from(response.data);
    }

    return giftCache;
}

module.exports = {
    name: "tagall",
    alias: ["everyone", "all"],
    desc: "Tag all members with gift video and group photo",
    category: "group",
    use: ".tagall <message>",

    async execute(sock, msg, args, from) {
        try {
            // CHECK GROUP
            if (!from.endsWith("@g.us")) {
                return await sock.sendMessage(
                    from,
                    {
                        text: "╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${msg.pushName || "User"}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃ 
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ɢʀᴏᴜᴩ ᴏɴʟy 
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷"
                    },
                    { quoted: msg }
                );
            }

            // REACT
            await sock.sendMessage(from, {
                react: {
                    text: "🫟",
                    key: msg.key
                }
            });

            // GROUP DETAILS
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants || [];

            // RANDOM EMOJIS
            const emojiList = [
                "🐣", "🦋", "🐥"
            ];

            const getRandomEmoji = () =>
                emojiList[Math.floor(Math.random() * emojiList.length)];

            const customMessage =
                args.join(" ") || "Attention Everyone!";

            // MEMBERS
            const mentions = [];
            let memberList = "";

            for (const member of participants) {
                const memberId = member.id || member.jid;

                if (!memberId) continue;

                mentions.push(memberId);

                memberList +=
                    `┃◈┃⛩️${getRandomEmoji()} @${memberId.split("@")[0]}\n`;
            }

            // TAGALL BOX
            const tagText =
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *${getRandomEmoji()} 𝐆𝐑𝐎𝐔𝐏 𝐀𝐍𝐍𝐎𝐔𝐍𝐂𝐄𝐌𝐄𝐍𝐓*
┃◈┃• *👥 𝐆𝐑𝐎𝐔𝐏:* ${groupMetadata.subject}
┃◈┃• *👤 𝐌𝐄𝐌𝐁𝐄𝐑𝐒:* ${mentions.length}
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐓𝐀𝐆𝐀𝐋𝐋 𝐌𝐄𝐒𝐒𝐀𝐆𝐄* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃${getRandomEmoji()} *𝐌𝐄𝐒𝐒𝐀𝐆𝐄:*
┃◈┃ ${customMessage}
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐀𝐋𝐋 𝐌𝐄𝐌𝐁𝐄𝐑𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
${memberList}┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            // GET GROUP PHOTO
            let ppUrl = null;

            try {
                ppUrl = await sock.profilePictureUrl(from, "image");
            } catch (error) {
                ppUrl = null;
            }

            // STEP 1 - SEND GIFT VIDEO
            const giftVideo = await getGiftVideo();

            await sock.sendMessage(
                from,
                {
                    video: giftVideo,
                    mimetype: "video/mp4",
                    gifPlayback: true
                },
                { quoted: msg }
            );

            // STEP 2 - SEND GROUP PHOTO + TAGALL
            if (ppUrl) {
                await sock.sendMessage(
                    from,
                    {
                        image: { url: ppUrl },
                        caption: tagText,
                        mentions: mentions
                    },
                    { quoted: msg }
                );
            } else {
                await sock.sendMessage(
                    from,
                    {
                        text: tagText,
                        mentions: mentions
                    },
                    { quoted: msg }
                );
            }

        } catch (err) {
            console.error("[TAGALL ERROR]", err);

            await sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${msg.pushName || "User"}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃ 
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ${err.message}
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷`
                },
                { quoted: msg }
            );
        }
    }
};
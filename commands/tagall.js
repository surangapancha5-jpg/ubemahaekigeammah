const axios = require("axios");

const GIFT_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

let giftCache = null;

// DOWNLOAD GIFT VIDEO
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

// SEND GIFT + MESSAGE TOGETHER
async function sendGift(sock, from, msg, caption, mentions = []) {
    try {
        const giftVideo = await getGiftVideo();

        await sock.sendMessage(
            from,
            {
                video: giftVideo,
                mimetype: "video/mp4",
                gifPlayback: true,
                caption: caption,
                mentions: mentions
            },
            { quoted: msg }
        );

        return true;

    } catch (error) {
        console.error("[GIFT VIDEO ERROR]", error.message);

        // Gift video fail වුණොත් text message එක යවන්න
        await sock.sendMessage(
            from,
            {
                text: caption,
                mentions: mentions
            },
            { quoted: msg }
        ).catch(() => {});

        return false;
    }
}

// ERROR MESSAGE
async function sendError(sock, from, msg, errorText) {
    const errorMessage =
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${msg.pushName || "User"}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ :
┃◈┃ ${errorText}
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

    await sendGift(sock, from, msg, errorMessage);
}

module.exports = {
    name: "tagall",
    alias: ["everyone", "all"],
    desc: "Tag all members with gift video",
    category: "group",
    use: ".tagall <message>",

    async execute(sock, msg, args, from) {
        try {
            // CHECK GROUP
            if (!from.endsWith("@g.us")) {
                await sendError(
                    sock,
                    from,
                    msg,
                    "GROUP ONLY"
                );
                return;
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
                "🐣"
            ];

            const getRandomEmoji = () =>
                emojiList[
                    Math.floor(Math.random() * emojiList.length)
                ];

            const customMessage =
                args.join(" ").trim() || "Attention Everyone!";

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

            // SEND GIFT VIDEO + TAGALL MESSAGE AS ONE MESSAGE
            await sendGift(
                sock,
                from,
                msg,
                tagText,
                mentions
            );

        } catch (err) {
            console.error("[TAGALL ERROR]", err);

            await sendError(
                sock,
                from,
                msg,
                err.message || "UNKNOWN ERROR"
            );
        }
    }
};
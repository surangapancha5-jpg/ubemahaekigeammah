const axios = require("axios");
const { OWNER_NUMBER } = require("../config");

const ROUND_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793441049/zanta_media_uploads/md84nwujtycksl682hzj.mp4";

const GIFT_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

const INTRO_TEXT =
    '*ᥫ᭡" 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃  𝐎𝐅𝐅𝐈𝐂𝐈𝐀𝐋 🐻🤍🍓*';

let roundCache = null;
let giftCache = null;

const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

// DOWNLOAD VIDEO
async function downloadVideo(url) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 60000
    });

    return Buffer.from(response.data);
}

// ROUND VIDEO CACHE
async function getRoundVideo() {
    if (!roundCache) {
        roundCache = await downloadVideo(ROUND_VIDEO);
    }

    return roundCache;
}

// GIFT VIDEO CACHE
async function getGiftVideo() {
    if (!giftCache) {
        giftCache = await downloadVideo(GIFT_VIDEO);
    }

    return giftCache;
}

async function sendLiveIntro(sock, from, msg) {
    await sock.sendMessage(
        from,
        {
            text: INTRO_TEXT
        },
        {
            quoted: msg
        }
    );
}

// OWNER PAIR NUMBER
function getOwnerNumber() {
    return String(
        OWNER_NUMBER || process.env.OWNER_NUMBER || ""
    ).replace(/[^0-9]/g, "");
}

module.exports = {
    name: "menu",
    alias: ["help", "allmenu"],
    desc: "ZANTA-XMD All Commands Menu",
    category: "main",
    use: ".menu",

    async execute(sock, msg, args, from, { reply }) {
        try {
            const userName = msg.pushName || "User";

            const ownerNumber = getOwnerNumber();

            const pairLink = ownerNumber
                ? `https://wa.me/${ownerNumber}?text=.pair`
                : null;

            // MENU TEXT
            const menuText =
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${userName}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐌𝐀𝐈𝐍 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ᴀʟɪᴠᴇ
┃◈┃⛩️ .ᴩɪɴɢ
┃◈┃⛩️ .ᴩᴀɪʀ
┃◈┃⛩️ .ᴊɪᴅ
┃◈┃⛩️ .ᴏᴡɴᴇʀ
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐆𝐑𝐎𝐔𝐏 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ᴩʀᴏᴍᴏᴛᴇ
┃◈┃⛩️ .ᴅᴇᴍᴏᴛᴇ
┃◈┃⛩️ .ɢᴩᴏᴩᴇɴ
┃◈┃⛩️ .ɢᴩᴄʟᴏꜱᴇ
┃◈┃⛩️ .ɢɪɴꜰᴏ
┃◈┃⛩️ .ᴛᴀɢᴀʟʟ
┃◈┃⛩️ .ʜɪᴅᴇᴛᴀɢ
┃◈┃⛩️ .ᴛᴀɢᴀᴅᴍɪɴꜱ
┃◈┃⛩️ .ʟᴇꜰᴛ
┃◈┃⛩️ .ʜʏᴊᴀᴄᴋ
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐌𝐄𝐃𝐈𝐀 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ꜱᴀᴠᴇ
┃◈┃⛩️ .ɢᴇᴛᴅᴩ
┃◈┃⛩️ .ɪᴍɢ
┃◈┃⛩️ .ɪɴ
┃◈┃⛩️ .ꜱᴛɪᴄᴋᴇʀ
┃◈┃⛩️ .ᴛᴏɪᴍɢ
┃◈┃⛩️ .ꜱᴏɴɢ
┃◈┃⛩️ .ᴠɪᴅᴇᴏ
┃◈┃⛩️ .ɪɢ
┃◈┃⛩️ .ꜰʙ
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐌𝐄𝐃𝐈𝐀 𝐓𝐎𝐎𝐋𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ꜱᴀᴠᴇ
┃◈┃⛩️ .ɢᴇᴛᴅᴩ
┃◈┃⛩️ .ꜱᴛɪᴄᴋᴇʀ
┃◈┃⛩️ .ᴛᴏɪᴍɢ
┃◈┃⛩️ .ᴛᴏᴠɪᴅᴇᴏ
┃◈┃⛩️ .ᴛᴏᴍᴩ3
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ꜰʙ
┃◈┃⛩️ .ɪɢ
┃◈┃⛩️ .ɪɴ
┃◈┃⛩️ .ɪᴍɢ
┃◈┃⛩️ .ꜱᴏɴɢ
┃◈┃⛩️ .ᴠɪᴅᴇᴏ
┃◈┃⛩️ .ᴄᴍᴜꜱɪᴄ
┃◈┃⛩️ .ᴀᴩᴋ
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐍𝐄𝐖 𝐈𝐌𝐆 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ᴀɴɪᴍᴇ
┃◈┃⛩️ .ᴡᴀʟʟᴩᴀᴩᴇʀ
┃◈┃⛩️ .ʟᴏɢᴏ
┃◈┃⛩️ .ᴄᴀᴛ
┃◈┃⛩️ .ᴅᴏɢ
┃◈┃⛩️ .ɢɪʀʟ
┃◈┃⛩️ .ʙᴏʏ
┃◈┃⛩️ .8ᴋ
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐍𝐄𝐖 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ꜰꜰɪɴꜰᴏ
┃◈┃⛩️ .ʙᴏᴏᴄᴋ
┃◈┃⛩️ .ʟʏʀɪᴄꜱ
┃◈┃⛩️ .ᴛᴏꜱᴇɴᴅ
┃◈┃⛩️ .ꜱᴀʟᴇ
┃◈┃⛩️ .ᴠɪᴇᴡꜱᴀʟᴇ
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐅𝐔𝐍 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .ʜᴀᴄᴋ
┃◈┃⛩️ .ʟᴏᴀᴅᴄʜᴀᴛ
┃◈┃⛩️ .ᴠᴠ
┃◈┃⛩️ .ᴀɪ
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐄𝐌𝐎𝐉𝐈 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ .😂
┃◈┃⛩️ .😙
┃◈┃⛩️ .😭
┃◈┃⛩️ .❤️
┃◈└───────────┈⊷
╰──────────────┈⊷

${pairLink ? `> ${pairLink}` : "> OWNER_NUMBER එක config.js හෝ Heroku Config Vars වල සකසන්න."}
> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            // STEP 1 - LIVE INTRO
            await sendLiveIntro(sock, from, msg);

            // STEP 2 - ROUND VIDEO
            const roundVideo = await getRoundVideo();

            await sock.sendMessage(
                from,
                {
                    video: roundVideo,
                    mimetype: "video/mp4",
                    ptv: true
                },
                {
                    quoted: msg
                }
            );

            // STEP 3 - GIFT VIDEO + MENU
            const giftVideo = await getGiftVideo();

            await sock.sendMessage(
                from,
                {
                    video: giftVideo,
                    mimetype: "video/mp4",
                    gifPlayback: true,
                    caption: menuText
                },
                {
                    quoted: msg
                }
            );

        } catch (error) {
            console.error("[MENU ERROR]", error);

            await reply(
                "❌ MENU ERROR!\n\n" +
                "Menu එක යැවීමට නොහැකි වුණා.\n" +
                "Error: " + error.message
            );
        }
    }
};
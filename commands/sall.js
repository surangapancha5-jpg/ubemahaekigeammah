const mongoose = require("mongoose");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

// SELL DATABASE MODEL
const SellSchema = new mongoose.Schema({
    seller: {
        type: String,
        required: true
    },

    description: {
        type: String,
        required: true
    },

    category: {
        type: String,
        enum: ["game", "accounts", "other"],
        required: true
    },

    image: {
        type: Buffer,
        required: true
    },

    mimetype: {
        type: String,
        default: "image/jpeg"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const SellModel =
    mongoose.models.ZantaSell ||
    mongoose.model("ZantaSell", SellSchema);

// GET IMAGE MESSAGE
function getImageMessage(msg) {
    const message = msg.message || {};

    // Direct image
    if (message.imageMessage) {
        return msg;
    }

    // Quoted image
    const context =
        message.extendedTextMessage?.contextInfo ||
        message.imageMessage?.contextInfo;

    if (context?.quotedMessage?.imageMessage) {
        return {
            key: {
                remoteJid: msg.key.remoteJid,
                id: context.stanzaId,
                participant: context.participant
            },
            message: context.quotedMessage
        };
    }

    return null;
}

// GET TEXT
function getMessageText(msg) {
    const message = msg.message || {};

    return (
        message.imageMessage?.caption ||
        message.extendedTextMessage?.text ||
        message.conversation ||
        ""
    ).trim();
}

module.exports = {
    name: "sell",
    alias: ["sale", "addsell"],
    desc: "Add product to ZANTA-XMD Marketplace",
    category: "market",
    use: ".sell <photo> + description + category",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // CHECK DATABASE
            if (mongoose.connection.readyState !== 1) {
                return reply("❌ MongoDB Database එක Connect වී නැහැ.");
            }

            // FIND IMAGE
            const imageMessage = getImageMessage(msg);

            if (!imageMessage) {
                return reply(
                    "❌ Photo එකක් අවශ්‍යයි!\n\n" +
                    "Photo එකක් සමඟ Caption එකක් ලෙස මෙය යවන්න:\n\n" +
                    ".sell\n" +
                    "Free Fire Account\n" +
                    "Level 70 | Rare Bundles\n" +
                    "Price: 5000\n" +
                    "+ game"
                );
            }

            // GET CAPTION
            const caption = getMessageText(msg);

            if (!caption.toLowerCase().startsWith(".sell")) {
                return reply("❌ Photo එකේ Caption එකට .sell යොදන්න.");
            }

            // REMOVE COMMAND
            const content = caption.substring(5).trim();

            // SPLIT DESCRIPTION AND CATEGORY
            const parts = content.split("+");

            if (parts.length < 2) {
                return reply(
                    "❌ Category එක සඳහන් කරන්න!\n\n" +
                    "උදාහරණය:\n" +
                    ".sell\n" +
                    "Free Fire Account\n" +
                    "Level 70\n" +
                    "Price: 5000\n" +
                    "+ game"
                );
            }

            const category = parts.pop().trim().toLowerCase();
            const description = parts.join("+").trim();

            // VALIDATE CATEGORY
            const validCategories = [
                "game",
                "accounts",
                "other"
            ];

            if (!validCategories.includes(category)) {
                return reply(
                    "❌ වැරදි Category එකක්!\n\n" +
                    "Available Categories:\n\n" +
                    "🎮 game\n" +
                    "👤 accounts\n" +
                    "📦 other"
                );
            }

            if (!description) {
                return reply("❌ Product Description එකක් ඇතුළත් කරන්න.");
            }

            // DOWNLOAD IMAGE
            await reply("⏳ Product එක MongoDB එකට Save කරමින් පවතී...");

            const imageBuffer = await downloadMediaMessage(
                imageMessage,
                "buffer",
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
                return reply("❌ Photo එක Download කරගැනීමට නොහැකි වුණා.");
            }

            // SAVE TO MONGODB
            const savedProduct = await SellModel.create({
                seller: msg.key.participant || msg.key.remoteJid,
                description,
                category,
                image: imageBuffer,
                mimetype: imageMessage.message.imageMessage.mimetype || "image/jpeg"
            });

            // SUCCESS MESSAGE
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

╭━━〔 *𝐍𝐄𝐖 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃
┃◈┃⛩️ ɪᴅ : ${savedProduct._id}
┃◈┃⛩️ ᴄᴀᴛᴇɢᴏʀy : ${category.toUpperCase()}
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

📰 ᴅᴇᴛᴀɪʟꜱ : ${description}
> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐌𝐀𝐑𝐊𝐄𝐓`
                },
                { quoted: msg }
            );

        } catch (error) {
            console.error("[SELL ERROR]", error);

            await reply(
                "❌ SELL ERROR!\n\n" +
                error.message
            );
        }
    }
};
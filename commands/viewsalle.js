const mongoose = require("mongoose");

// SAME MODEL USED IN sell.js
const SellSchema = new mongoose.Schema({
    seller: String,
    description: String,
    category: {
        type: String,
        enum: ["game", "accounts", "other"]
    },
    image: Buffer,
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

module.exports = {
    name: "viewsale",
    alias: ["viewsell", "sales"],
    desc: "View Latest 10 Marketplace Products",
    category: "market",
    use: ".viewsale <category>",

    async execute(sock, msg, args, from, { reply }) {
        try {
            if (mongoose.connection.readyState !== 1) {
                return reply("❌ MongoDB Database එක Connect වී නැහැ.");
            }

            const category = (args[0] || "").toLowerCase();

            const validCategories = [
                "game",
                "accounts",
                "other"
            ];

            if (!validCategories.includes(category)) {
                return reply(
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${msg.pushName || "User"}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐍𝐄𝐖 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃ 🐣 *භාවිතා කරන ආකාරය*
┃◈┃
┃◈┃⛩️  : .ᴠɪᴇᴡꜱᴀʟᴇ ɢᴀᴍᴇ
┃◈┃⛩️  : .ᴠɪᴇᴡꜱᴀʟᴇ ᴀᴄᴄᴏᴜɴᴛꜱ
┃◈┃⛩️  : .ᴠɪᴇᴡꜱᴀʟᴇ ᴏᴛʜᴇʀ
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷`
                );
            }

            await reply("🔍 Products සොයමින් පවතී...");

            // GET LATEST 10 PRODUCTS
            const products = await SellModel.find({
                category: category
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            if (!products.length) {
                return reply(
                    `❌ ${category.toUpperCase()} Category එකේ Products කිසිවක් හමු වුණේ නැහැ.`
                );
            }

            // SEND EACH PRODUCT
            for (let i = 0; i < products.length; i++) {
                const product = products[i];

                const sellerNumber = String(product.seller || "")
                    .split("@")[0];

                const date = new Date(product.createdAt)
                    .toLocaleString("en-GB", {
                        timeZone: "Asia/Colombo"
                    });

                const caption =
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
┃◈┃⛩️ ɴᴇᴡ ꜱᴀʟᴇꜱ : ${i + 1}/10
┃◈┃⛩️ ɪᴅ : ${product._id
┃◈┃⛩️ ᴄᴀᴛᴇɢᴏʀy : ${product.category.toUpperCase()}
┃◈┃⛩️ ᴅᴀᴛᴇ : ${date}
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

📰 ᴅᴇᴛᴀɪʟꜱ : ${product.description}
🐣 ꜱᴇʟʟᴇʀ : ${sellerNumber}
> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐌𝐀𝐑𝐊𝐄𝐓`;

                await sock.sendMessage(
                    from,
                    {
                        image: Buffer.from(product.image),
                        mimetype: product.mimetype || "image/jpeg",
                        caption: caption
                    },
                    {
                        quoted: msg
                    }
                );
            }

            await sock.sendMessage(
                from,
                {
                    text:
`✅ ${category.toUpperCase()} Category එකේ අලුත්ම ${products.length} Products පෙන්වා අවසන්.

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐌𝐀𝐑𝐊𝐄𝐓`
                },
                { quoted: msg }
            );

        } catch (error) {
            console.error("[VIEWSALE ERROR]", error);

            await reply(
                "❌ VIEWSALE ERROR!\n\n" +
                error.message
            );
        }
    }
};
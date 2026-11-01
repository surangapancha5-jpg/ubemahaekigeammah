// ════════════════ EMOJI MIX COMMAND ════════════════════════
// Emoji දෙකක් Mix කර WhatsApp Sticker එකක් සාදයි.

const axios = require("axios");
const sharp = require("sharp");

module.exports = {
    name: "emojimix",
    alias: ["mixemoji", "emix"],
    desc: "Mix Two Emojis Into A Sticker",
    category: "fun",
    use: ".emojimix 😳+😂",

    async execute(sock, msg, args, from, { reply }) {
        try {

            // ════════════════ GET EMOJIS ════════════════════════
            const input = args.join("");

            const emojis = input
                .split("+")
                .map(e => e.trim())
                .filter(Boolean);

            if (emojis.length !== 2) {
                return reply(
                    "╭━━〔 😍 EMOJI MIX 〕━━╮\n" +
                    "┃\n" +
                    "┃ ❌ Emoji දෙකක් ලබා දෙන්න.\n" +
                    "┃\n" +
                    "┃ උදාහරණය:\n" +
                    "┃ .emojimix 😳+😂\n" +
                    "┃ .emojimix ❤️+🔥\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━━━╯"
                );
            }

            const [emoji1, emoji2] = emojis;

            // ════════════════ LOAD EMOJI MIXER ══════════════════
            const emojiMixer = await import("emoji-mixer");
            const getEmojiMixUrl = emojiMixer.default;

            const imageUrl = getEmojiMixUrl(emoji1, emoji2);

            if (!imageUrl) {
                return reply(
                    "❌ මේ Emoji දෙක සඳහා Mix Sticker එකක් හමු වුණේ නැහැ.\n\n" +
                    "වෙනත් Emoji දෙකක් උත්සාහ කරන්න."
                );
            }

            // ════════════════ DOWNLOAD MIX IMAGE ════════════════
            const response = await axios.get(imageUrl, {
                responseType: "arraybuffer",
                timeout: 20000
            });

            // ════════════════ CONVERT PNG TO WEBP ═══════════════
            const stickerBuffer = await sharp(
                Buffer.from(response.data)
            )
                .resize(512, 512, {
                    fit: "contain",
                    background: {
                        r: 0,
                        g: 0,
                        b: 0,
                        alpha: 0
                    }
                })
                .webp({ quality: 90 })
                .toBuffer();

            // ════════════════ SEND WHATSAPP STICKER ═════════════
            await sock.sendMessage(from, {
                sticker: stickerBuffer
            }, {
                quoted: msg
            });

        } catch (error) {

            console.error("[EMOJIMIX ERROR]", error);

            return reply(
                "❌ Emoji Mix Error!\n\n" +
                (error.message || "Unknown error")
            );
        }
    }
};
const axios = require("axios");

module.exports = {
    name: "kick",
    alias: ["remove"],
    desc: "Send Gift Video and Remove Member",
    category: "group",
    use: ".kick @user",

    async execute(sock, msg, args, from, { reply }) {
        let loading;

        try {
            // GROUP CHECK
            if (!from.endsWith("@g.us")) {
                return reply("❌ මේ Command එක Group වල පමණයි!");
            }

            // GET GROUP METADATA
            const metadata = await sock.groupMetadata(from);

            // NORMALIZE JID
            const normalizeJid = (jid) => {
                if (!jid) return "";

                return jid
                    .replace(/:\d+@/, "@")
                    .toLowerCase();
            };

            // GET SENDER
            const sender =
                msg.key.participant ||
                msg.key.remoteJid;

            // GET BOT JID
            const botJid = sock.user.id;
            const botLid = sock.user.lid;

            // FIND PARTICIPANT
            const findParticipant = (jid) => {
                return metadata.participants.find(p => {
                    return (
                        normalizeJid(p.id) === normalizeJid(jid) ||
                        (p.lid && normalizeJid(p.lid) === normalizeJid(jid))
                    );
                });
            };

            // CHECK SENDER ADMIN
            const senderAdmin = findParticipant(sender);

            if (
                !senderAdmin ||
                !["admin", "superadmin"].includes(senderAdmin.admin)
            ) {
                return reply(
                    "❌ මේ Command එක භාවිතා කරන්න Admin කෙනෙක් වෙන්න ඕන!"
                );
            }

            // CHECK BOT ADMIN
            const botAdmin = metadata.participants.find(p => {
                return (
                    normalizeJid(p.id) === normalizeJid(botJid) ||
                    (botLid &&
                        normalizeJid(p.id) === normalizeJid(botLid)) ||
                    (p.lid &&
                        normalizeJid(p.lid) === normalizeJid(botJid))
                );
            });

            if (
                !botAdmin ||
                !["admin", "superadmin"].includes(botAdmin.admin)
            ) {
                return reply(
                    "❌ Bot Admin කෙනෙක් කරලා නැහැ!\n\n" +
                    "⚠️ Bot ව Group Admin කරන්න.\n" +
                    "ඉන්පසු නැවත උත්සාහ කරන්න."
                );
            }

            // GET TARGET
            const mentioned =
                msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

            const quoted =
                msg.message?.extendedTextMessage?.contextInfo?.participant;

            const target = mentioned[0] || quoted;

            if (!target) {
                return reply(
                    "❌ කෙනෙක් Mention කරන්න!\n\n" +
                    "Example: .kick @user"
                );
            }

            // PREVENT BOT KICK
            if (
                normalizeJid(target) === normalizeJid(botJid) ||
                (botLid && normalizeJid(target) === normalizeJid(botLid))
            ) {
                return reply("❌ Bot ව Remove කරන්න බැහැ!");
            }

            // FIND TARGET MEMBER
            const targetMember = findParticipant(target);

            if (!targetMember) {
                return reply("❌ මේ Member Group එකේ නැහැ!");
            }

            if (
                ["admin", "superadmin"].includes(targetMember.admin)
            ) {
                return reply("❌ Group Admin කෙනෙක් Remove කරන්න බැහැ!");
            }

            // LOADING MESSAGE
            loading = await sock.sendMessage(
                from,
                {
                    text: "🎁 Gift එක සූදානම් කරමින් පවතී..."
                },
                { quoted: msg }
            );

            // GIFT VIDEO
            const giftUrl =
                "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

            const videoResponse = await axios.get(giftUrl, {
                responseType: "arraybuffer",
                timeout: 60000
            });

            const videoBuffer = Buffer.from(videoResponse.data);

            // SEND GIFT
            await sock.sendMessage(
                from,
                {
                    video: videoBuffer,
                    mimetype: "video/mp4",
                    gifPlayback: false,
                    caption:
                        "🎁 SPECIAL GIFT 🎁\n\n" +
                        `👤 Member: @${target.split("@")[0]}\n\n` +
                        "> ZANTA-XMD 💫",
                    mentions: [target]
                },
                { quoted: msg }
            );

            // DELETE LOADING
            if (loading?.key) {
                await sock.sendMessage(
                    from,
                    { delete: loading.key }
                ).catch(() => {});

                loading = null;
            }

            // REMOVE MEMBER
            await sock.groupParticipantsUpdate(
                from,
                [targetMember.id],
                "remove"
            );

            // SUCCESS MESSAGE
            await reply(
                "╭━━〔 ✅ KICK SUCCESS 〕━━╮\n" +
                "┃\n" +
                `┃ 👤 Member: @${target.split("@")[0]}\n` +
                "┃ 🎁 Gift Sent Successfully!\n" +
                "┃ 🚫 Member Removed!\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯",
                { mentions: [target] }
            );

        } catch (error) {
            console.error("KICK ERROR:", error);

            await reply(
                "❌ KICK ERROR!\n\n" +
                "Error: " + error.message
            );

        } finally {
            if (loading?.key) {
                await sock.sendMessage(
                    from,
                    { delete: loading.key }
                ).catch(() => {});
            }
        }
    }
};
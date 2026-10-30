module.exports = {
    name: "demote",
    alias: ["removeadmin"],
    desc: "Remove group admin status",
    category: "group",
    use: ".demote @user",

    async execute(sock, msg, args, from, { reply }) {
        try {
            if (!from.endsWith("@g.us")) {
                return reply("❌ මේ Command එක Group එකක පමණයි භාවිතා කළ හැක්කේ.");
            }

            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;

            const sender = msg.key.participant || msg.key.remoteJid;
            const senderData = participants.find(p => p.id === sender);

            const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
            const botData = participants.find(p =>
                p.id === botId || p.id.split(":")[0] === sock.user.id.split(":")[0]
            );

            if (!senderData?.admin) {
                return reply("❌ මේ Command එක භාවිතා කරන්න Group Admin කෙනෙක් වෙන්න ඕන.");
            }

            if (!botData?.admin) {
                return reply("❌ Bot Admin කෙනෙක් නෙවෙයි. මුලින් Bot ට Admin දෙන්න.");
            }

            const context =
                msg.message?.extendedTextMessage?.contextInfo ||
                msg.msg?.contextInfo ||
                {};

            const target =
                context.mentionedJid?.[0] ||
                context.participant;

            if (!target) {
                return reply("⚠️ Demote කරන්න ඕන Admin ව Mention කරන්න හෝ එයාගේ Message එකකට Reply කරන්න.");
            }

            const member = participants.find(p =>
                p.id === target || p.id.split(":")[0] === target.split(":")[0]
            );

            if (!member) {
                return reply("❌ මේ Member Group එකේ නැහැ.");
            }

            if (!member.admin) {
                return reply("⚠️ මේ Member දැනටමත් සාමාන්‍ය Member කෙනෙක්.");
            }

            await sock.groupParticipantsUpdate(from, [member.id], "demote");

            return reply(
                `╭━━〔 📉 DEMOTE SUCCESS 〕━━╮\n┃\n┃ ✅ Admin තනතුර ඉවත් කළා!\n┃ 👤 @${member.id.split("@")[0]}\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯`,
                { mentions: [member.id] }
            );

        } catch (error) {
            console.error("DEMOTE ERROR:", error);
            return reply("❌ Demote කරන්න බැරි වුණා. Bot ට Group Admin Permission තියෙනවාද බලන්න.");
        }
    }
};
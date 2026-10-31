// ════════════════════════════════════════════════════════
//          PREFIX CHANGER
//          Bot Prefix එක වෙනස් කිරීම.
// ════════════════════════════════════════════════════════

function zantaBox(title, lines = []) {
    return (
        `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n` +
        `┃◈╭─────────────·๏\n` +
        `┃◈┃⛩️ ${title}\n` +
        `┃◈┃\n` +
        lines.map(line => `┃◈┃⛩️ ${line}\n`).join("") +
        `┃◈└───────────┈⊷\n` +
        `╰──────────────┈⊷\n` +
        `> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
    );
}

module.exports = {
    name: "prefix",
    alias: ["setprefix"],
    desc: "Change Bot Prefix",
    category: "settings",
    use: ".prefix <new prefix>",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // ════════════════════════════════════════════════
            //          OWNER CHECK
            //          Owner පමණක් Prefix වෙනස් කිරීම.
            // ════════════════════════════════════════════════

            const sender =
                msg.key.participant ||
                msg.key.remoteJid;

            const senderNumber = sender.split("@")[0].split(":")[0];

            const ownerNumber = (process.env.OWNER_NUMBER || "")
                .replace(/\D/g, "");

            if (!ownerNumber || senderNumber !== ownerNumber) {
                return reply(zantaBox("ACCESS DENIED", [
                    "මෙම Command එක භාවිතා කළ හැක්කේ Bot Ownerට පමණයි."
                ]));
            }

            // ════════════════════════════════════════════════
            //          PREFIX VALIDATION
            //          අලුත් Prefix එක පරීක්ෂා කිරීම.
            // ════════════════════════════════════════════════

            const newPrefix = args[0];

            if (!newPrefix) {
                return reply(zantaBox("PREFIX SETTINGS", [
                    "Current Prefix එක බලන්න.",
                    "Usage: .prefix <new prefix>",
                    "Example: .prefix !",
                    "Example: .prefix /"
                ]));
            }

            if (newPrefix.length > 5 || /\s/.test(newPrefix)) {
                return reply(zantaBox("INVALID PREFIX", [
                    "Prefix එක අකුරු 1-5 අතර විය යුතුයි.",
                    "Spaces භාවිතා කරන්න බැහැ."
                ]));
            }

            // ════════════════════════════════════════════════
            //          UPDATE PREFIX
            //          Settings තුළ Prefix එක Save කිරීම.
            // ════════════════════════════════════════════════

            const settings = require("../settings");

            settings.prefix = newPrefix;

            return reply(zantaBox("PREFIX UPDATED", [
                `New Prefix: ${newPrefix}`,
                `Example: ${newPrefix}menu`,
                "Prefix එක වෙනස් කළා."
            ]));

        } catch (error) {
            console.error("PREFIX ERROR:", error);

            return reply(zantaBox("PREFIX ERROR", [
                "Prefix එක වෙනස් කිරීමේදී දෝෂයක් ඇතිවුණා.",
                error.message
            ]));
        }
    }
};
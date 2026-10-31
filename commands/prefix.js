const settings = require("../settings");

// ════════════════════════════════════════════════════════
//          ZANTA-XMD PREFIX CHANGER
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
            //          BOT OWNER CHECK
            //          WhatsApp Pair කළ Account එක Owner කිරීම.
            // ════════════════════════════════════════════════

            const senderJid =
                msg.key.participant || msg.key.remoteJid;

            const senderNumber = senderJid
                .split("@")[0]
                .split(":")[0];

            const botJid = sock.user?.id || "";

            const botNumber = botJid
                .split(":")[0]
                .split("@")[0];

            if (!botNumber || senderNumber !== botNumber) {
                return reply(zantaBox("ACCESS DENIED", [
                    "මෙම Command එක භාවිතා කළ හැක්කේ Bot Ownerට පමණයි.",
                    "WhatsApp Pair කළ Account එකෙන් භාවිතා කරන්න."
                ]));
            }

            // ════════════════════════════════════════════════
            //          PREFIX HELP
            //          Prefix භාවිතා කරන ආකාරය.
            // ════════════════════════════════════════════════

            if (!args[0]) {
                const currentPrefix = settings.prefix || ".";

                return reply(zantaBox("PREFIX SETTINGS", [
                    `Current Prefix: ${currentPrefix}`,
                    "",
                    "New Prefix එකක් සකස් කිරීමට:",
                    ".prefix !",
                    ".prefix /",
                    ".prefix #",
                    ".prefix ."
                ]));
            }

            // ════════════════════════════════════════════════
            //          PREFIX VALIDATION
            //          අලුත් Prefix එක පරීක්ෂා කිරීම.
            // ════════════════════════════════════════════════

            const newPrefix = args[0];

            if (
                newPrefix.length > 5 ||
                /\s/.test(newPrefix) ||
                /^[a-zA-Z0-9]+$/.test(newPrefix)
            ) {
                return reply(zantaBox("INVALID PREFIX", [
                    "Prefix එක වලංගු නැහැ.",
                    "අකුරු 1-5 අතර සංකේතයක් භාවිතා කරන්න.",
                    "Examples: ! / # ."
                ]));
            }

            // ════════════════════════════════════════════════
            //          UPDATE PREFIX
            //          Settings තුළ Prefix එක වෙනස් කිරීම.
            // ════════════════════════════════════════════════

            settings.prefix = newPrefix;

            return reply(zantaBox("PREFIX UPDATED", [
                `New Prefix: ${newPrefix}`,
                `Example: ${newPrefix}menu`,
                "",
                "Prefix එක සාර්ථකව වෙනස් කළා."
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
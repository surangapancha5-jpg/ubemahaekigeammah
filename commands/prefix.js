const {
    getBotSettings,
    updateBotSettings
} = require("../lib/settingsHelper");

// ════════════════════════════════════════════════════════
//          ZANTA-XMD PREFIX CHANGER
//          MongoDB හරහා Prefix එක වෙනස් කිරීම.
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

// ════════════════════════════════════════════════════════
//          NUMBER NORMALIZER
//          WhatsApp JID එකෙන් Number එක ලබාගැනීම.
// ════════════════════════════════════════════════════════

function getNumber(jid) {
    return String(jid || "")
        .split("@")[0]
        .split(":")[0]
        .replace(/[^0-9]/g, "");
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

            const senderNumber = getNumber(senderJid);
            const botNumber = getNumber(sock.user?.id);

            if (
                !senderNumber ||
                !botNumber ||
                senderNumber !== botNumber
            ) {
                return reply(zantaBox("ACCESS DENIED", [
                    "මෙම Command එක භාවිතා කළ හැක්කේ Bot Ownerට පමණයි.",
                    "WhatsApp Pair කළ Account එකෙන් භාවිතා කරන්න."
                ]));
            }

            // ════════════════════════════════════════════════
            //          GET BOT SETTINGS
            //          MongoDB එකෙන් Settings ලබාගැනීම.
            // ════════════════════════════════════════════════

            const settings = await getBotSettings(botNumber);

            if (!settings) {
                return reply(zantaBox("DATABASE ERROR", [
                    "Bot Settings ලබාගැනීමට නොහැකි වුණා.",
                    "MongoDB Connection එක පරීක්ෂා කරන්න."
                ]));
            }

            // ════════════════════════════════════════════════
            //          PREFIX HELP
            //          Prefix භාවිතා කරන ආකාරය.
            // ════════════════════════════════════════════════

            if (!args[0]) {
                return reply(zantaBox("PREFIX SETTINGS", [
                    `Current Prefix: ${settings.prefix || "."}`,
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

            const newPrefix = String(args[0]).trim();

            const prefixLength = Array.from(newPrefix).length;

            if (
                !newPrefix ||
                prefixLength > 5 ||
                /\s/.test(newPrefix) ||
                /^[a-zA-Z0-9]+$/.test(newPrefix)
            ) {
                return reply(zantaBox("INVALID PREFIX", [
                    "Prefix එක වලංගු නැහැ.",
                    "සංකේත 1-5 අතර භාවිතා කරන්න.",
                    "Examples: ! / # ."
                ]));
            }

            // ════════════════════════════════════════════════
            //          UPDATE PREFIX
            //          MongoDB එකේ Prefix එක Save කිරීම.
            // ════════════════════════════════════════════════

            const updated = await updateBotSettings(
                botNumber,
                {
                    prefix: newPrefix
                }
            );

            if (!updated) {
                return reply(zantaBox("UPDATE FAILED", [
                    "Prefix එක Save කිරීමට නොහැකි වුණා.",
                    "නැවත උත්සාහ කරන්න."
                ]));
            }

            return reply(zantaBox("PREFIX UPDATED",
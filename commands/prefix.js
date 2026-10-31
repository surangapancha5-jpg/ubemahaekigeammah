const {
    getBotSettings,
    updateBotSettings
} = require("../lib/settingsHelper");

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

    async execute(sock, msg, args, from, context = {}) {
        const {
            reply,
            isOwner,
            isDev,
            currentBotNumber
        } = context;

        try {
            // OWNER CHECK
            if (!isOwner && !isDev) {
                return reply(zantaBox("ACCESS DENIED", [
                    "මෙම Command එක භාවිතා කළ හැක්කේ Bot Ownerට පමණයි."
                ]));
            }

            // BOT NUMBER
            const botNumber = String(
                currentBotNumber ||
                sock.user?.id ||
                ""
            )
                .split("@")[0]
                .split(":")[0]
                .replace(/[^0-9]/g, "");

            if (!botNumber) {
                return reply(zantaBox("BOT ERROR", [
                    "Bot Number එක ලබාගැනීමට නොහැකි වුණා."
                ]));
            }

            // GET SETTINGS
            const settings = await getBotSettings(botNumber);

            if (!settings) {
                return reply(zantaBox("DATABASE ERROR", [
                    "Bot Settings ලබාගැනීමට නොහැකි වුණා.",
                    "MongoDB Connection එක පරීක්ෂා කරන්න."
                ]));
            }

            // PREFIX HELP
            if (!args || !args[0]) {
                return reply(zantaBox("PREFIX SETTINGS", [
                    `Current Prefix: ${settings.prefix || "."}`,
                    "",
                    "Prefix එක වෙනස් කිරීමට:",
                    ".prefix !",
                    ".prefix /",
                    ".prefix #",
                    ".prefix .",
                    ".prefix $"
                ]));
            }

            // VALIDATE PREFIX
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
                    "",
                    "Examples: ! / # . $"
                ]));
            }

            // UPDATE DATABASE
            const updated = await updateBotSettings(
                botNumber,
                { prefix: newPrefix }
            );

            if (!updated) {
                return reply(zantaBox("UPDATE FAILED", [
                    "Prefix එක Save කිරීමට නොහැකි වුණා.",
                    "නැවත උත්සාහ කරන්න."
                ]));
            }

            // SUCCESS
            return reply(zantaBox("PREFIX UPDATED", [
                "Bot Prefix එක සාර්ථකව වෙනස් කළා.",
                "",
                `Old Prefix: ${settings.prefix || "."}`,
                `New Prefix: ${newPrefix}`,
                "",
                `දැන් භාවිතා කරන්න: ${newPrefix}menu`
            ]));

        } catch (error) {
            console.error("[PREFIX ERROR]", error);

            return reply(zantaBox("ERROR", [
                "Prefix එක වෙනස් කිරීමේදී දෝෂයක් ඇති වුණා.",
                error.message || "Unknown Error"
            ]));
        }
    }
};
const {
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
            currentBotNumber,
            settings
        } = context;

        try {
            // OWNER CHECK - INDEX.JS CONTEXT
            if (!isOwner && !isDev) {
                return reply(zantaBox("ACCESS DENIED", [
                    "මෙම Command එක භාවිතා කළ හැක්කේ Bot Ownerට පමණයි."
                ]));
            }

            // BOT NUMBER FROM INDEX
            const botNumber = String(
                currentBotNumber || ""
            ).replace(/[^0-9]/g, "");

            if (!botNumber) {
                return reply(zantaBox("BOT ERROR", [
                    "Bot Number එක ලබාගැනීමට නොහැකි වුණා."
                ]));
            }

            // CURRENT PREFIX
            const oldPrefix = settings?.prefix || ".";

            // HELP
            if (!args || !args[0]) {
                return reply(zantaBox("PREFIX SETTINGS", [
                    `Current Prefix: ${oldPrefix}`,
                    "",
                    "Prefix වෙනස් කිරීමට:",
                    `${oldPrefix}prefix !`,
                    `${oldPrefix}prefix /`,
                    `${oldPrefix}prefix #`,
                    `${oldPrefix}prefix .`,
                    `${oldPrefix}prefix $`
                ]));
            }

            // NEW PREFIX
            const newPrefix = String(args[0]).trim();

            const length = Array.from(newPrefix).length;

            if (
                length < 1 ||
                length > 5 ||
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

            // SAVE TO MONGODB
            await updateBotSettings(botNumber, {
                prefix: newPrefix
            });

            return reply(zantaBox("PREFIX UPDATED", [
                "Prefix එක සාර්ථකව වෙනස් කළා!",
                "",
                `Old Prefix: ${oldPrefix}`,
                `New Prefix: ${newPrefix}`,
                "",
                `දැන් භාවිතා කරන්න: ${newPrefix}menu`,
                `${newPrefix}alive`,
                `${newPrefix}ping`
            ]));

        } catch (error) {
            console.error("[PREFIX COMMAND ERROR]", error);

            return reply(zantaBox("PREFIX ERROR", [
                "Prefix එක Save කිරීමේදී දෝෂයක් ඇති වුණා.",
                error.message || "Unknown Error"
            ]));
        }
    }
};
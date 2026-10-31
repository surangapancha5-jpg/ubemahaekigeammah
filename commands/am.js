const mongoose = require("mongoose");
const {
    getBotSettings,
    updateBotSettings
} = require("../lib/settingsHelper");

// ════════════════ ZANTA-XMD DATABASE ════════════════════════

const BotMeta =
    mongoose.models.ZantaMeta ||
    mongoose.model(
        "ZantaMeta",
        new mongoose.Schema({
            key: { type: String, unique: true },
            value: mongoose.Schema.Types.Mixed
        }),
        "darkdinumetas"
    );

// ════════════════ MENU BOX DESIGN ══════════════════════════

function box(title, lines = []) {
    return (
        `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n` +
        `┃◈╭─────────────·๏\n` +
        `┃◈┃⛩️ ${title}\n` +
        `┃◈┃\n` +
        lines.map(x => `┃◈┃⛩️ ${x}\n`).join("") +
        `┃◈└───────────┈⊷\n` +
        `╰──────────────┈⊷\n` +
        `> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
    );
}

// ════════════════ HELPER FUNCTIONS ══════════════════════════

function cleanNumber(jid) {
    return String(jid || "")
        .split("@")[0]
        .split(":")[0]
        .replace(/[^0-9]/g, "");
}

async function getFeatures(botNumber) {
    const doc = await BotMeta.findOne({
        key: `features_${botNumber}`
    });

    return doc?.value || {};
}

async function saveFeatures(botNumber, updates) {
    const old = await getFeatures(botNumber);

    const updated = {
        ...old,
        ...updates
    };

    await BotMeta.findOneAndUpdate(
        { key: `features_${botNumber}` },
        { $set: { value: updated } },
        { upsert: true }
    );

    return updated;
}

async function getBanned(botNumber) {
    const doc = await BotMeta.findOne({
        key: `banned_${botNumber}`
    });

    return Array.isArray(doc?.value) ? doc.value : [];
}

async function saveBanned(botNumber, list) {
    await BotMeta.findOneAndUpdate(
        { key: `banned_${botNumber}` },
        { $set: { value: list } },
        { upsert: true }
    );
}

function getTarget(msg, args) {
    const context =
        msg.message?.extendedTextMessage?.contextInfo || {};

    const mentioned = context.mentionedJid?.[0];

    if (mentioned) return mentioned;

    if (context.participant && context.stanzaId) {
        return context.participant;
    }

    const number = String(args[0] || "")
        .replace(/[^0-9]/g, "");

    if (number.length >= 7) {
        return `${number}@s.whatsapp.net`;
    }

    return null;
}

// ════════════════ COMMAND SETTINGS ══════════════════════════

module.exports = {
    name: "manage",

    alias: [
        "setting",
        "settings",
        "setmenu",
        "setname",
        "setlogo",
        "setprefix",
        "setpresence",
        "welcome",
        "welcomemsg",
        "goodbye",
        "goodbyemsg",
        "status",
        "anti",
        "ban",
        "unban",
        "unbab",
        "block",
        "unblock",
        "autoreact",
        "public",
        "private",
        "group",
        "inbox"
    ],

    desc: "ZANTA-XMD All Settings",
    category: "settings",

    async execute(sock, msg, args, from, context = {}) {
        const {
            reply,
            isOwner,
            isDev,
            currentBotNumber
        } = context;

        try {
            // ════════════════ OWNER CHECK ════════════════════

            if (!isOwner && !isDev) {
                return reply(box("ACCESS DENIED", [
                    "මෙම Settings භාවිතා කළ හැක්කේ Bot Ownerට පමණයි."
                ]));
            }

            const botNumber = cleanNumber(currentBotNumber);

            if (!botNumber) {
                return reply(box("ERROR", [
                    "Bot Number එක ලබාගැනීමට නොහැකි වුණා."
                ]));
            }

            // ════════════════ COMMAND PARSER ═════════════════

            const prefix = context.prefix || ".";

            const body = String(context.body || "").trim();
            let command = body.split(/\s+/)[0] || "";
            command = command.slice(prefix.length).toLowerCase();

            let commandArgs = [...args];

            if (command === "setting" || command === "settings" ||
                command === "setmenu") {
                command = String(commandArgs.shift() || "").toLowerCase();
            }

            const option = String(commandArgs[0] || "").toLowerCase();
            const value = String(commandArgs[1] || "").toLowerCase();
            const messageText = commandArgs.join(" ");

            const settings = await getBotSettings(botNumber);

            // ════════════════ BOT CONFIGURATION ═════════════

            if (command === "setname") {
                const name = commandArgs.join(" ").trim();

                if (!name) {
                    return reply(box("BOT NAME", [
                        `${prefix}setname ZANTA-XMD`
                    ]));
                }

                await updateBotSettings(botNumber, {
                    botName: name
                });

                return reply(box("BOT NAME UPDATED", [
                    `New Name: ${name}`,
                    "MongoDB එකේ Save කළා."
                ]));
            }

            if (command === "setlogo") {
                const url = commandArgs[0];

                if (!url || !/^https?:\/\//i.test(url)) {
                    return reply(box("BOT LOGO", [
                        `${prefix}setlogo https://example.com/logo.jpg`
                    ]));
                }

                await updateBotSettings(botNumber, {
                    botLogo: url
                });

                return reply(box("BOT LOGO UPDATED", [
                    "Bot Logo URL එක Save කළා."
                ]));
            }

            if (command === "setprefix") {
                const newPrefix = commandArgs[0];

                if (!newPrefix || newPrefix.length > 3 ||
                    /\s/.test(newPrefix)) {
                    return reply(box("PREFIX SETTINGS", [
                        `${prefix}setprefix !`,
                        "Prefix එක අකුරු 1-3 අතර විය යුතුයි."
                    ]));
                }

                await updateBotSettings(botNumber, {
                    prefix: newPrefix
                });

                return reply(box("PREFIX UPDATED", [
                    `New Prefix: ${newPrefix}`,
                    "අලුත් Prefix එක භාවිතා කරන්න."
                ]));
            }

            if (command === "setpresence") {
                const presence = option;

                if (!["typing", "recording", "off"].includes(presence)) {
                    return reply(box("PRESENCE SETTINGS", [
                        `${prefix}setpresence typing`,
                        `${prefix}setpresence recording`,
                        `${prefix}setpresence off`
                    ]));
                }

                await updateBotSettings(botNumber, {
                    presence
                });

                return reply(box("PRESENCE UPDATED", [
                    `Presence: ${presence.toUpperCase()}`
                ]));
            }

            // ════════════════ WELCOME SETTINGS ═══════════════

            if (command === "welcome") {
                if (!["on", "off"].includes(option)) {
                    return reply(box("WELCOME SETTINGS", [
                        `${prefix}welcome on`,
                        `${prefix}welcome off`,
                        `${prefix}welcomemsg <message>`
                    ]));
                }

                await updateBotSettings(botNumber, {
                    welcomeEnabled: option === "on"
                });

                return reply(box("WELCOME UPDATED", [
                    `Welcome: ${option.toUpperCase()}`
                ]));
            }

            if (command === "welcomemsg") {
                const newMessage = messageText.trim();

                if (!newMessage) {
                    return reply(box("WELCOME MESSAGE", [
                        `${prefix}welcomemsg Welcome @user to @group!`
                    ]));
                }

                await updateBotSettings(botNumber, {
                    welcomeMessage: newMessage
                });

                return reply(box("WELCOME MESSAGE UPDATED", [
                    "Welcome Message එක Save කළා."
                ]));
            }

            // ════════════════ GOODBYE SETTINGS ═══════════════

            if (command === "goodbye") {
                if (!["on", "off"].includes(option)) {
                    return reply(box("GOODBYE SETTINGS", [
                        `${prefix}goodbye on`,
                        `${prefix}goodbye off`,
                        `${prefix}goodbyemsg <message>`
                    ]));
                }

                await updateBotSettings(botNumber, {
                    goodbyeEnabled: option === "on"
                });

                return reply(box("GOODBYE UPDATED", [
                    `Goodbye: ${option.toUpperCase()}`
                ]));
            }

            if (command === "goodbyemsg") {
                const newMessage = messageText.trim();

                if (!newMessage) {
                    return reply(box("GOODBYE MESSAGE", [
                        `${prefix}goodbyemsg Goodbye @user!`
                    ]));
                }

                await updateBotSettings(botNumber, {
                    goodbyeMessage: newMessage
                });

                return reply(box("GOODBYE MESSAGE UPDATED", [
                    "Goodbye Message එක Save කළා."
                ]));
            }

            // ════════════════ STATUS SETTINGS ═══════════════

            if (command === "status") {
                if (option === "views") {
                    if (!["on", "off"].includes(value)) {
                        return reply(box("STATUS VIEWS", [
                            `${prefix}status views on`,
                            `${prefix}status views off`
                        ]));
                    }

                    await updateBotSettings(botNumber, {
                        statusSeen: value === "on"
                    });

                    return reply(box("STATUS VIEWS UPDATED", [
                        `Status Views: ${value.toUpperCase()}`
                    ]));
                }

                if (option === "react") {
                    if (!["on", "off"].includes(value)) {
                        return reply(box("STATUS REACT", [
                            `${prefix}status react on`,
                            `${prefix}status react off`
                        ]));
                    }

                    await updateBotSettings(botNumber, {
                        statusReact: value === "on" ? "💚" : "off"
                    });

                    return reply(box("STATUS REACT UPDATED", [
                        `Status React: ${value.toUpperCase()}`
                    ]));
                }

                return reply(box("STATUS SETTINGS", [
                    `${prefix}status views on/off`,
                    `${prefix}status react on/off`
                ]));
            }

            // ════════════════ ANTI CALL SETTINGS ════════════

            if (command === "anti" && option === "call") {
                if (!["on", "off"].includes(value)) {
                    return reply(box("ANTI CALL SETTINGS", [
                        `${prefix}anti call on`,
                        `${prefix}anti call off`
                    ]));
                }

                await saveFeatures(botNumber, {
                    antiCall: value === "on"
                });

                return reply(box("ANTI CALL UPDATED", [
                    `Anti Call: ${value.toUpperCase()}`
                ]));
            }

            // ════════════════ AUTO REACT SETTINGS ═══════════

            if (command === "autoreact") {
                if (!["on", "off"].includes(option)) {
                    return reply(box("AUTO REACT", [
                        `${prefix}autoreact on`,
                        `${prefix}autoreact off`
                    ]));
                }

                await saveFeatures(botNumber, {
                    autoReact: option === "on"
                });

                return reply(box("AUTO REACT UPDATED", [
                    `Auto React: ${option.toUpperCase()}`
                ]));
            }

            // ════════════════ WORK MODE SETTINGS ════════════

            const modes = {
                public: "public",
                private: "private",
                group: "groups",
                inbox: "inbox"
            };

            if (modes[command]) {
                await updateBotSettings(botNumber, {
                    workMode: modes[command]
                });

                return reply(box("WORK MODE UPDATED", [
                    `Mode: ${modes[command].toUpperCase()}`
                ]));
            }

            // ════════════════ BAN / UNBAN SETTINGS ══════════

            if (command === "ban" || command === "unban" ||
                command === "unbab") {

                const target = getTarget(msg, commandArgs);

                if (!target) {
                    return reply(box("USER REQUIRED", [
                        "User කෙනෙක් Mention කරන්න හෝ Reply කරන්න.",
                        `${prefix}ban @user`,
                        `${prefix}unban @user`
                    ]));
                }

                const targetNumber = cleanNumber(target);

                if (targetNumber === botNumber) {
                    return reply(box("ERROR", [
                        "Bot Account එක Ban කරන්න බැහැ."
                    ]));
                }

                let banned = await getBanned(botNumber);

                if (command === "ban") {
                    if (banned.some(x =>
                        cleanNumber(x.number || x.jid) === targetNumber
                    )) {
                        return reply(box("ALREADY BANNED", [
                            "මෙම User දැනටමත් Ban කර ඇත."
                        ]));
                    }

                    banned.push({
                        jid: target,
                        number: targetNumber
                    });

                    await saveBanned(botNumber, banned);

                    return reply(box("USER BANNED", [
                        `User: ${targetNumber}`,
                        "Bot Commands භාවිතා කිරීම තහනම් කළා."
                    ]));
                }

                banned = banned.filter(x =>
                    cleanNumber(x.number || x.jid) !== targetNumber
                );

                await saveBanned(botNumber, banned);

                return reply(box("USER UNBANNED", [
                    `User: ${targetNumber}`,
                    "Ban List එකෙන් ඉවත් කළා."
                ]));
            }

            // ════════════════ BLOCK / UNBLOCK SETTINGS ═════

            if (command === "block" || command === "unblock") {
                const target = getTarget(msg, commandArgs);

                if (!target) {
                    return reply(box("USER REQUIRED", [
                        `${prefix}block @user`,
                        `${prefix}unblock @user`
                    ]));
                }

                if (typeof sock.updateBlockStatus !== "function") {
                    return reply(box("NOT SUPPORTED", [
                        "මෙම Baileys Version එකේ Block API එක නොමැත."
                    ]));
                }

                await sock.updateBlockStatus(
                    target,
                    command === "block" ? "block" : "unblock"
                );

                return reply(box(
                    command === "block"
                        ? "USER BLOCKED"
                        : "USER UNBLOCKED",
                    [`User: ${cleanNumber(target)}`]
                ));
            }

            // ════════════════ SETTINGS MENU ═════════════════

            const features = await getFeatures(botNumber);

            return reply(box("ZANTA-XMD SETTINGS", [
                "👑 BOT CONFIGURATION",
                `Bot Name: ${settings.botName || "ZANTA-XMD"}`,
                `Prefix: ${settings.prefix || "."}`,
                `${prefix}setname <name>`,
                `${prefix}setlogo <image URL>`,
                `${prefix}setprefix <prefix>`,
                `${prefix}setpresence typing/recording/off`,
                "",
                "🌐 WORK MODE",
                `Current: ${(settings.workMode || "public").toUpperCase()}`,
                `${prefix}public`,
                `${prefix}private`,
                `${prefix}group`,
                `${prefix}inbox`,
                "",
                "👁 STATUS SETTINGS",
                `${prefix}status views on/off`,
                `${prefix}status react on/off`,
                "",
                "🛡 SECURITY SETTINGS",
                `${prefix}welcome on/off`,
                `${prefix}goodbye on/off`,
                `${prefix}anti call on/off`,
                `${prefix}ban @user`,
                `${prefix}unban @user`,
                `${prefix}block @user`,
                `${prefix}unblock @user`,
                "",
                "🤖 AUTO REACT",
                `Auto React: ${features.autoReact ? "ON" : "OFF"}`,
                `${prefix}autoreact on/off`,
                "",
                "⚙️ CURRENT CONFIGURATION",
                `Bot Name: ${settings.botName || "ZANTA-XMD"}`,
                `Prefix: ${settings.prefix || "."}`,
                `Work Mode: ${(settings.workMode || "public").toUpperCase()}`,
                `Presence: ${(settings.presence || "off").toUpperCase()}`,
                `Anti Call: ${features.antiCall ? "ON" : "OFF"}`,
                `Auto React: ${features.autoReact ? "ON" : "OFF"}`
            ]));

        } catch (error) {
            console.error("[ZANTA MANAGE ERROR]", error);

            return reply(box("COMMAND ERROR", [
                error.message || "Unknown Error"
            ]));
        }
    }
};
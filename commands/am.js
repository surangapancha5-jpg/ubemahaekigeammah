const mongoose = require("mongoose");
const {
    updateBotSettings
} = require("../lib/settingsHelper");

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

    await BotMeta.findOneAndUpdate(
        { key: `features_${botNumber}` },
        {
            $set: {
                value: {
                    ...old,
                    ...updates
                }
            }
        },
        { upsert: true }
    );

    return {
        ...old,
        ...updates
    };
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
        msg.message?.extendedTextMessage?.contextInfo ||
        {};

    const mentioned = context.mentionedJid?.[0];

    if (mentioned) return mentioned;

    if (context.participant && context.stanzaId) {
        return context.participant;
    }

    const number = String(args[0] || "").replace(/[^0-9]/g, "");

    if (number.length >= 7) {
        return `${number}@s.whatsapp.net`;
    }

    return null;
}

module.exports = {
    name: "manage",

    alias: [
        "welcome",
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
            if (!isOwner && !isDev) {
                return reply(box("ACCESS DENIED", [
                    "මෙම Command එක භාවිතා කළ හැක්කේ Bot Ownerට පමණයි."
                ]));
            }

            const botNumber = cleanNumber(currentBotNumber);

            if (!botNumber) {
                return reply(box("ERROR", [
                    "Bot Number එක ලබාගැනීමට නොහැකි වුණා."
                ]));
            }

            const command = String(
                context.body || ""
            ).trim().split(/\s+/)[0]
                .replace(context.prefix || ".", "")
                .toLowerCase();

            const option = String(args[0] || "").toLowerCase();
            const value = String(args[1] || "").toLowerCase();

            // WELCOME
            if (command === "welcome") {
                if (!["on", "off"].includes(option)) {
                    return reply(box("WELCOME SETTINGS", [
                        ".welcome on",
                        ".welcome off"
                    ]));
                }

                await saveFeatures(botNumber, {
                    welcome: option === "on"
                });

                return reply(box("WELCOME UPDATED", [
                    `Welcome: ${option.toUpperCase()}`,
                    "Settings MongoDB එකේ Save කළා."
                ]));
            }

            // STATUS VIEWS / REACT
            if (command === "status") {
                if (option === "views") {
                    if (!["on", "off"].includes(value)) {
                        return reply(box("STATUS VIEWS", [
                            ".status views on",
                            ".status views off"
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
                            ".status react on",
                            ".status react off"
                        ]));
                    }

                    await updateBotSettings(botNumber, {
                        statusReact: value === "on" ? "💚" : "off"
                    });

                    return reply(box("STATUS REACT UPDATED", [
                        `Status React: ${value.toUpperCase()}`,
                        value === "on" ? "Emoji: 💚" : "Status React Disabled"
                    ]));
                }

                return reply(box("STATUS SETTINGS", [
                    ".status views on/off",
                    ".status react on/off"
                ]));
            }

            // ANTI CALL
            if (command === "anti" && option === "call") {
                if (!["on", "off"].includes(value)) {
                    return reply(box("ANTI CALL", [
                        ".anti call on",
                        ".anti call off"
                    ]));
                }

                await saveFeatures(botNumber, {
                    antiCall: value === "on"
                });

                return reply(box("ANTI CALL UPDATED", [
                    `Anti Call: ${value.toUpperCase()}`
                ]));
            }

            // AUTOREACT
            if (command === "autoreact") {
                if (!["on", "off"].includes(option)) {
                    return reply(box("AUTO REACT", [
                        ".autoreact on",
                        ".autoreact off"
                    ]));
                }

                await saveFeatures(botNumber, {
                    autoReact: option === "on"
                });

                return reply(box("AUTO REACT UPDATED", [
                    `Auto React: ${option.toUpperCase()}`
                ]));
            }

            // WORK MODES
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
                    `Mode: ${modes[command].toUpperCase()}`,
                    "",
                    "Settings Saved Successfully."
                ]));
            }

            // BAN / UNBAN
            if (command === "ban" || command === "unban" || command === "unbab") {
                const target = getTarget(msg, args);

                if (!target) {
                    return reply(box("USER REQUIRED", [
                        "User කෙනෙක් Mention කරන්න හෝ Reply කරන්න.",
                        "",
                        ".ban @user",
                        ".unban @user"
                    ]));
                }

                const targetNumber = cleanNumber(target);
                const ownerNumber = cleanNumber(currentBotNumber);

                if (targetNumber && targetNumber === ownerNumber) {
                    return reply(box("ERROR", [
                        "Bot Ownerව Ban කරන්න බැහැ."
                    ]));
                }

                let banned = await getBanned(botNumber);

                if (command === "ban") {
                    if (banned.some(x => x.jid === target)) {
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
                        `User: ${targetNumber || target}`,
                        "Bot Commands භාවිතා කිරීම තහනම් කළා."
                    ]));
                }

                banned = banned.filter(x =>
                    x.jid !== target &&
                    (!targetNumber || x.number !== targetNumber)
                );

                await saveBanned(botNumber, banned);

                return reply(box("USER UNBANNED", [
                    `User: ${targetNumber || target}`,
                    "Ban List එකෙන් ඉවත් කළා."
                ]));
            }

            // BLOCK / UNBLOCK
            if (command === "block" || command === "unblock") {
                const target = getTarget(msg, args);

                if (!target) {
                    return reply(box("USER REQUIRED", [
                        "User කෙනෙක් Mention කරන්න හෝ Reply කරන්න.",
                        "",
                        ".block @user",
                        ".unblock @user"
                    ]));
                }

                if (typeof sock.updateBlockStatus !== "function") {
                    return reply(box("NOT SUPPORTED", [
                        "මෙම Baileys Version එකේ Block API එක ලබාගත නොහැක."
                    ]));
                }

                await sock.updateBlockStatus(
                    target,
                    command === "block" ? "block" : "unblock"
                );

                return reply(box(
                    command === "block" ? "USER BLOCKED" : "USER UNBLOCKED",
                    [
                        `User: ${cleanNumber(target) || target}`,
                        "WhatsApp Block Status Updated."
                    ]
                ));
            }

            return reply(box("MANAGE SETTINGS", [
                ".welcome on/off",
                ".status views on/off",
                ".status react on/off",
                ".anti call on/off",
                ".ban / .unban",
                ".block / .unblock",
                ".autoreact on/off",
                ".public",
                ".private",
                ".group",
                ".inbox"
            ]));

        } catch (error) {
            console.error("[ZANTA MANAGE ERROR]", error);

            return reply(box("COMMAND ERROR", [
                error.message || "Unknown Error"
            ]));
        }
    }
};
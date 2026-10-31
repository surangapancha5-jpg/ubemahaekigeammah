const mongoose = require("mongoose");
const {
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

// ════════════════ MENU BOX DESIGN ═══════════════════════════

function box(title, lines = []) {
return (
╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n +
┃◈╭─────────────·๏\n +
┃◈┃⛩️ ${title}\n +
┃◈┃\n +
lines.map(x => ┃◈┃⛩️ ${x}\n).join("") +
┃◈└───────────┈⊷\n +
╰──────────────┈⊷\n +
> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂
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
key: features_${botNumber}
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
key: banned_${botNumber}
});

return Array.isArray(doc?.value) ? doc.value : [];

}

async function saveBanned(botNumber, list) {
await BotMeta.findOneAndUpdate(
{ key: banned_${botNumber} },
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

        let command = String(  
            context.body || ""  
        )  
            .trim()  
            .split(/\s+/)[0]  
            .replace(prefix, "")  
            .toLowerCase();  

        let option = String(args[0] || "").toLowerCase();  
        let value = String(args[1] || "").toLowerCase();  

        let messageText = args.join(" ");  

        // Support: .setting welcome on  
        if (command === "setting" || command === "settings") {  
            command = option;  
            args = args.slice(1);  

            option = String(args[0] || "").toLowerCase();  
            value = String(args[1] || "").toLowerCase();  
            messageText = args.join(" ");  
        }  

        // ════════════════ WELCOME SETTINGS ═══════════════  

        if (command === "welcome") {  
            if (!["on", "off"].includes(option)) {  
                return reply(box("WELCOME SETTINGS", [  
                    `${prefix}welcome on`,  
                    `${prefix}welcome off`,  
                    "",  
                    `${prefix}welcomemsg <message>`,  
                    "",  
                    "Available Tags:",  
                    "@user - Member",  
                    "@group - Group Name"  
                ]));  
            }  

            await updateBotSettings(botNumber, {  
                welcomeEnabled: option === "on"  
            });  

            return reply(box("WELCOME UPDATED", [  
                `Welcome: ${option.toUpperCase()}`,  
                "MongoDB එකේ Save කළා."  
            ]));  
        }  

        // ════════════════ WELCOME MESSAGE ═══════════════  

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
                newMessage,  
                "",  
                "Welcome Message එක Save කළා."  
            ]));  
        }  

        // ════════════════ GOODBYE SETTINGS ═══════════════  

        if (command === "goodbye") {  
            if (!["on", "off"].includes(option)) {  
                return reply(box("GOODBYE SETTINGS", [  
                    `${prefix}goodbye on`,  
                    `${prefix}goodbye off`,  
                    "",  
                    `${prefix}goodbyemsg <message>`,  
                    "",  
                    "Available Tags:",  
                    "@user - Member",  
                    "@group - Group Name"  
                ]));  
            }  

            await updateBotSettings(botNumber, {  
                goodbyeEnabled: option === "on"  
            });  

            return reply(box("GOODBYE UPDATED", [  
                `Goodbye: ${option.toUpperCase()}`,  
                "MongoDB එකේ Save කළා."  
            ]));  
        }  

        // ════════════════ GOODBYE MESSAGE ═══════════════  

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
                newMessage,  
                "",  
                "Goodbye Message එක Save කළා."  
            ]));  
        }  

        // ════════════════ STATUS VIEWS ══════════════════  

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
                    `Status React: ${value.toUpperCase()}`,  
                    value === "on"  
                        ? "Emoji: 💚"  
                        : "Status React Disabled"  
                ]));  
            }  

            return reply(box("STATUS SETTINGS", [  
                `${prefix}status views on/off`,  
                `${prefix}status react on/off`  
            ]));  
        }  

        // ════════════════ ANTI CALL ═════════════════════  

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

        // ════════════════ AUTO REACT ════════════════════  

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

        // ════════════════ WORK MODES ════════════════════  

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
                "Settings Saved Successfully."  
            ]));  
        }  

        // ════════════════ BAN / UNBAN ═══════════════════  

        if (  
            command === "ban" ||  
            command === "unban" ||  
            command === "unbab"  
        ) {  
            const target = getTarget(msg, args);  

            if (!target) {  
                return reply(box("USER REQUIRED", [  
                    "User කෙනෙක් Mention කරන්න හෝ Reply කරන්න.",  
                    "",  
                    `${prefix}ban @user`,  
                    `${prefix}unban @user`  
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
                    `User: ${targetNumber || target}`,  
                    "Bot Commands භාවිතා කිරීම තහනම් කළා."  
                ]));  
            }  

            banned = banned.filter(x =>  
                cleanNumber(x.number || x.jid) !== targetNumber  
            );  

            await saveBanned(botNumber, banned);  

            return reply(box("USER UNBANNED", [  
                `User: ${targetNumber || target}`,  
                "Ban List එකෙන් ඉවත් කළා."  
            ]));  
        }  

        // ════════════════ BLOCK / UNBLOCK ═══════════════  

        if (command === "block" || command === "unblock") {  
            const target = getTarget(msg, args);  

            if (!target) {  
                return reply(box("USER REQUIRED", [  
                    "User කෙනෙක් Mention කරන්න හෝ Reply කරන්න.",  
                    "",  
                    `${prefix}block @user`,  
                    `${prefix}unblock @user`  
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
                command === "block"  
                    ? "USER BLOCKED"  
                    : "USER UNBLOCKED",  
                [  
                    `User: ${cleanNumber(target) || target}`,  
                    "WhatsApp Block Status Updated."  
                ]  
            ));  
        }  

        // ════════════════ SETTINGS HELP MENU ════════════  

        return reply(box("ZANTA-XMD SETTINGS", [  
            "WELCOME & GOODBYE",  
            `${prefix}welcome on/off`,  
            `${prefix}welcomemsg <message>`,  
            `${prefix}goodbye on/off`,  
            `${prefix}goodbyemsg <message>`,  
            "",  
            "STATUS SETTINGS",  
            `${prefix}status views on/off`,  
            `${prefix}status react on/off`,  
            "",  
            "SECURITY SETTINGS",  
            `${prefix}anti call on/off`,  
            `${prefix}ban @user`,  
            `${prefix}unban @user`,  
            `${prefix}block @user`,  
            `${prefix}unblock @user`,  
            "",  
            "AUTO REACT",  
            `${prefix}autoreact on/off`,  
            "",  
            "WORK MODE",  
            `${prefix}public`,  
            `${prefix}private`,  
            `${prefix}group`,  
            `${prefix}inbox`  
        ]));  

    } catch (error) {  
        console.error("[ZANTA MANAGE ERROR]", error);  

        return reply(box("COMMAND ERROR", [  
            error.message || "Unknown Error"  
        ]));  
    }  
}

}; 
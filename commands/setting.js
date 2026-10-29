const mongoose = require("mongoose");

const BotSettingsSchema = new mongoose.Schema(
{
botNumber: {
type: String,
unique: true,
required: true
},
botName: {
type: String,
default: "DARK DINU MD"
},
botLogo: {
type: String,
default: "https://files.catbox.moe/3fxa4u.jpeg"
},
prefix: {
type: String,
default: "."
},
workMode: {
type: String,
default: "public"
},
presence: {
type: String,
default: "off"
},
statusSeen: {
type: Boolean,
default: true
},
statusReact: {
type: String,
default: "💚"
},
antiViewRoute: {
type: String,
default: "me"
},
antiDeleteRoute: {
type: String,
default: "me"
},
welcomeEnabled: {
type: Boolean,
default: false
},
goodbyeEnabled: {
type: Boolean,
default: false
},
welcomeMessage: {
type: String,
default: "Welcome to our group! ❤️"
},
goodbyeMessage: {
type: String,
default: "Goodbye! Take care 👋"
}
},
{
timestamps: true,
strict: false
}
);

const SettingsModel =
mongoose.models.DarkDinuSettings ||
mongoose.model("DarkDinuSettings", BotSettingsSchema);

if (!global.settingSessions) {
global.settingSessions = new Map();
}

const sessions = global.settingSessions;

// Extract text from common WhatsApp message formats.
function getText(message) {
if (!message) return "";

const m =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message;

return String(
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
).trim();

}

function getQuotedId(message) {
const m = message?.ephemeralMessage?.message || message;

return (
    m?.extendedTextMessage?.contextInfo?.stanzaId ||
    m?.imageMessage?.contextInfo?.stanzaId ||
    m?.videoMessage?.contextInfo?.stanzaId ||
    m?.documentMessage?.contextInfo?.stanzaId ||
    ""
);

}

function getNumber(jid) {
return String(jid || "")
.split("@")[0]
.split(":")[0]
.replace(/\D/g, "");
}

function getSender(message) {
return (
message.key?.participant ||
message.key?.remoteJid ||
""
);
}

function mainMenu(settings) {
return `╭━━〔 ⚙️ BOT SETTINGS 〕━━╮
┃
┃ 🤖 Bot: ${settings.botName}
┃ 🔢 Prefix: ${settings.prefix}
┃ 🌐 Work Mode: ${String(settings.workMode).toUpperCase()}
┃ 🎭 Presence: ${String(settings.presence).toUpperCase()}
┃ 👁️ Status Read: ${settings.statusSeen ? "ON" : "OFF"}
┃ 💚 Status React: ${settings.statusReact}
┃ 👋 Welcome: ${settings.welcomeEnabled ? "ON" : "OFF"}
┃ 🚪 Goodbye: ${settings.goodbyeEnabled ? "ON" : "OFF"}
┃
┣━━〔 1. WORK MODE 〕━━
┃ 1.1 ➜ Public
┃ 1.2 ➜ Private
┃ 1.3 ➜ Groups Only
┃ 1.4 ➜ Inbox Only
┃
┣━━〔 2. FAKE PRESENCE 〕━━
┃ 2.1 ➜ Off
┃ 2.2 ➜ Always Typing
┃ 2.3 ➜ Always Recording
┃
┣━━〔 3. ANTI VIEW-ONCE ROUTE 〕━━
┃ 3.1 ➜ Bot Inbox
┃ 3.2 ➜ Same Chat
┃
┣━━〔 4. ANTI DELETE ROUTE 〕━━
┃ 4.1 ➜ Bot Inbox
┃ 4.2 ➜ Same Chat
┃
┣━━〔 5. AUTO STATUS READ 〕━━
┃ 5.1 ➜ Turn ON
┃ 5.2 ➜ Turn OFF
┃
┣━━〔 6. AUTO STATUS REACT 〕━━
┃ 6.1 ➜ Turn ON 💚
┃ 6.2 ➜ Turn OFF
┃
┣━━〔 7. WELCOME MESSAGE 〕━━
┃ 7.1 ➜ Enable
┃ 7.2 ➜ Disable
┃ 7.3 ➜ Change Message
┃
┣━━〔 8. GOODBYE MESSAGE 〕━━
┃ 8.1 ➜ Enable
┃ 8.2 ➜ Disable
┃ 8.3 ➜ Change Message
┃
┃ 0 ➜ Close Settings
╰━━━━━━━━━━━━━━━━━━━━╯

💬 Menu එකට Reply කරලා ඉහත Number එක යවන්න.
උදා: 1.1`;
}

// Register only one listener per connected socket.
function installReplyListener(sock) {
if (sock.__settingReplyListenerInstalled) return;

sock.__settingReplyListenerInstalled = true;

sock.ev.on("messages.upsert", async (update) => {
    try {
        for (const msg of update.messages || []) {
            if (!msg.message || msg.key?.fromMe) continue;

            const from = msg.key?.remoteJid || "";

            if (!from || from === "status@broadcast") continue;

            const quotedId = getQuotedId(msg.message);
            if (!quotedId || !sessions.has(quotedId)) continue;

            const session = sessions.get(quotedId);
            if (!session) continue;

            // The settings menu must be answered by its original owner.
            const sender = getSender(msg);

            if (sender !== session.ownerJid) continue;

            const input = getText(msg.message);

            if (!input) continue;

            if (input === "0") {
                if (session.waitingForText) {
                    session.waitingForText = false;

                    await sock.sendMessage(
                        from,
                        {
                            text: "❌ Message වෙනස් කිරීම අවලංගු කළා."
                        },
                        { quoted: msg }
                    );

                    continue;
                }

                sessions.delete(quotedId);

                await sock.sendMessage(
                    from,
                    { text: "✅ Settings menu එක වසා දැමුවා." },
                    { quoted: msg }
                );

                continue;
            }

            // Custom welcome/goodbye message input.
            if (session.waitingForText) {
                if (input.length > 1000) {
                    await sock.sendMessage(
                        from,
                        { text: "❌ Message එක අකුරු 1000කට වඩා දිගයි." },
                        { quoted: msg }
                    );
                    continue;
                }

                const field = session.waitingForText;

                await SettingsModel.findOneAndUpdate(
                    { botNumber: session.botNumber },
                    { $set: { [field]: input } },
                    { upsert: true, setDefaultsOnInsert: true }
                );

                session.waitingForText = false;

                if (global.settingsCache) {
                    global.settingsCache.delete(session.botNumber);
                }

                await sock.sendMessage(
                    from,
                    {
                        text: `✅ ${field === "welcomeMessage" ? "Welcome" : "Goodbye"} message එක Save කළා.`
                    },
                    { quoted: msg }
                );

                continue;
            }

            const options = {
                "1.1": ["workMode", "public", "Work Mode ➜ PUBLIC"],
                "1.2": ["workMode", "private", "Work Mode ➜ PRIVATE"],
                "1.3": ["workMode", "groups", "Work Mode ➜ GROUPS ONLY"],
                "1.4": ["workMode", "inbox", "Work Mode ➜ INBOX ONLY"],

                "2.1": ["presence", "off", "Fake Presence ➜ OFF"],
                "2.2": ["presence", "typing", "Fake Presence ➜ TYPING"],
                "2.3": ["presence", "recording", "Fake Presence ➜ RECORDING"],

                "3.1": ["antiViewRoute", "me", "Anti-ViewOnce Route ➜ BOT INBOX"],
                "3.2": ["antiViewRoute", "from", "Anti-ViewOnce Route ➜ SAME CHAT"],

                "4.1": ["antiDeleteRoute", "me", "Anti-Delete Route ➜ BOT INBOX"],
                "4.2": ["antiDeleteRoute", "from", "Anti-Delete Route ➜ SAME CHAT"],

                "5.1": ["statusSeen", true, "Auto Status Read ➜ ON"],
                "5.2": ["statusSeen", false, "Auto Status Read ➜ OFF"],

                "6.1": ["statusReact", "💚", "Auto Status React ➜ ON"],
                "6.2": ["statusReact", "off", "Auto Status React ➜ OFF"],

                "7.1": ["welcomeEnabled", true, "Welcome ➜ ON"],
                "7.2": ["welcomeEnabled", false, "Welcome ➜ OFF"],

                "8.1": ["goodbyeEnabled", true, "Goodbye ➜ ON"],
                "8.2": ["goodbyeEnabled", false, "Goodbye ➜ OFF"]
            };

            if (input === "7.3" || input === "8.3") {
                session.waitingForText =
                    input === "7.3" ? "welcomeMessage" : "goodbyeMessage";

                await sock.sendMessage(
                    from,
                    {
                        text:
                            `✍️ ${input === "7.3" ? "Welcome" : "Goodbye"} message එක යවන්න.\n\n` +
                            "අවලංගු කිරීමට 0 Reply කරන්න."
                    },
                    { quoted: msg }
                );

                continue;
            }

            const selected = options[input];

            if (!selected) {
                await sock.sendMessage(
                    from,
                    {
                        text: "❌ වැරදි Number එකක්. Menu එකට Reply කරලා 1.1, 2.1 වැනි අංකයක් යවන්න."
                    },
                    { quoted: msg }
                );

                continue;
            }

            const [key, value, label] = selected;

            await SettingsModel.findOneAndUpdate(
                { botNumber: session.botNumber },
                { $set: { [key]: value } },
                { upsert: true, setDefaultsOnInsert: true }
            );

            if (global.settingsCache) {
                global.settingsCache.delete(session.botNumber);
            }

            // Apply presence selection immediately.
            if (key === "presence") {
                try {
                    if (value === "typing") {
                        await sock.presenceSubscribe(from);
                        await sock.sendPresenceUpdate("composing", from);
                    } else if (value === "recording") {
                        await sock.presenceSubscribe(from);
                        await sock.sendPresenceUpdate("recording", from);
                    } else {
                        await sock.sendPresenceUpdate("paused", from);
                        await sock.sendPresenceUpdate("available");
                    }
                } catch (_) {}
            }

            await sock.sendMessage(
                from,
                {
                    text:
                        `╭━━〔 ✅ SETTINGS UPDATED 〕━━╮\n` +
                        `┃ ${label}\n` +
                        `┃ Value: ${String(value)}\n` +
                        `╰━━━━━━━━━━━━━━━━━━━━╯`
                },
                { quoted: msg }
            );
        }
    } catch (error) {
        console.error("[SETTING REPLY ERROR]", error);
    }
});

}

module.exports = {
name: "setting",
alias: ["settings", "config", "set"],
category: "owner",
description: "Bot Settings Control Panel",

async execute(sock, msg, args, from, context) {
    const {
        reply,
        isOwner,
        isDev,
        sender
    } = context;

    const currentBotNumber = String(
        (sock.user?.id || "").split(":")[0]
    ).replace(/\D/g, "");

    const senderClean = getNumber(sender);

    const isAuthorized = Boolean(
        isOwner ||
        isDev ||
        msg.key?.fromMe ||
        (currentBotNumber && senderClean === currentBotNumber) ||
        senderClean === "94719845166"
    );

    if (!isAuthorized) {
        return reply("❌ මෙම Command එක භාවිතා කළ හැක්කේ Owner හට පමණයි.");
    }

    if (!currentBotNumber) {
        return reply("❌ Bot number එක හඳුනාගත නොහැකියි.");
    }

    try {
        let settings = await SettingsModel.findOne({
            botNumber: currentBotNumber
        });

        if (!settings) {
            settings = await SettingsModel.create({
                botNumber: currentBotNumber
            });
        }

        // Install the number-reply listener from this command.
        installReplyListener(sock);

        const sent = await sock.sendMessage(
            from,
            {
                text: mainMenu(settings)
            },
            { quoted: msg }
        );

        if (sent?.key?.id) {
            sessions.set(sent.key.id, {
                botNumber: currentBotNumber,
                ownerJid: sender || msg.key?.participant || msg.key?.remoteJid,
                createdAt: Date.now(),
                waitingForText: false
            });

            setTimeout(() => {
                sessions.delete(sent.key.id);
            }, 5 * 60 * 1000);
        }
    } catch (error) {
        console.error("[SETTING PANEL ERROR]", error);
        return reply("❌ Settings Menu එක පෙන්වීමේදී දෝෂයක් ඇතිවුණා: " + error.message);
    }
}

};
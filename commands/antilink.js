const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const FILE = path.join(DATA_DIR, "antilink.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({}, null, 2));
}

function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveSettings(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = {
    name: "antilink",
    alias: ["antilinks"],
    desc: "Enable or disable Anti Link",
    category: "group",
    use: ".antilink on/off",

    async execute(sock, msg, args, from, { reply }) {
        try {
            if (!from.endsWith("@g.us")) {
                return reply("❌ මේ Command එක Group එකක පමණයි.");
            }

            const metadata = await sock.groupMetadata(from);
            const sender = msg.key.participant || msg.key.remoteJid;

            const senderData = metadata.participants.find(
                p => p.id === sender
            );

            if (!senderData?.admin) {
                return reply("❌ මේ Command එක භාවිතා කළ හැක්කේ Group Admin කෙනෙකුට පමණයි.");
            }

            const option = (args[0] || "").toLowerCase();
            const settings = getSettings();

            if (option === "on") {
                settings[from] = {
                    enabled: true
                };

                saveSettings(settings);

                return reply(
                    "╭━━〔 🔗 ANTI LINK 〕━━╮\n┃\n┃ ✅ Anti-Link Enabled!\n┃\n┃ 🔢 Link Limit : 5\n┃ ⚠️ 5 වැනි Link එකේදී Kick කරනවා.\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯"
                );
            }

            if (option === "off") {
                settings[from] = {
                    enabled: false
                };

                saveSettings(settings);

                return reply(
                    "╭━━〔 🔗 ANTI LINK 〕━━╮\n┃\n┃ ❌ Anti-Link Disabled!\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯"
                );
            }

            return reply(
                "╭━━〔 🔗 ANTI LINK SETTINGS 〕━━╮\n┃\n┃ .antilink on\n┃ .antilink off\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯"
            );

        } catch (error) {
            console.error("ANTILINK COMMAND ERROR:", error);
            return reply("❌ Anti-Link Settings Error!");
        }
    },

    async handleAntiLink(sock, msg, from) {
        try {
            if (!from || !from.endsWith("@g.us")) return;
            if (msg.key.fromMe) return;

            const settings = getSettings();

            if (!settings[from]?.enabled) return;

            const metadata = await sock.groupMetadata(from);
            const sender = msg.key.participant || msg.key.remoteJid;

            const senderData = metadata.participants.find(
                p => p.id === sender
            );

            // Adminලාට Anti-Link ක්‍රියාත්මක වෙන්නේ නැහැ
            if (!senderData || senderData.admin) return;

            // Message text ලබාගැනීම
            const message = msg.message || {};

            const text =
                message.conversation ||
                message.extendedTextMessage?.text ||
                message.imageMessage?.caption ||
                message.videoMessage?.caption ||
                message.documentMessage?.caption ||
                "";

            // Link Detection
            const linkRegex =
                /(?:https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|discord\.gg\/)[^\s]+/i;

            if (!linkRegex.test(text)) return;

            const botNumber = sock.user.id.split(":")[0];

            const botData = metadata.participants.find(
                p => p.id.split(":")[0] === botNumber
            );

            if (!botData?.admin) {
                return sock.sendMessage(from, {
                    text: "⚠️ Anti-Link වැඩ කිරීමට Bot ට Admin Permission ලබා දෙන්න."
                });
            }

            // Link count
            if (!this.linkCounts) this.linkCounts = {};

            const countKey = `${from}_${sender}`;

            this.linkCounts[countKey] =
                (this.linkCounts[countKey] || 0) + 1;

            const count = this.linkCounts[countKey];

            if (count < 5) {
                return sock.sendMessage(from, {
                    text:
                        `╭━━〔 ⚠️ ANTI LINK 〕━━╮\n┃\n┃ 🚫 Link දාන්න එපා!\n┃ 👤 @${sender.split("@")[0]}\n┃ 🔢 Count : ${count}/5\n┃\n┃ ⚠️ තවත් ${5 - count} වතාවක් Link දැම්මොත් Kick කරනවා.\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯`,
                    mentions: [sender]
                }, {
                    quoted: msg
                });
            }

            // 5 වැනි Link එකේදී Kick
            await sock.sendMessage(from, {
                text:
                    `╭━━〔 ❌ ANTI LINK KICK 〕━━╮\n┃\n┃ 👤 @${sender.split("@")[0]}\n┃ 🚫 Link Limit ඉක්මවා ඇත!\n┃ 🔢 Count : 5/5\n┃\n┃ ❌ Group එකෙන් ඉවත් කරනවා.\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯`,
                mentions: [sender]
            });

            await sock.groupParticipantsUpdate(
                from,
                [sender],
                "remove"
            );

            delete this.linkCounts[countKey];

        } catch (error) {
            console.error("ANTI LINK ERROR:", error);
        }
    }
};
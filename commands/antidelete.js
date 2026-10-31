const config = require("../config");

const {
    getBotSettings,
    updateBotSettings
} = require("../lib/settingsHelper");

// ════════════════════════════════════════════════════════
//          ZANTA-XMD ANTI-DELETE
//          MongoDB Settings සහ Owner Check.
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

// ════════════════════════════════════════════════════════
//          OWNER VALIDATION
//          Paired Account + Config Owner.
// ════════════════════════════════════════════════════════

function isBotOwner(senderJid, botJid) {
    const senderNumber = getNumber(senderJid);
    const pairedNumber = getNumber(botJid);

    const configuredOwners = Array.isArray(config.OWNER_NUMBER)
        ? config.OWNER_NUMBER
        : String(config.OWNER_NUMBER || "").split(",");

    const ownerNumbers = configuredOwners
        .map(getNumber)
        .filter(Boolean);

    if (pairedNumber) {
        ownerNumbers.push(pairedNumber);
    }

    return (
        senderNumber &&
        ownerNumbers.includes(senderNumber)
    );
}

module.exports = {
    name: "antidelete",
    alias: ["antidel", "ad"],
    desc: "Anti Delete Settings",
    category: "settings",
    use: ".antidelete on me / chat / off",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // ════════════════════════════════════════════════
            //          OWNER CHECK
            // ════════════════════════════════════════════════

            const senderJid =
                msg.key.participant || msg.key.remoteJid;

            if (!isBotOwner(senderJid, sock.user?.id)) {
                return reply(zantaBox("ACCESS DENIED", [
                    "මෙම Command එක Bot Ownerට පමණයි.",
                    "Paired Account හෝ Config Owner භාවිතා කරන්න."
                ]));
            }

            // ════════════════════════════════════════════════
            //          BOT SETTINGS
            // ════════════════════════════════════════════════

            const botNumber = getNumber(sock.user?.id);

            const settings = await getBotSettings(botNumber);

            if (!settings) {
                return reply(zantaBox("DATABASE ERROR", [
                    "Bot Settings ලබාගැනීමට නොහැකි වුණා."
                ]));
            }

            const currentRoute =
                settings.antiDeleteRoute || "me";

            // ════════════════════════════════════════════════
            //          HELP MENU
            // ════════════════════════════════════════════════

            if (!args[0]) {
                const currentMode =
                    currentRoute === "off"
                        ? "OFF"
                        : currentRoute === "from"
                            ? "CHAT"
                            : "ME";

                return reply(zantaBox("ANTI DELETE SETTINGS", [
                    `Current Mode: ${currentMode}`,
                    "",
                    ".antidelete on me",
                    ".antidelete on chat",
                    ".antidelete off",
                    "",
                    "ME = Ownerට යැවීම",
                    "CHAT = Original Chat එකට යැවීම",
                    "OFF = අක්‍රිය කිරීම"
                ]));
            }

            const action = String(args[0]).toLowerCase();
            const mode = String(args[1] || "").toLowerCase();

            // ════════════════════════════════════════════════
            //          DISABLE ANTI DELETE
            // ════════════════════════════════════════════════

            if (action === "off") {
                await updateBotSettings(botNumber, {
                    antiDeleteRoute: "off"
                });

                return reply(zantaBox("ANTI DELETE OFF", [
                    "Anti-Delete අක්‍රිය කළා.",
                    "Deleted messages නැවත යවන්නේ නැහැ."
                ]));
            }

            // ════════════════════════════════════════════════
            //          ENABLE ANTI DELETE
            // ════════════════════════════════════════════════

            if (action === "on") {
                if (!["me", "chat"].includes(mode)) {
                    return reply(zantaBox("INVALID MODE", [
                        ".antidelete on me",
                        ".antidelete on chat",
                        ".antidelete off"
                    ]));
                }

                const route = mode === "chat" ? "from" : "me";

                await updateBotSettings(botNumber, {
                    antiDeleteRoute: route
                });

                return reply(zantaBox("ANTI DELETE UPDATED", [
                    "Status: ON",
                    `Mode: ${mode.toUpperCase()}`,
                    "",
                    mode === "me"
                        ? "Deleted messages Ownerට යැවීමට සකස් කළා."
                        : "Deleted messages Original Chat එකට යැවීමට සකස් කළා.",
                    "",
                    "MongoDB එකේ Save කළා."
                ]));
            }

            return reply(zantaBox("INVALID COMMAND", [
                ".antidelete on me",
                ".antidelete on chat",
                ".antidelete off"
            ]));

        } catch (error) {
            console.error("ANTIDELETE ERROR:", error);

            return reply(zantaBox("ANTI DELETE ERROR", [
                String(error.message || error).slice(0, 150)
            ]));
        }
    }
};
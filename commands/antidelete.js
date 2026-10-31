const {
    getBotSettings,
    updateBotSettings
} = require("../lib/settingsHelper");

// ════════════════════════════════════════════════════════
//          ZANTA-XMD ANTI-DELETE SETTINGS
//          MongoDB හරහා Anti-Delete පාලනය කිරීම.
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

function getNumber(jid) {
    return String(jid || "")
        .split("@")[0]
        .split(":")[0]
        .replace(/[^0-9]/g, "");
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
            //          Bot Account එක පරීක්ෂා කිරීම.
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
                    "මෙම Command එක Bot Ownerට පමණයි."
                ]));
            }

            // ════════════════════════════════════════════════
            //          GET SETTINGS
            //          MongoDB Settings ලබාගැනීම.
            // ════════════════════════════════════════════════

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
            //          Anti-Delete භාවිතා කරන ආකාරය.
            // ════════════════════════════════════════════════

            if (!args[0]) {
                return reply(zantaBox("ANTI DELETE SETTINGS", [
                    `Current Mode: ${currentRoute}`,
                    "",
                    ".antidelete on me",
                    ".antidelete on chat",
                    ".antidelete off",
                    "",
                    "me = Ownerට යැවීම",
                    "chat = Original Chat එකට යැවීම",
                    "off = Disable කිරීම"
                ]));
            }

            const action = String(args[0]).toLowerCase();
            const mode = String(args[1] || "").toLowerCase();

            // ════════════════════════════════════════════════
            //          DISABLE ANTI DELETE
            //          Anti-Delete අක්‍රිය කිරීම.
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
            //          Anti-Delete සක්‍රිය කිරීම.
            // ════════════════════════════════════════════════

            if (action === "on") {
                if (!["me", "chat"].includes(mode)) {
                    return reply(zantaBox("INVALID MODE", [
                        "නිවැරදි Mode එකක් තෝරන්න.",
                        ".antidelete on me",
                        ".antidelete on chat"
                    ]));
                }

                const route = mode === "chat" ? "from" : "me";

                await updateBotSettings(botNumber, {
                    antiDeleteRoute: route
                });

                return reply(zantaBox("ANTI DELETE UPDATED", [
                    `Status: ON`,
                    `Mode: ${mode}`,
                    "",
                    mode === "me"
                        ? "Deleted messages Ownerට යැවීමට සකස් කළා."
                        : "Deleted messages Original Chat එකට යැවීමට සකස් කළා."
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
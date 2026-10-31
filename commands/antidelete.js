const settings = require("../settings");

// ════════════════════════════════════════════════════════
//          ZANTA-XMD ANTI-DELETE SETTINGS
//          Deleted Message Settings පාලනය කිරීම.
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
            //          Bot Owner පමණක් භාවිතා කිරීම.
            // ════════════════════════════════════════════════

            const sender = msg.key.participant || msg.key.remoteJid;
            const senderNumber = sender.split("@")[0].split(":")[0];
            const ownerNumber = (process.env.OWNER_NUMBER || "")
                .replace(/\D/g, "");

            if (!ownerNumber || senderNumber !== ownerNumber) {
                return reply(zantaBox("ACCESS DENIED", [
                    "මෙම Command එක භාවිතා කළ හැක්කේ Ownerට පමණයි."
                ]));
            }

            // ════════════════════════════════════════════════
            //          ARGUMENT CHECK
            //          Command Arguments පරීක්ෂා කිරීම.
            // ════════════════════════════════════════════════

            const action = (args[0] || "").toLowerCase();
            const mode = (args[1] || "").toLowerCase();

            settings.antidelete = settings.antidelete || {
                enabled: false,
                mode: "me"
            };

            // ════════════════════════════════════════════════
            //          ANTI-DELETE OFF
            //          Anti Delete අක්‍රිය කිරීම.
            // ════════════════════════════════════════════════

            if (action === "off") {
                settings.antidelete.enabled = false;

                return reply(zantaBox("ANTI-DELETE DISABLED", [
                    "Anti-Delete: OFF",
                    "Deleted messages නැවත යොමු කිරීම අක්‍රියයි."
                ]));
            }

            // ════════════════════════════════════════════════
            //          ANTI-DELETE ON
            //          Anti Delete සක්‍රිය කිරීම.
            // ════════════════════════════════════════════════

            if (action === "on") {
                if (!["me", "chat"].includes(mode)) {
                    return reply(zantaBox("ANTI-DELETE SETTINGS", [
                        ".antidelete on me",
                        ".antidelete on chat",
                        ".antidelete off"
                    ]));
                }

                settings.antidelete.enabled = true;
                settings.antidelete.mode = mode;

                const description = mode === "me"
                    ? "Deleted messages Ownerට යොමු කිරීම."
                    : "Deleted messages මුල් Chat එකට යොමු කිරීම.";

                return reply(zantaBox("ANTI-DELETE ENABLED", [
                    "Status: ON",
                    `Mode: ${mode.toUpperCase()}`,
                    description
                ]));
            }

            // ════════════════════════════════════════════════
            //          INVALID COMMAND
            //          වැරදි Arguments සඳහා උපදෙස්.
            // ════════════════════════════════════════════════

            return reply(zantaBox("ANTI-DELETE MENU", [
                ".antidelete on me",
                ".antidelete on chat",
                ".antidelete off"
            ]));

        } catch (error) {
            console.error("ANTIDELETE ERROR:", error);

            return reply(zantaBox("ERROR", [
                "Anti-Delete Settings වෙනස් කිරීමේදී දෝෂයක් ඇතිවුණා."
            ]));
        }
    }
};
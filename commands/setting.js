const botConfig = require("../config");

module.exports = {
    name: "setting",
    alias: ["settings", "setmenu", "settingmenu"],
    desc: "ZANTA-XMD Settings Menu",
    category: "settings",
    use: ".setting",

    async execute(sock, msg, args, from, {
        reply,
        settings,
        isOwner
    }) {
        try {
            if (!isOwner) {
                return reply("❌ Owner Only Command!");
            }

            // ════════════════ GIFT ROUND VIDEO ════════════════════════
            const giftVideo = "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"

            if (giftVideo) {
                try {
                    await sock.sendMessage(from, {
                        video: { url: giftVideo },
                        ptv: true
                    }, { quoted: msg });
                } catch (e) {
                    console.log("Gift PTV Error:", e.message);
                }
            }

            // ════════════════ SETTINGS BOX ════════════════════════
            const botName = settings?.botName || botConfig.BOT_NAME;
            const prefix = settings?.prefix || ".";
            const mode = settings?.workMode || "public";
            const presence = settings?.presence || "off";

            const menu =
`╭━━〔 ⚙️ ${botName} SETTINGS 〕━━╮
┃
┃ 👑 *BOT CONFIGURATION*
┃
┃ ${prefix}setname <name>
┃ ${prefix}setlogo <image URL>
┃ ${prefix}setprefix <prefix>
┃ ${prefix}setpresence typing
┃ ${prefix}setpresence recording
┃ ${prefix}setpresence off
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ 🌐 *WORK MODE*
┃
┃ ${prefix}public
┃ ${prefix}private
┃ ${prefix}group
┃ ${prefix}inbox
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ 👁️ *STATUS SETTINGS*
┃
┃ ${prefix}status views on
┃ ${prefix}status views off
┃ ${prefix}status react on
┃ ${prefix}status react off
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ 🛡️ *SECURITY SETTINGS*
┃
┃ ${prefix}welcome on
┃ ${prefix}welcome off
┃ ${prefix}anti call on
┃ ${prefix}anti call off
┃ ${prefix}ban @user
┃ ${prefix}unban @user
┃ ${prefix}block @user
┃ ${prefix}unblock @user
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ 🤖 *AUTO REACT*
┃
┃ ${prefix}autoreact on
┃ ${prefix}autoreact off
┃ ${prefix}autoreply on/off\n┃ ${prefix}autoreplyvoice on/off
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ 📊 *CURRENT CONFIGURATION*
┃
┃ • Bot Name: ${botName}
┃ • Prefix: ${prefix}
┃ • Work Mode: ${mode.toUpperCase()}
┃ • Presence: ${presence.toUpperCase()}
┃
╰━━━━━━━━━━━━━━━━━━━━
> ⚔️ POWERED BY ${botName}`;

            await sock.sendMessage(from, {
                text: menu
            }, { quoted: msg });

        } catch (error) {
            console.error("Settings Menu Error:", error);
            await reply("❌ Settings Menu එක යැවීමේදී දෝෂයක් ඇතිවුණා.");
        }
    }
};
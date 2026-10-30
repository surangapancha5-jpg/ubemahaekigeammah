module.exports = {
    name: "getdp",
    alias: ["dp", "profilepic", "getprofile"],
    desc: "Get WhatsApp profile picture",
    category: "tools",
    use: ".getdp @user",

    async execute(sock, msg, args, from, { reply }) {

        try {

            let jid;

            // Get Mentioned User
            const mentioned =
                msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

            if (mentioned.length > 0) {
                jid = mentioned[0];
            }

            // Get Quoted User
            else {
                const context =
                    msg.message?.extendedTextMessage?.contextInfo;

                if (context?.participant) {
                    jid = context.participant;
                }
            }

            // Get Number From Arguments
            if (!jid && args[0]) {
                const number = args[0].replace(/[^0-9]/g, "");

                if (number.length >= 7) {
                    jid = number + "@s.whatsapp.net";
                }
            }

            // Default Sender
            if (!jid) {
                jid = msg.key.participant || msg.key.remoteJid;
            }

            await sock.sendMessage(from, {
                text: "🔍 *Fetching Profile Picture...*"
            }, { quoted: msg });

            // Get Profile Picture
            let ppUrl;

            try {
                ppUrl = await sock.profilePictureUrl(jid, "image");
            } catch (err) {
                return reply("❌ This user has no accessible profile picture.");
            }

            // Send DP
            await sock.sendMessage(from, {
                image: { url: ppUrl },
                caption: `
╭━━〔 👤 USER PROFILE 〕━━╮
┃
┃ 👤 *USER:* @${jid.split("@")[0]}
┃ 📸 *PROFILE PICTURE*
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

> © ZANTA-XMD MINI 💫
`,
                mentions: [jid]
            }, { quoted: msg });

        } catch (error) {

            console.error("GETDP ERROR:", error);

            await reply("❌ Failed to get profile picture!");

        }
    }
};
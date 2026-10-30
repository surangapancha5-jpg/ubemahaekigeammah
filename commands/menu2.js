cmd({
    pattern: "menu2",
    alias: ["memu", "allmenu"],
    desc: "Show bot menu with gift video",
    category: "main",
    react: "🎁",
    filename: __filename
},
async(conn, mek, m, { from, reply }) => {
    try {
        const videoUrl = "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";
        
        const menuText = `
*┏━ ZANTA MD MENU ━━*
*┃*
*┣* .ping
*┣* .alive
*┣* .owner
*┣* .bot info
*┗━━━━━━━━━━━━━━━*
> ZANTA MD 💫
`;

        // Gift / View Once Video with Newsletter Share
        await conn.sendMessage(from, {
            video: { url: videoUrl },
            caption: menuText,
            gifPlayback: false,
            viewOnce: true, // මේක තමයි gift එක වගේ යන්නෙ
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363411691471139@newsletter",
                    newsletterName: "ZANTA MD",
                    serverMessageId: 1
                }
            }
        }, { quoted: mek });

    } catch (e) {
        console.log(e)
        reply("Error ❌")
    }
})
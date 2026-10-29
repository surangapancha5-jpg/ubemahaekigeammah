module.exports = {
name: "jid",
alias: ["getjid"],
desc: "Get JID of chat or replied message sender",
category: "main",
use: ".jid",

async execute(sock, msg, args, from, { reply }) {
    try {
        const contextInfo =
            msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.imageMessage?.contextInfo ||
            msg.message?.videoMessage?.contextInfo;

        // If replying to a message, get the sender JID
        const participant = contextInfo?.participant;

        // In a group, "from" is the group JID
        const jid = participant || from;

        await reply(
            `╭━━〔 🔎 JID FINDER 〕━━╮\n` +
            `┃\n` +
            `┃ 📌 JID:\n` +
            `┃ ${jid}\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━╯`
        );

    } catch (error) {
        console.error("JID ERROR:", error);
        await reply("❌ JID එක ලබාගැනීමට නොහැකි වුණා!");
    }
}

};
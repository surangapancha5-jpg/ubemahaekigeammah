const sleep = ms =>
new Promise(resolve => setTimeout(resolve, ms));

// ════════════════════════════════════════════════════════
//          ZANTA-XMD HACK PRANK MESSAGES
//          විහිළු Hack Messages 5ක්
// ════════════════════════════════════════════════════════

const HACK_MESSAGES = [
"⚠️ SYSTEM ALERT!\nTarget kill",
"🔍 Connecting to ZANTA-XMD Security Server...",
"💻 Scanning hakin System Files...\nPlease Wait...",
"🔓 Simulated Access Granted!\nZANTA-XMD Connection Established.",
"☠️ ZANTA-XMD HACK COMPLETED!\Hack Mode Activated ☠️"
];

// ════════════════════════════════════════════════════════
//          EMPTY DOCUMENT GENERATOR
//          හිස් Documents 3ක් සෑදීම
// ════════════════════════════════════════════════════════

function createEmptyFile() {
return Buffer.alloc(0);
}

// ════════════════════════════════════════════════════════
//          HACK COMMAND
//          ප්‍රධාන Prank Command එක
// ════════════════════════════════════════════════════════

module.exports = {
name: "hack",
alias: ["prankhack"],
desc: "Fake Hacking Prank",
category: "fun",
use: ".hack",

async execute(sock, msg, args, from, { reply }) {
    try {

        // ════════════════════════════════════════════════
        //          START REACTION
        //          Prank එක ආරම්භ කිරීම
        // ════════════════════════════════════════════════

        await sock.sendMessage(from, {
            react: {
                text: "💀",
                key: msg.key
            }
        });

        // ════════════════════════════════════════════════
        //          SEND 5 HACK MESSAGES
        //          Messages 5ක් යැවීම
        // ════════════════════════════════════════════════

        for (let i = 0; i < HACK_MESSAGES.length; i++) {

            await sock.sendMessage(from, {
                text:

"╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 〕━━┈⊷ ┃◈╭─────────────·๏ ┃◈┃ ┃◈┃ ${HACK_MESSAGES[i]} ┃◈┃ ┃◈┃• 𝐏𝐫𝐨𝐠𝐫𝐞𝐬𝐬: ${((i + 1) / 5 * 100).toFixed(0)}% ┃◈┃ ┃◈└───────────┈⊷ ╰──────────────┈⊷"
}, {
quoted: msg
});

            await sleep(1800);
        }

        // ════════════════════════════════════════════════
        //          SEND 3 EMPTY DOCUMENTS
        //          හිස් Documents 3ක් යැවීම
        // ════════════════════════════════════════════════

        const fileNames = [
            "ZANTA-XMD_HACKED_FILE_01.txt",
            "ZANTA-XMD_HACKED_FILE_02.txt",
            "ZANTA-XMD_HACKED_FILE_03.txt"
        ];

        for (const fileName of fileNames) {

            await sock.sendMessage(from, {
                document: createEmptyFile(),
                mimetype: "text/plain",
                fileName,
                caption: "☠️ 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐅𝐈𝐋𝐄"
            }, {
                quoted: msg
            });

            await sleep(1000);
        }

        // ════════════════════════════════════════════════
        //          FINAL PRANK MESSAGE
        //          අවසාන විහිළු Message එක
        // ════════════════════════════════════════════════

        await sock.sendMessage(from, {
            text:

`╭━━〔 𝐇𝐀𝐂𝐊𝐄𝐃 𝐂𝐎𝐌𝐏𝐋𝐄𝐓𝐄𝐃 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ZANTA-XMD HACKED YOU!
┃◈┃
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

«𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
}, {
quoted: msg
});»

        // ════════════════════════════════════════════════
        //          SUCCESS REACTION
        //          සාර්ථකත්වය පෙන්වීම
        // ════════════════════════════════════════════════

        await sock.sendMessage(from, {
            react: {
                text: "📩",
                key: msg.key
            }
        });

    } catch (error) {

        // ════════════════════════════════════════════════
        //          ERROR HANDLING
        //          Errors පාලනය කිරීම
        // ════════════════════════════════════════════════

        console.error("[ZANTA HACK ERROR]", error);

        return reply(

`╭━━〔 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐄𝐑𝐑𝐎𝐑 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃⛩️ ᴇʀʀᴏʀ : ${error.message}
┃◈┃
┃◈└───────────┈⊷
╰──────────────┈⊷

«𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
);
}
}
};»
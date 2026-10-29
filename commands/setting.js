const { updateBotSettings } = require("../lib/settingsHelper");

const sessions = global.settingSessions || (global.settingSessions = {});

const MAIN_MENU = `╭━━〔 ⚙️ BOT SETTINGS 〕━━╮
┃
┃ 1. Work Mode
┃ 2. Fake Presence
┃ 3. Anti ViewOnce Route
┃ 4. Anti Delete Route
┃ 5. Auto Status Read
┃ 6. Auto Status React
┃ 7. Welcome Message
┃ 8. Goodbye Message
┃ 9. Set Welcome Text
┃ 10. Set Goodbye Text
┃ 0. Close Menu
┃
╰━━━━━━━━━━━━━━━━━━╯

🔢 අවශ්‍ය Number එක Reply කරන්න.`;

const MENUS = {
workmode: `╭━━〔 WORK MODE 〕━━╮
┃ 1. Public
┃ 2. Private
┃ 3. Groups Only
┃ 4. Inbox Only
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

presence: `╭━━〔 FAKE PRESENCE 〕━━╮

┃ 1. Off
┃ 2. Always Typing
┃ 3. Always Recording
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

antiviewonce: `╭━━〔 ANTI VIEW-ONCE ROUTE 〕━━╮

┃ 1. Bot Owner Inbox
┃ 2. Same Chat
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

antidelete: `╭━━〔 ANTI DELETE ROUTE 〕━━╮

┃ 1. Bot Owner Inbox
┃ 2. Same Chat
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

statusread: `╭━━〔 AUTO STATUS READ 〕━━╮

┃ 1. Turn ON
┃ 2. Turn OFF
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

statusreact: `╭━━〔 AUTO STATUS REACT 〕━━╮

┃ 1. Turn ON 💚
┃ 2. Turn OFF
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

welcome: `╭━━〔 WELCOME MESSAGE 〕━━╮

┃ 1. Enable Welcome
┃ 2. Disable Welcome
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

goodbye: `╭━━〔 GOODBYE MESSAGE 〕━━╮

┃ 1. Enable Goodbye
┃ 2. Disable Goodbye
┃ 0. Back
╰━━━━━━━━━━━━━━━━━━╯

Number එක Reply කරන්න.`,

setwelcome: `✍️ අලුත් Welcome Message එක මෙතැනින් යවන්න.

උදාහරණය:
Welcome to our group! ❤️

0 Reply කළොත් Cancel.`,

setgoodbye: `✍️ අලුත් Goodbye Message එක මෙතැනින් යවන්න.

උදාහරණය:
Goodbye! Take care 👋

0 Reply කළොත් Cancel.`
};

module.exports = {
name: "setting",
alias: ["settings", "config"],
desc: "Number reply bot settings",
category: "owner",
use: ".setting",

async execute(sock, msg, args, from, ctx) {
    const { reply, isOwner, currentBotNumber } = ctx;

    if (!isOwner) {
        return reply("❌ මෙම Settings භාවිතා කළ හැක්කේ Bot Owner හට පමණයි.");
    }

    const botNumber = String(currentBotNumber || "").replace(/\D/g, "");
    if (!botNumber) {
        return reply("❌ Bot number එක ලබාගත නොහැකියි.");
    }

    const action = (args[0] || "").toLowerCase();

    if (action === "cancel") {
        delete sessions[from];
        return reply("✅ Settings menu එක වසා දැමුවා.");
    }

    if (!action) {
        sessions[from] = {
            botNumber,
            stage: "main",
            owner: ctx.sender
        };
        return reply(MAIN_MENU);
    }

    return reply("භාවිතය: .setting\nඉන්පසු Menu එකට Number එක Reply කරන්න.");
},

async handleReply(sock, msg, from, ctx) {
    const { reply, isOwner, currentBotNumber } = ctx;
    const session = sessions[from];

    if (!session) return false;
    if (!isOwner) return false;

    const botNumber = String(currentBotNumber || "").replace(/\D/g, "");
    if (session.botNumber !== botNumber) return false;

    const body = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ""
    ).trim();

    if (!body) return false;

    if (body === "0") {
        if (session.stage === "main") {
            delete sessions[from];
            await reply("✅ Settings menu එක වසා දැමුවා.");
        } else {
            session.stage = "main";
            await reply(MAIN_MENU);
        }
        return true;
    }

    if (session.stage === "setwelcome" || session.stage === "setgoodbye") {
        const key = session.stage === "setwelcome"
            ? "welcomeMessage"
            : "goodbyeMessage";

        try {
            await updateBotSettings(botNumber, key, body);
            session.stage = "main";
            await reply("✅ Message එක Save කළා.\n\n" + MAIN_MENU);
        } catch (error) {
            console.error("[SETTING SAVE ERROR]", error);
            await reply("❌ Save කරන්න බැරි වුණා. settingsHelper.js පරීක්ෂා කරන්න.");
        }

        return true;
    }

    const n = Number(body);
    if (!Number.isInteger(n)) return false;

    if (session.stage === "main") {
        const pages = {
            1: "workmode",
            2: "presence",
            3: "antiviewonce",
            4: "antidelete",
            5: "statusread",
            6: "statusreact",
            7: "welcome",
            8: "goodbye",
            9: "setwelcome",
            10: "setgoodbye"
        };

        const page = pages[n];
        if (!page) {
            await reply("❌ වැරදි Number එකක්.\n\n" + MAIN_MENU);
            return true;
        }

        session.stage = page;
        await reply(MENUS[page]);
        return true;
    }

    let key;
    let value;

    switch (session.stage) {
        case "workmode":
            if (n < 1 || n > 4) return reply("❌ 1 සිට 4 දක්වා Number එකක් Reply කරන්න.");
            key = "workMode";
            value = ["public", "private", "groups", "inbox"][n - 1];
            break;

        case "presence":
            if (n < 1 || n > 3) return reply("❌ 1, 2 හෝ 3 Reply කරන්න.");
            key = "presence";
            value = ["off", "typing", "recording"][n - 1];
            break;

        case "antiviewonce":
            if (n < 1 || n > 2) return reply("❌ 1 හෝ 2 Reply කරන්න.");
            key = "antiViewRoute";
            value = n === 1 ? "me" : "from";
            break;

        case "antidelete":
            if (n < 1 || n > 2) return reply("❌ 1 හෝ 2 Reply කරන්න.");
            key = "antiDeleteRoute";
            value = n === 1 ? "me" : "from";
            break;

        case "statusread":
            if (n < 1 || n > 2) return reply("❌ 1 හෝ 2 Reply කරන්න.");
            key = "statusSeen";
            value = n === 1;
            break;

        case "statusreact":
            if (n < 1 || n > 2) return reply("❌ 1 හෝ 2 Reply කරන්න.");
            key = "statusReact";
            value = n === 1 ? "💚" : "off";
            break;

        case "welcome":
            if (n < 1 || n > 2) return reply("❌ 1 හෝ 2 Reply කරන්න.");
            key = "welcomeEnabled";
            value = n === 1;
            break;

        case "goodbye":
            if (n < 1 || n > 2) return reply("❌ 1 හෝ 2 Reply කරන්න.");
            key = "goodbyeEnabled";
            value = n === 1;
            break;

        default:
            return false;
    }

    try {
        await updateBotSettings(botNumber, key, value);
        session.stage = "main";

        await reply(
            `✅ Setting එක Save කළා.\n\n` +
            `⚙️ ${key}\n` +
            `📌 ${String(value)}\n\n` +
            MAIN_MENU
        );
    } catch (error) {
        console.error("[SETTING SAVE ERROR]", error);
        await reply("❌ Setting එක Save කරන්න බැරි වුණා.");
    }

    return true;
}

};
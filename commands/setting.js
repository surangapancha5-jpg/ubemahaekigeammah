const { updateBotSettings } = require("../lib/settingsHelper");

module.exports = {
name: "setting",
alias: ["settings", "config"],
desc: "Configure bot settings",
category: "owner",
use: ".setting",

async execute(sock, msg, args, from, ctx) {
    const { reply, isOwner, currentBotNumber } = ctx;

    if (!isOwner) {
        return reply("❌ මෙම command එක භාවිතා කළ හැක්කේ Bot Owner හට පමණයි.");
    }

    const menu = `

╭━━〔 ⚙️ BOT SETTINGS 〕━━╮
┃
┃ 🤖 WORK MODE
┃ .setting workmode public
┃ .setting workmode private
┃ .setting workmode groups
┃ .setting workmode inbox
┃
┃ 🎭 FAKE PRESENCE
┃ .setting presence off
┃ .setting presence typing
┃ .setting presence recording
┃
┃ 👁️ ANTI VIEW-ONCE ROUTE
┃ .setting antiviewonce me
┃ .setting antiviewonce from
┃
┃ 🗑️ ANTI DELETE ROUTE
┃ .setting antidelete me
┃ .setting antidelete from
┃
┃ 📱 AUTO STATUS READ
┃ .setting statusread on
┃ .setting statusread off
┃
┃ 💚 AUTO STATUS REACT
┃ .setting statusreact on
┃ .setting statusreact off
┃
┃ 👋 WELCOME MESSAGE
┃ .setting welcome on
┃ .setting welcome off
┃ .setting setwelcome Welcome to our group! ❤️
┃
┃ 🚪 GOODBYE MESSAGE
┃ .setting goodbye on
┃ .setting goodbye off
┃ .setting setgoodbye Goodbye! Take care 👋
┃
╰━━━━━━━━━━━━━━━━━━╯
`;

    try {
        const action = (args[0] || "").toLowerCase();
        const value = args.slice(1).join(" ").trim();
        const botNumber = String(currentBotNumber || "").replace(/\D/g, "");

        if (!action) {
            return reply(menu);
        }

        if (!botNumber) {
            return reply("❌ Bot number එක ලබාගැනීමට නොහැකියි.");
        }

        let key;
        let settingValue;

        // WORK MODE
        if (action === "workmode") {
            const mode = value.toLowerCase();
            const allowed = ["public", "private", "groups", "inbox"];

            if (!allowed.includes(mode)) {
                return reply(
                    "❌ වැරදි Work Mode එකක්.\n\n" +
                    "public = හැමෝටම\n" +
                    "private = Owner පමණයි\n" +
                    "groups = Groups පමණයි\n" +
                    "inbox = Private chats පමණයි"
                );
            }

            key = "workMode";
            settingValue = mode;
        }

        // FAKE PRESENCE
        else if (action === "presence") {
            const mode = value.toLowerCase();

            if (!["off", "typing", "recording"].includes(mode)) {
                return reply(
                    "❌ භාවිතය:\n" +
                    ".setting presence off\n" +
                    ".setting presence typing\n" +
                    ".setting presence recording"
                );
            }

            key = "presence";
            settingValue = mode;
        }

        // ANTI VIEW-ONCE ROUTE
        else if (action === "antiviewonce") {
            const route = value.toLowerCase();

            if (!["me", "from"].includes(route)) {
                return reply(
                    "❌ භාවිතය:\n" +
                    ".setting antiviewonce me\n" +
                    ".setting antiviewonce from"
                );
            }

            key = "antiViewRoute";
            settingValue = route;
        }

        // ANTI DELETE ROUTE
        else if (action === "antidelete") {
            const route = value.toLowerCase();

            if (!["me", "from"].includes(route)) {
                return reply(
                    "❌ භාවිතය:\n" +
                    ".setting antidelete me\n" +
                    ".setting antidelete from"
                );
            }

            key = "antiDeleteRoute";
            settingValue = route;
        }

        // AUTO STATUS READ
        else if (action === "statusread") {
            const mode = value.toLowerCase();

            if (!["on", "off"].includes(mode)) {
                return reply(
                    "❌ භාවිතය:\n" +
                    ".setting statusread on\n" +
                    ".setting statusread off"
                );
            }

            key = "statusSeen";
            settingValue = mode === "on";
        }

        // AUTO STATUS REACT
        else if (action === "statusreact") {
            const mode = value.toLowerCase();

            if (mode === "off") {
                key = "statusReact";
                settingValue = "off";
            } else if (mode === "on") {
                key = "statusReact";
                settingValue = "💚";
            } else {
                return reply(
                    "❌ භාවිතය:\n" +
                    ".setting statusreact on\n" +
                    ".setting statusreact off"
                );
            }
        }

        // WELCOME ENABLE / DISABLE
        else if (action === "welcome") {
            const mode = value.toLowerCase();

            if (!["on", "off"].includes(mode)) {
                return reply(
                    "❌ භාවිතය:\n" +
                    ".setting welcome on\n" +
                    ".setting welcome off"
                );
            }

            key = "welcomeEnabled";
            settingValue = mode === "on";
        }

        // GOODBYE ENABLE / DISABLE
        else if (action === "goodbye") {
            const mode = value.toLowerCase();

            if (!["on", "off"].includes(mode)) {
                return reply(
                    "❌ භාවිතය:\n" +
                    ".setting goodbye on\n" +
                    ".setting goodbye off"
                );
            }

            key = "goodbyeEnabled";
            settingValue = mode === "on";
        }

        // CUSTOM WELCOME MESSAGE
        else if (action === "setwelcome") {
            if (!value) {
                return reply(
                    "❌ Welcome message එකක් ඇතුළත් කරන්න.\n\n" +
                    "උදාහරණය:\n" +
                    ".setting setwelcome Welcome to our group! ❤️"
                );
            }

            key = "welcomeMessage";
            settingValue = value;
        }

        // CUSTOM GOODBYE MESSAGE
        else if (action === "setgoodbye") {
            if (!value) {
                return reply(
                    "❌ Goodbye message එකක් ඇතුළත් කරන්න.\n\n" +
                    "උදාහරණය:\n" +
                    ".setting setgoodbye Goodbye! Take care 👋"
                );
            }

            key = "goodbyeMessage";
            settingValue = value;
        }

        // UNKNOWN COMMAND
        else {
            return reply(
                "❌ නොදන්නා Setting එකක්.\n\n" +
                "සියලු Settings සඳහා:\n" +
                ".setting"
            );
        }

        // SAVE SETTING
        await updateBotSettings(botNumber, key, settingValue);

        let displayValue = String(settingValue);

        if (key === "workMode") {
            const names = {
                public: "Public — Everyone",
                private: "Private — Owner Only",
                groups: "Groups Only",
                inbox: "Inbox Only"
            };

            displayValue = names[settingValue];
        } else if (key === "presence") {
            const names = {
                off: "Off",
                typing: "Always Typing",
                recording: "Always Recording"
            };

            displayValue = names[settingValue];
        } else if (key === "antiViewRoute" || key === "antiDeleteRoute") {
            displayValue = settingValue === "me"
                ? "Bot Owner Inbox"
                : "Same Chat";
        } else if (key === "statusSeen") {
            displayValue = settingValue ? "ON ✅" : "OFF ❌";
        } else if (key === "statusReact") {
            displayValue = settingValue === "off"
                ? "OFF ❌"
                : settingValue;
        } else if (
            key === "welcomeEnabled" ||
            key === "goodbyeEnabled"
        ) {
            displayValue = settingValue ? "ON ✅" : "OFF ❌";
        }

        return reply(
            "╭━━〔 ✅ SETTING UPDATED 〕━━╮\n" +
            "┃\n" +
            `┃ ⚙️ Setting: ${key}\n` +
            `┃ 📌 Value: ${displayValue}\n` +
            "┃\n" +
            "╰━━━━━━━━━━━━━━━━━━╯"
        );

    } catch (error) {
        console.error("[SETTING ERROR]", error);

        return reply(
            "❌ Setting එක Save කිරීමේදී දෝෂයක් ඇතිවුණා.\n" +
            "lib/settingsHelper.js එක පරීක්ෂා කරන්න."
        );
    }
}

};
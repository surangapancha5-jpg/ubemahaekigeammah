const fs = require("fs");
const path = require("path");
const axios = require("axios");

const ROUND_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793441049/zanta_media_uploads/md84nwujtycksl682hzj.mp4";

const GIFT_VIDEO =
    "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4";

let roundCache = null;
let giftCache = null;

async function downloadVideo(url) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 60000
    });

    return Buffer.from(response.data);
}

async function getRoundVideo() {
    if (!roundCache) {
        roundCache = await downloadVideo(ROUND_VIDEO);
    }

    return roundCache;
}

async function getGiftVideo() {
    if (!giftCache) {
        giftCache = await downloadVideo(GIFT_VIDEO);
    }

    return giftCache;
}

// LIVE COMMAND SCANNER
function getCommands() {
    const commands = [];
    const commandsDir = __dirname;

    const files = fs.readdirSync(commandsDir)
        .filter(file =>
            file.endsWith(".js") &&
            file !== "menu.js"
        );

    for (const file of files) {
        try {
            const filePath = path.join(commandsDir, file);

            delete require.cache[require.resolve(filePath)];

            const command = require(filePath);

            if (!command || !command.name) continue;

            commands.push({
                name: command.name,
                alias: Array.isArray(command.alias)
                    ? command.alias
                    : [],
                category: String(command.category || "other").toLowerCase()
            });

        } catch (error) {
            console.error(
                `[MENU SCAN ERROR] ${file}:`,
                error.message
            );
        }
    }

    return commands.sort((a, b) =>
        a.name.localeCompare(b.name)
    );
}

// COMMAND FORMAT - NO EMPTY LINES
function formatCommands(commands) {
    if (!commands.length) {
        return "┃◈┃⛩️ Commands නැත.\n";
    }

    return commands.map(cmd => {
        const aliases = cmd.alias.length
            ? ` (${cmd.alias.join(", ")})`
            : "";

        return `┃◈┃⛩️ .${cmd.name}${aliases}`;
    }).join("\n") + "\n";
}

module.exports = {
    name: "menu",
    alias: ["help", "allmenu"],
    desc: "ZANTA-XMD All Commands Menu",
    category: "main",
    use: ".menu",

    async execute(sock, msg, args, from, { reply }) {
        try {
            const userName = msg.pushName || "User";

            // LIVE SCAN
            const allCommands = getCommands();

            // MAIN COMMANDS
            const mainCommands = allCommands.filter(cmd =>
                [
                    "main",
                    "general",
                    "download",
                    "group",
                    "media"
                ].includes(cmd.category)
            );

            // SETTINGS COMMANDS
            const settingsCommands = allCommands.filter(cmd =>
                [
                    "settings",
                    "setting"
                ].includes(cmd.category)
            );

            // OTHER CATEGORIES
            const otherCategories = {};

            for (const cmd of allCommands) {
                if (
                    ![
                        "main",
                        "general",
                        "download",
                        "group",
                        "media",
                        "settings",
                        "setting"
                    ].includes(cmd.category)
                ) {
                    if (!otherCategories[cmd.category]) {
                        otherCategories[cmd.category] = [];
                    }

                    otherCategories[cmd.category].push(cmd);
                }
            }

            // MENU TEXT
            let menuText =
`╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *🤠 𝐇𝐞𝐥𝐥𝐨: ${userName}*
┃◈┃• *🪪 𝐕𝐞𝐫𝐬𝐢𝐨𝐧*: *1.0*
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *𝐁𝐎𝐓 𝐀𝐋𝐋 𝐌𝐄𝐍𝐔* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃
┃◈┃    𝐌 𝐀 𝐈 𝐍   𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒
${formatCommands(mainCommands)}┃◈┃   𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒
${formatCommands(settingsCommands)}`;

            // OTHER CATEGORIES
            for (const category of Object.keys(otherCategories).sort()) {
                menuText +=
`
┃◈┃   𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐘: ${category.toUpperCase()}
${formatCommands(otherCategories[category])}`;
            }

            menuText +=
`┃◈└───────────┈⊷
╰──────────────┈⊷
> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`;

            // SEND ROUND VIDEO FIRST
            const roundVideo = await getRoundVideo();

            await sock.sendMessage(
                from,
                {
                    video: roundVideo,
                    mimetype: "video/mp4",
                    ptv: true
                },
                {
                    quoted: msg
                }
            );

            // SEND GIFT VIDEO WITH MENU
            const giftVideo = await getGiftVideo();

            await sock.sendMessage(
                from,
                {
                    video: giftVideo,
                    mimetype: "video/mp4",
                    gifPlayback: true,
                    caption: menuText
                },
                {
                    quoted: msg
                }
            );

        } catch (error) {
            console.error("[MENU ERROR]", error);

            await reply(
                "❌ MENU ERROR!\n\n" +
                "Menu එක යැවීමට නොහැකි වුණා.\n" +
                "Error: " + error.message
            );
        }
    }
};
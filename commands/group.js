const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "group-settings.json");

function loadData() {
try {
return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
return {};
}
}

function saveData(data) {
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getSettings(groupJid) {
const data = loadData();
return data[groupJid] || {};
}

function updateSettings(groupJid, key, value) {
const data = loadData();
if (!data[groupJid]) data[groupJid] = {};
data[groupJid][key] = value;
saveData(data);
}

function getContext(msg) {
const m = msg.message || {};
const content = m.extendedTextMessage || {};
return content.contextInfo || {};
}

function getTarget(msg, args) {
const context = getContext(msg);
const mentioned = context.mentionedJid || [];
if (mentioned.length) return mentioned[0];
if (context.participant) return context.participant;

const number = (args[0] || "").replace(/\D/g, "");
if (number.length >= 7) return number + "@s.whatsapp.net";
return null;

}

module.exports = {
name: "group",
alias: ["grouphelp"],
desc: "ZANTA-XMD MINI Group Commands",
category: "group",

async execute(sock, msg, args, from, { reply, isOwner }) {
    try {
        if (!from || !from.endsWith("@g.us")) {
            return reply("❌ මේ command එක Group එකක් තුළ භාවිත කරන්න.");
        }

        const command = (args[0] || "help").toLowerCase();
        const rest = args.slice(1);
        const metadata = await sock.groupMetadata(from);
        const sender = msg.key.participant || msg.key.remoteJid;
        const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";

        const admins = metadata.participants
            .filter(p => p.admin)
            .map(p => p.id);

        const isAdmin = admins.some(jid => jid.split(":")[0] === sender.split(":")[0]);
        const botAdmin = admins.some(jid => jid.split(":")[0] === botJid.split(":")[0]);

        const adminCommands = [
            "antilink", "antibadword", "welcome", "goodbye",
            "kick", "add", "promote", "demote", "open", "close",
            "setname", "setdesc", "revoke", "delete", "warn",
            "resetwarn", "setwelcome", "setgoodbye", "antispam",
            "approve", "reject", "grouppic"
        ];

        if (adminCommands.includes(command) && !isAdmin && !isOwner) {
            return reply("❌ මේ command එක භාවිත කරන්න Group Admin විය යුතුයි.");
        }

        if (["kick", "add", "promote", "demote", "open", "close",
            "setname", "setdesc", "revoke", "grouppic"].includes(command) && !botAdmin) {
            return reply("❌ Bot එක Group Admin කරලා නැහැ.");
        }

        const settings = getSettings(from);

        switch (command) {
            case "help":
                return reply(
                    "╭━━〔 ZANTA-XMD MINI 〕━━╮\n" +
                    "│ GROUP COMMANDS\n" +
                    "├──────────────────\n" +
                    "│ .group antilink on/off\n" +
                    "│ .group antibadword on/off\n" +
                    "│ .group welcome on/off\n" +
                    "│ .group goodbye on/off\n" +
                    "│ .group kick @user\n" +
                    "│ .group add 947XXXXXXXX\n" +
                    "│ .group promote @user\n" +
                    "│ .group demote @user\n" +
                    "│ .group tagall\n" +
                    "│ .group hidetag <text>\n" +
                    "│ .group groupinfo\n" +
                    "│ .group admins\n" +
                    "│ .group members\n" +
                    "│ .group open\n" +
                    "│ .group close\n" +
                    "│ .group mute\n" +
                    "│ .group unmute\n" +
                    "│ .group setname <name>\n" +
                    "│ .group setdesc <description>\n" +
                    "│ .group getlink\n" +
                    "│ .group revoke\n" +
                    "│ .group link\n" +
                    "│ .group delete\n" +
                    "│ .group warn @user\n" +
                    "│ .group warnings @user\n" +
                    "│ .group resetwarn @user\n" +
                    "│ .group antilinkmode delete/kick\n" +
                    "│ .group everyone\n" +
                    "│ .group staff\n" +
                    "│ .group poll <question>\n" +
                    "│ .group revokeall\n" +
                    "│ .group groupname\n" +
                    "│ .group setwelcome <text>\n" +
                    "│ .group setgoodbye <text>\n" +
                    "│ .group antispam on/off\n" +
                    "│ .group approve @user\n" +
                    "│ .group reject @user\n" +
                    "╰━━━━━━━━━━━━━━━━━━╯"
                );

            case "antilink":
            case "antibadword":
            case "welcome":
            case "goodbye":
            case "antispam": {
                const value = (rest[0] || "").toLowerCase();
                if (!["on", "off"].includes(value)) {
                    return reply(`භාවිතය: .group ${command} on/off`);
                }
                updateSettings(from, command, value === "on");
                return reply(`✅ ${command}: ${value.toUpperCase()}`);
            }

            case "antilinkmode": {
                const mode = (rest[0] || "").toLowerCase();
                if (!["delete", "kick"].includes(mode)) {
                    return reply("භාවිතය: .group antilinkmode delete/kick");
                }
                updateSettings(from, "antilinkmode", mode);
                return reply(`✅ Anti-link mode: ${mode}`);
            }

            case "groupinfo":
                return reply(
                    `📛 Name: ${metadata.subject}\n` +
                    `👥 Members: ${metadata.participants.length}\n` +
                    `🆔 JID: ${from}\n` +
                    `📝 Description: ${metadata.desc || "Not set"}`
                );

            case "admins":
                return reply("👑 GROUP ADMINS\n\n" + admins.map((j, i) => `${i + 1}. @${j.split("@")[0]}`).join("\n"), {
                    mentions: admins
                });

            case "members": {
                const members = metadata.participants.map(p => p.id);
                return reply(
                    "👥 GROUP MEMBERS\n\n" +
                    members.map((j, i) => `${i + 1}. @${j.split("@")[0]}`).join("\n"),
                    { mentions: members }
                );
            }

            case "tagall":
            case "everyone":
            case "hidetag": {
                const members = metadata.participants.map(p => p.id);
                const text = rest.join(" ") || "📢 Attention everyone!";
                return sock.sendMessage(from, {
                    text: `📢 ${text}\n\n` + members.map(j => `@${j.split("@")[0]}`).join(" "),
                    mentions: members
                }, { quoted: msg });
            }

            case "staff":
                return reply("👑 STAFF\n\n" + admins.map(j => `@${j.split("@")[0]}`).join("\n"), {
                    mentions: admins
                });

            case "open":
                await sock.groupSettingUpdate(from, "not_announcement");
                return reply("✅ Group එක හැමෝටම විවෘත කළා.");

            case "close":
                await sock.groupSettingUpdate(from, "announcement");
                return reply("🔒 Group එක Admins Only කළා.");

            case "mute":
                await sock.groupSettingUpdate(from, "announcement");
                return reply("🔇 Group එක mute කළා.");

            case "unmute":
                await sock.groupSettingUpdate(from, "not_announcement");
                return reply("🔊 Group එක නැවත විවෘත කළා.");

            case "setname": {
                const name = rest.join(" ").trim();
                if (!name) return reply("භාවිතය: .group setname <name>");
                await sock.groupUpdateSubject(from, name);
                return reply("✅ Group නම වෙනස් කළා.");
            }

            case "groupname":
                return reply(`📛 Group Name: ${metadata.subject}`);

            case "setdesc": {
                const desc = rest.join(" ").trim();
                if (!desc) return reply("භාවිතය: .group setdesc <description>");
                await sock.groupUpdateDescription(from, desc);
                return reply("✅ Group description වෙනස් කළා.");
            }

            case "getlink":
            case "link": {
                const code = await sock.groupInviteCode(from);
                return reply(`🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`);
            }

            case "revoke":
            case "revokeall":
            case "resetlink": {
                const code = await sock.groupRevokeInvite(from);
                return reply(`✅ New Group Link:\nhttps://chat.whatsapp.com/${code}`);
            }

            case "kick":
            case "promote":
            case "demote": {
                const target = getTarget(msg, rest);
                if (!target) {
                    return reply(`භාවිතය: .group ${command} @user (හෝ number එකක්)`);
                }

                const action = command === "kick" ? "remove" : command;
                await sock.groupParticipantsUpdate(from, [target], action);
                return reply(`✅ ${command} සාර්ථකයි: @${target.split("@")[0]}`, {
                    mentions: [target]
                });
            }

            case "add": {
                const target = getTarget(msg, rest);
                if (!target) return reply("භාවිතය: .group add 947XXXXXXXX");
                await sock.groupParticipantsUpdate(from, [target], "add");
                return reply("✅ Add request එක යැව්වා. WhatsApp විසින් invite එකක් අවශ්‍ය කළ හැක.");
            }

            case "delete": {
                const key = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;
                if (!key) return reply("❌ Delete කරන්න Bot message එකකට reply කරන්න.");
                await sock.sendMessage(from, {
                    delete: {
                        remoteJid: from,
                        fromMe: participant === botJid,
                        id: key,
                        participant
                    }
                });
                return;
            }

            case "setwelcome":
            case "setgoodbye": {
                const text = rest.join(" ").trim();
                if (!text) return reply(`භාවිතය: .group ${command} <text>`);
                updateSettings(from, command, text);
                return reply(`✅ ${command} message එක save කළා.`);
            }

            case "warn":
            case "warnings":
            case "resetwarn": {
                const target = getTarget(msg, rest);
                if (!target) return reply(`භාවිතය: .group ${command} @user`);

                const data = loadData();
                if (!data[from]) data[from] = {};
                if (!data[from].warnings) data[from].warnings = {};

                const current = data[from].warnings[target] || 0;

                if (command === "warn") {
                    data[from].warnings[target] = current + 1;
                    saveData(data);
                    return reply(`⚠️ @${target.split("@")[0]} ට Warning ${current + 1}ක්.`, {
                        mentions: [target]
                    });
                }

                if (command === "resetwarn") {
                    delete data[from].warnings[target];
                    saveData(data);
                    return reply("✅ Warnings reset කළා.");
                }

                return reply(`⚠️ @${target.split("@")[0]} Warnings: ${current}`, {
                    mentions: [target]
                });
            }

            case "poll": {
                const question = rest.join(" ").trim();
                if (!question) return reply("භාවිතය: .group poll <question>");
                await sock.sendMessage(from, {
                    poll: {
                        name: question,
                        values: ["👍 Yes", "👎 No"],
                        selectableCount: 1
                    }
                });
                return;
            }

            case "approve":
            case "reject": {
                const target = getTarget(msg, rest);
                if (!target) return reply(`භාවිතය: .group ${command} @user`);
                await sock.groupRequestParticipantsUpdate(
                    from,
                    [target],
                    command === "approve" ? "approve" : "reject"
                );
                return reply(`✅ ${command} request එක සම්පූර්ණයි.`);
            }

            case "grouppic":
                return reply("ℹ️ භාවිතය: Group picture එකට image එකක් reply කරලා command එක යවන්න. ඔබේ bot handler එකට image download support එක එක් කළ යුතුයි.");

            default:
                return reply("❌ Command එක හඳුනාගත නොහැක. .group help භාවිත කරන්න.");
        }
    } catch (error) {
        console.error("GROUP COMMAND ERROR:", error);
        return reply("❌ Command එක ක්‍රියාත්මක කළ නොහැකි වුණා. Bot permissions සහ command format පරීක්ෂා කරන්න.");
    }
}

};
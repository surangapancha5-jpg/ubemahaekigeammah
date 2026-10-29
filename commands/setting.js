const { updateBotSettings } = require("../lib/settingsHelper");
const bool = (v) => ["on", "yes", "true", "1", "enable", "enabled"].includes(String(v || "").toLowerCase());
const HELP = (s = {}) => `╭━━〔 ⚙️ ZANTA-XMD SETTINGS 〕━━╮
┃
┃ 📝 BOT
┃ .setname <name>
┃ .setlogo <image URL>
┃ .setprefix <symbol>
┃ .setmode public/private/groups/inbox
┃ .setpresence off/typing/recording
┃
┃ 👁 STATUS / PRIVACY
┃ .setstatusseen on/off
┃ .setstatusreact <emoji/off>
┃ .setantiview me/from
┃ .setantidelete me/from
┃
┃ 👋 GROUP MESSAGES
┃ .setwelcome on/off
┃ .setwelcomemsg <message>
┃ .setgoodbye on/off
┃ .setgoodbyemsg <message>
┃
┃ 🔗 GROUP SECURITY
┃ .antilink on/off
┃ .kick @user
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

📌 CURRENT SETTINGS
Name: ${s.botName || "ZANTA-XMD"}
Prefix: ${s.prefix || "."}
Mode: ${s.workMode || "public"}
Presence: ${s.presence || "off"}
Status seen: ${s.statusSeen ? "on" : "off"}
Status react: ${s.statusReact || "off"}
Anti-view: ${s.antiViewRoute || "me"}
Anti-delete: ${s.antiDeleteRoute || "me"}
Welcome: ${s.welcomeEnabled ? "on" : "off"}
Goodbye: ${s.goodbyeEnabled ? "on" : "off"}

Placeholders: @user, @group`;
async function apply(key, value, currentBotNumber) {
  if (!currentBotNumber) throw new Error("Bot number එක හඳුනාගන්න බැහැ.");
  if (!value) throw new Error("Value එක දෙන්න.");
  const v = value.trim(); const low = v.toLowerCase(); const updates = {};
  switch (key) {
    case "name": if (v.length > 40) throw new Error("Bot name එක අකුරු 40ට අඩු විය යුතුයි."); updates.botName = v; break;
    case "logo": if (!/^https?:\/\//i.test(v)) throw new Error("Logo එකට http:// හෝ https:// URL එකක් දෙන්න."); updates.botLogo = v; break;
    case "prefix": if (v.length > 3 || /\s/.test(v)) throw new Error("Prefix එක space නැති අකුරු 1–3ක් විය යුතුයි."); updates.prefix = v; break;
    case "mode": if (!["public","private","groups","inbox"].includes(low)) throw new Error("Mode: public/private/groups/inbox"); updates.workMode = low; break;
    case "presence": if (!["off","typing","recording"].includes(low)) throw new Error("Presence: off/typing/recording"); updates.presence = low; break;
    case "statusseen": if (!["on","off","yes","no","true","false","1","0","enable","disable","enabled","disabled"].includes(low)) throw new Error("on/off භාවිතා කරන්න."); updates.statusSeen = bool(v); break;
    case "statusreact": updates.statusReact = ["off","none"].includes(low) ? "off" : v.slice(0,12); break;
    case "antiview": if (!["me","from"].includes(low)) throw new Error("Anti-view: me/from"); updates.antiViewRoute = low; break;
    case "antidelete": if (!["me","from"].includes(low)) throw new Error("Anti-delete: me/from"); updates.antiDeleteRoute = low; break;
    case "welcome": if (!["on","off"].includes(low)) throw new Error(".setwelcome on/off භාවිතා කරන්න."); updates.welcomeEnabled = low === "on"; break;
    case "goodbye": if (!["on","off"].includes(low)) throw new Error(".setgoodbye on/off භාවිතා කරන්න."); updates.goodbyeEnabled = low === "on"; break;
    case "welcomemsg": if (v.length > 1000) throw new Error("Message එක අකුරු 1000ට අඩු කරන්න."); updates.welcomeMessage = v; break;
    case "goodbyemsg": if (v.length > 1000) throw new Error("Message එක අකුරු 1000ට අඩු කරන්න."); updates.goodbyeMessage = v; break;
    default: throw new Error("නොදන්නා setting එකක්. .setting ලෙස යවා help බලන්න.");
  }
  await updateBotSettings(currentBotNumber, updates);
  return updates;
}
module.exports = {
  name: "setting", alias: ["settings", "config", "set"], category: "owner", desc: "All bot settings",
  async execute(sock, msg, args, from, ctx = {}) {
    const { reply = async t => sock.sendMessage(from,{text:String(t)},{quoted:msg}), isOwner, isDev, currentBotNumber, settings = {} } = ctx;
    if (!(isOwner || isDev)) return reply("⛔ මේ command එක Bot Owner/Developer ට පමණයි.");
    if (!args[0] || ["help","menu"].includes(String(args[0]).toLowerCase())) return reply(HELP(settings));
    try { await apply(String(args[0]).toLowerCase(), args.slice(1).join(" "), currentBotNumber); return reply(`✅ Setting update වුණා!\n⚙️ ${args[0]}: ${args.slice(1).join(" ")}`); }
    catch (e) { return reply(`❌ ${e.message}`); }
  }
};
module.exports.HELP = HELP;
module.exports.apply = apply;

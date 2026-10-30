const { updateBotSettings } = require("../lib/settingsHelper");

const bool = (v) => ["on", "yes", "true", "1", "enable", "enabled"].includes(String(v || "").toLowerCase());

module.exports = {
  name: "setting",
  alias: [
    "settings", "config", 
    "setname", "setlogo", "setprefix", "setmode", "setpresence",
    "setstatusseen", "setstatusreact", "setantiview", "setantidelete",
    "setwelcome", "setgoodbye", "setwelcomemsg", "setgoodbyemsg"
  ],
  category: "owner",
  desc: "Configure bot settings",

  async execute(sock, msg, args, from, ctx = {}) {
    const {
      reply = async (t) => sock.sendMessage(from, { text: String(t) }, { quoted: msg }),
      isOwner, isDev, currentBotNumber, settings = {}, command
    } = ctx;

    if (!(isOwner || isDev)) return reply("⛔ මේ command එක Bot Owner/Developer ට පමණයි.");
    if (!currentBotNumber) return reply("❌ Bot number එක හඳුනාගන්න බැහැ.");

    // command එක මොකක්ද කියලා හොයනවා .setname ද .setting ද කියලා
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const usedCmd = (command || body.trim().split(/\s+/)[0].replace(/^[.\/!]/, "") || "setting").toLowerCase();

    const menuText = `╭───〔 ⚙️ ZANTA-XMD SETTINGS 〕───╮
│
│ .setting - Settings Menu
│
│ 📝 BOT SETTINGS
│ .setname <නම>
│ .setlogo <image URL>
│ .setprefix <symbol>
│ .setmode public/private/groups/inbox
│ .setpresence off/typing/recording
│
│ 👁 STATUS SETTINGS
│ .setstatusseen on/off
│ .setstatusreact <emoji/off>
│
│ 🔐 MESSAGE SETTINGS
│ .setantiview me/from
│ .setantidelete me/from
│
│ 👋 WELCOME SETTINGS
│ .setwelcome on/off
│ .setwelcomemsg <message>
│ .setgoodbye on/off
│ .setgoodbyemsg <message>
╰─────────────────────────────╯

📌 CURRENT SETTINGS
Name: ${settings.botName || "ZANTA-XMD"}
Prefix: ${settings.prefix || "."}
Work mode: ${settings.workMode || "public"}
Presence: ${settings.presence || "off"}
Status seen: ${settings.statusSeen ? "on" : "off"}
Status react: ${settings.statusReact || "off"}
Anti-view: ${settings.antiViewRoute || "me"}
Anti-delete: ${settings.antiDeleteRoute || "me"}
Welcome: ${settings.welcomeEnabled ? "on" : "off"}
Goodbye: ${settings.goodbyeEnabled ? "on" : "off"}`;

    // .setting විතරක් ගැහුවම menu එක logo එකත් එක්ක යවනවා
    if (usedCmd === "setting" || usedCmd === "settings" || usedCmd === "config") {
      if (args.length === 0) {
        try {
          if (settings.botLogo && /^https?:\/\//i.test(settings.botLogo)) {
            return await sock.sendMessage(from, { image: { url: settings.botLogo }, caption: menuText }, { quoted: msg });
          }
          return await reply(menuText);
        } catch { return await reply(menuText); }
      }
    }

    let value = args.join(" ").trim();
    if (!value) return reply(`❌ Value එක දෙන්න.\nඋදා: .${usedCmd} on`);

    const updates = {};
    let displayKey = usedCmd;

    switch (usedCmd) {
      case "setname":
        if (value.length > 40) return reply("❌ Bot name එක අකුරු 40ට අඩු විය යුතුයි.");
        updates.botName = value; displayKey = "name"; break;
      case "setlogo":
        if (!/^https?:\/\//i.test(value)) return reply("❌ Logo එකට http:// හෝ https:// URL එකක් දෙන්න.");
        updates.botLogo = value; displayKey = "logo"; break;
      case "setprefix":
        if (value.length > 3 || /\s/.test(value)) return reply("❌ Prefix එක space නැති අකුරු 1–3ක් විය යුතුයි.");
        updates.prefix = value; break;
      case "setmode":
        if (!["public", "private", "groups", "inbox"].includes(value.toLowerCase())) return reply("❌ Work mode: public / private / groups / inbox");
        updates.workMode = value.toLowerCase(); break;
      case "setpresence":
        if (!["off", "typing", "recording"].includes(value.toLowerCase())) return reply("❌ Presence: off / typing / recording");
        updates.presence = value.toLowerCase(); break;
      case "setstatusseen":
        updates.statusSeen = bool(value); break;
      case "setstatusreact":
        updates.statusReact = ["off", "none"].includes(value.toLowerCase()) ? "off" : value.slice(0, 12); break;
      case "setantiview":
        if (!["me", "from"].includes(value.toLowerCase())) return reply("❌ Anti-view route: me / from");
        updates.antiViewRoute = value.toLowerCase(); break;
      case "setantidelete":
        if (!["me", "from"].includes(value.toLowerCase())) return reply("❌ Anti-delete route: me / from");
        updates.antiDeleteRoute = value.toLowerCase(); break;
      case "setwelcome":
        if (!["on", "off"].includes(value.toLowerCase())) return reply("❌ භාවිතා කරන්න: .setwelcome on/off");
        updates.welcomeEnabled = value.toLowerCase() === "on"; break;
      case "setgoodbye":
        if (!["on", "off"].includes(value.toLowerCase())) return reply("❌ භාවිතා කරන්න: .setgoodbye on/off");
        updates.goodbyeEnabled = value.toLowerCase() === "on"; break;
      case "setwelcomemsg":
        if (value.length > 1000) return reply("❌ Welcome message එක අකුරු 1000ට අඩු කරන්න.");
        updates.welcomeMessage = value; break;
      case "setgoodbyemsg":
        if (value.length > 1000) return reply("❌ Goodbye message එක අකුරු 1000ට අඩු කරන්න.");
        updates.goodbyeMessage = value; break;
      default: // .setting name ZANTA වගේ පරණ විදිහට ගැහුවොත්
        return reply(menuText);
    }

    try {
      await updateBotSettings(currentBotNumber, updates);
      return reply(`✅ *SETTING UPDATED!*\n\n⚙️ Setting: ${displayKey}\n📝 Value: ${value}\n\n💾 MongoDB එකට save කළා.`);
    } catch (err) {
      console.error("SETTING UPDATE ERROR:", err);
      return reply("❌ Settings save කරන්න බැරි වුණා.\nMongoDB connection එක පරීක්ෂා කරන්න.");
    }
  }
};
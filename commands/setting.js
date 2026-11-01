const mongoose = require("mongoose");
const { updateBotSettings } = require("../lib/settingsHelper");
const MetaSchema = new mongoose.Schema({ key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed });
const BotMeta = mongoose.models.ZantaMeta || mongoose.model("ZantaMeta", MetaSchema, "darkdinumetas");
const cleanNum = (v) => String(v || "").replace(/[^0-9]/g, "");

async function getMeta(key, fallback) {
  const row = await BotMeta.findOne({ key }).lean();
  return row ? row.value : fallback;
}
async function setMeta(key, value) {
  await BotMeta.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, new: true });
}

const boolFeatures = new Set([
  "autoRead", "autoReact", "autoReply", "antiCall", "antiLink", "antiBadword",
  "antiSpam", "antiTag", "antiForward", "antiMedia", "antiAudio", "antiSticker",
  "antiDocument", "antiDelete", "antiViewOnce", "commandLog"
]);
const menuItems = [
  ["1", "Auto Read", ".autoread on/off"], ["2", "Auto React", ".autoreact on/off"],
  ["3", "React Emoji", ".reactemoji ❤️"], ["4", "Auto Reply", ".autoreply on/off"],
  ["5", "Reply Trigger", ".replytrigger hello"], ["6", "Reply Text", ".replytext Hi there!"],
  ["7", "Anti Call", ".anticall on/off"], ["8", "Anti Link", ".antilink on/off"],
  ["9", "Link Action", ".linkaction delete/warn"], ["10", "Anti Badword", ".antibadword on/off"],
  ["11", "Bad Words", ".badwords word1,word2"], ["12", "Anti Spam", ".antispam on/off"],
  ["13", "Spam Limit", ".spamlimit 5"], ["14", "Anti Tag", ".antitag on/off"],
  ["15", "Anti Forward", ".antiforward on/off"], ["16", "Anti Media", ".antimedia on/off"],
  ["17", "Anti Audio", ".antiaudio on/off"], ["18", "Anti Sticker", ".antisticker on/off"],
  ["19", "Anti Document", ".antidocument on/off"], ["20", "Anti Delete", ".antidelete on/off"],
  ["21", "Anti ViewOnce", ".antiviewonce on/off"], ["22", "Status Views", ".statusviews on/off"],
  ["23", "Status React", ".statusreact ❤️/off"], ["24", "Welcome", ".welcome on/off"],
  ["25", "Goodbye", ".goodbye on/off"], ["26", "Welcome Message", ".welcomemsg text"],
  ["27", "Goodbye Message", ".goodbyemsg text"], ["28", "Presence", ".setpresence typing/recording/off"],
  ["29", "Work Mode", ".workmode public/private/groups/inbox"], ["30", "Command Log", ".commandlog on/off"]
];

module.exports = {
  name: "setting",
  alias: ["settings", "setmenu", "settingmenu", "setname", "setlogo", "setprefix", "setpresence",
    "public", "private", "group", "groups", "inbox", "workmode", "mode", "setmode", "presence", "welcome", "welcomemsg", "goodbye",
    "goodbyemsg", "status", "statusviews", "statusreact", "autoread", "autoreact", "reactemoji",
    "autoreply", "replytrigger", "replytext", "anticall", "antilink", "linkaction", "antibadword",
    "badwords", "antispam", "spamlimit", "antitag", "antiforward", "antimedia", "antiaudio",
    "antisticker", "antidocument", "antidelete", "antiviewonce", "commandlog"],
  desc: "ZANTA-XMD 30 Settings Manager",
  category: "settings",
  use: ".setting",

  async execute(sock, msg, args, from, ctx = {}) {
    const { reply = async (t) => sock.sendMessage(from, { text: String(t) }), settings = {},
      isOwner = false, currentBotNumber = "", body = "", prefix = "." } = ctx;
    if (!isOwner) return reply("❌ මෙම Settings වෙනස් කළ හැක්කේ Bot Owner ට පමණයි.");

    const raw = String(body || "").trim();
    const words = raw.split(/\s+/);
    const invoked = (words[0] || "").replace(/^[.!#/*,]+/, "").toLowerCase();
    const rootNames = ["setting", "settings", "setmenu", "settingmenu"];
    const sub = rootNames.includes(invoked) ? (words[1] || "").toLowerCase() : invoked;
    const value = rootNames.includes(invoked) ? words.slice(2).join(" ") : words.slice(1).join(" ");
    const number = cleanNum(currentBotNumber);
    if (!number) return reply("❌ Bot number එක හඳුනාගත නොහැක.");
    const featureKey = `features_${number}`;
    const features = await getMeta(featureKey, {}) || {};
    const saveFeature = async (key, val) => {
      features[key] = val;
      await setMeta(featureKey, features);
    };
    const boolValue = value.toLowerCase();
    const onOff = ["on", "off", "true", "false", "1", "0"].includes(boolValue)
      ? ["on", "true", "1"].includes(boolValue) : null;

    if (!sub || rootNames.includes(sub) || sub === "help") {
      const lines = menuItems.map(([n, title, usage]) => `┃ ${n.padStart(2, "0")}. ${title}\n┃     ${usage}`).join("\n");
      return sock.sendMessage(from, { text: `╭━━〔 ⚙️ ${settings.botName || "ZANTA-XMD"} SETTINGS 〕━━╮\n${lines}\n╰━━━━━━━━━━━━━━━━━━━━╯\nPrefix: ${settings.prefix || prefix || "."} | Mode: ${(settings.workMode || "public").toUpperCase()}` }, { quoted: msg });
    }

    if (sub === "setname") {
      if (!value) return reply("භාවිතය: .setname ZANTA-XMD");
      await updateBotSettings(number, { botName: value.slice(0, 40) });
      return reply("✅ Bot Name යාවත්කාලීන කළා.");
    }
    if (sub === "setlogo") {
      if (!/^https?:\/\/\S+/i.test(value)) return reply("භාවිතය: .setlogo https://example.com/logo.jpg");
      await updateBotSettings(number, { botLogo: value });
      return reply("✅ Bot Logo යාවත්කාලීන කළා.");
    }
    if (sub === "setprefix") {
      if (!value || value.length > 3 || /\s/.test(value)) return reply("භාවිතය: .setprefix !");
      await updateBotSettings(number, { prefix: value });
      return reply(`✅ Prefix: ${value}`);
    }
    if (["public", "private", "group", "groups", "inbox", "workmode"].includes(sub)) {
      const mode = sub === "workmode" ? value.toLowerCase() : (sub === "group" ? "groups" : sub);
      if (!["public", "private", "groups", "inbox"].includes(mode)) return reply("භාවිතය: .workmode public/private/groups/inbox");
      await updateBotSettings(number, { workMode: mode });
      return reply(`✅ Work Mode: ${mode.toUpperCase()}`);
    }
    if (sub === "status") {
      const current = await getMeta(featureKey, {}) || {};
      const enabled = (key) => current[key] ? "ON" : "OFF";
      return reply(`╭━━〔 ⚙️ SETTINGS STATUS 〕━━╮\n┃ Auto Read: ${enabled("autoRead")}\n┃ Auto React: ${enabled("autoReact")}\n┃ Auto Reply: ${enabled("autoReply")}\n┃ Anti Call: ${enabled("antiCall")}\n┃ Anti Link: ${enabled("antiLink")}\n┃ Anti Badword: ${enabled("antiBadword")}\n┃ Anti Spam: ${enabled("antiSpam")}\n┃ Anti Tag: ${enabled("antiTag")}\n┃ Anti Forward: ${enabled("antiForward")}\n┃ Anti Media: ${enabled("antiMedia")}\n┃ Anti Audio: ${enabled("antiAudio")}\n┃ Anti Sticker: ${enabled("antiSticker")}\n┃ Anti Document: ${enabled("antiDocument")}\n┃ Anti Delete: ${enabled("antiDelete")}\n┃ Anti ViewOnce: ${enabled("antiViewOnce")}\n┃ Command Log: ${enabled("commandLog")}\n╰━━━━━━━━━━━━━━━━━━━━╯`);
    }
    if (["workmode", "mode", "setmode"].includes(sub)) {
      const mode = value.toLowerCase();
      if (!["public", "private", "groups", "inbox"].includes(mode)) return reply("භාවිතය: .workmode public/private/groups/inbox");
      await updateBotSettings(number, { workMode: mode });
      return reply(`✅ Work Mode: ${mode.toUpperCase()}`);
    }
    if (sub === "setpresence" || sub === "presence") {
      const v = value.toLowerCase();
      if (!["typing", "recording", "off"].includes(v)) return reply("භාවිතය: .setpresence typing/recording/off");
      await updateBotSettings(number, { presence: v });
      return reply(`✅ Presence: ${v.toUpperCase()}`);
    }
    if (["welcome", "goodbye"].includes(sub)) {
      if (onOff === null) return reply(`භාවිතය: .${sub} on/off`);
      await updateBotSettings(number, { [sub === "welcome" ? "welcomeEnabled" : "goodbyeEnabled"]: onOff });
      return reply(`✅ ${sub.toUpperCase()}: ${onOff ? "ON" : "OFF"}`);
    }
    if (["welcomemsg", "goodbyemsg"].includes(sub)) {
      if (!value) return reply(`භාවිතය: .${sub} Your message (@user, @group)`);
      await updateBotSettings(number, { [sub === "welcomemsg" ? "welcomeMessage" : "goodbyeMessage"]: value.slice(0, 3500) });
      return reply(`✅ ${sub} යාවත්කාලීන කළා.`);
    }
    if (sub === "statusviews") {
      if (onOff === null) return reply("භාවිතය: .statusviews on/off");
      await updateBotSettings(number, { statusSeen: onOff });
      return reply(`✅ Status Views: ${onOff ? "ON" : "OFF"}`);
    }
    if (sub === "statusreact") {
      if (!value) return reply("භාවිතය: .statusreact ❤️/off");
      await updateBotSettings(number, { statusReact: value.toLowerCase() === "off" ? "off" : value.slice(0, 12) });
      return reply(`✅ Status React: ${value}`);
    }

    const featureMap = {
      autoread: "autoRead", autoreact: "autoReact", autoreply: "autoReply", anticall: "antiCall",
      antilink: "antiLink", antibadword: "antiBadword", antispam: "antiSpam", antitag: "antiTag",
      antiforward: "antiForward", antimedia: "antiMedia", antiaudio: "antiAudio", antisticker: "antiSticker",
      antidocument: "antiDocument", antidelete: "antiDelete", antiviewonce: "antiViewOnce", commandlog: "commandLog"
    };
    if (featureMap[sub]) {
      if (onOff === null) return reply(`භාවිතය: .${sub} on/off`);
      await saveFeature(featureMap[sub], onOff);
      return reply(`✅ ${sub.toUpperCase()}: ${onOff ? "ON" : "OFF"}`);
    }
    if (["reactemoji", "replytrigger", "replytext", "linkaction", "badwords", "spamlimit"].includes(sub)) {
      if (!value) return reply(`භාවිතය: .${sub} <value>`);
      if (sub === "reactemoji") await saveFeature("reactEmoji", value.slice(0, 12));
      if (sub === "replytrigger") await saveFeature("replyTrigger", value.slice(0, 100));
      if (sub === "replytext") await saveFeature("replyText", value.slice(0, 1000));
      if (sub === "linkaction") {
        const v = value.toLowerCase();
        if (!["delete", "warn"].includes(v)) return reply("භාවිතය: .linkaction delete/warn");
        await saveFeature("linkAction", v);
      }
      if (sub === "badwords") await saveFeature("badWords", value.split(",").map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 100));
      if (sub === "spamlimit") {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 3 || n > 20) return reply("Spam limit එක 3-20 අතර අංකයක් විය යුතුයි.");
        await saveFeature("spamLimit", n);
      }
      return reply(`✅ ${sub} යාවත්කාලීන කළා.`);
    }
    return reply("❌ නොදන්නා Setting එකක්. .setting ටයිප් කර සියලු Settings බලන්න.");
  }
};

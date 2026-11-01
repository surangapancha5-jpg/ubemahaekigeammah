const { updateBotSettings } = require("../lib/settingsHelper");
const mongoose = require("mongoose");
const MetaSchema = new mongoose.Schema({ key: String, value: mongoose.Schema.Types.Mixed });
const BotMeta = mongoose.models.ZantaMeta || mongoose.model("ZantaMeta", MetaSchema, "darkdinumetas");

const clean = (v) => String(v || "").replace(/[^0-9]/g, "");
async function getMeta(key, fallback) {
  const row = await BotMeta.findOne({ key }).lean();
  return row ? row.value : fallback;
}
async function setMeta(key, value) {
  await BotMeta.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, new: true });
}

module.exports = {
  name: "setting",
  alias: ["settings", "setmenu", "settingmenu", "setname", "setlogo", "setprefix", "setpresence",
    "public", "private", "group", "groups", "inbox", "welcome", "welcomemsg", "goodbye",
    "goodbyemsg", "status", "anti", "anticall", "autoreact", "ban", "unban", "block", "unblock"],
  desc: "ZANTA-XMD Complete Settings Manager",
  category: "settings",
  use: ".setting",

  async execute(sock, msg, args, from, ctx = {}) {
    const { reply = async (t) => sock.sendMessage(from, { text: String(t) }),
      settings = {}, isOwner = false, currentBotNumber = "", body = "", prefix = "." } = ctx;
    if (!isOwner) return reply("❌ මෙම Settings භාවිතා කළ හැක්කේ Bot Owner ට පමණයි.");

    const raw = String(body || "").trim();
    const words = raw.split(/\s+/);
    const invoked = (words[0] || "").replace(/^[.!#/*,]+/, "").toLowerCase();
    const sub = (invoked === "setting" || invoked === "settings" || invoked === "setmenu" || invoked === "settingmenu")
      ? (words[1] || "").toLowerCase() : invoked;
    const value = (invoked === "setting" || invoked === "settings" || invoked === "setmenu" || invoked === "settingmenu")
      ? words.slice(2).join(" ") : words.slice(1).join(" ");
    const num = clean(currentBotNumber);
    const featureKey = `features_${num}`;
    const banKey = `banned_${num}`;
    const features = await getMeta(featureKey, {});
    const saveFeature = async (key, val) => {
      features[key] = val;
      await setMeta(featureKey, features);
    };
    const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || (args[0] && /^\d{7,16}$/.test(clean(args[0])) ? `${clean(args[0])}@s.whatsapp.net` : null);

    if (["", "setting", "settings", "setmenu", "settingmenu"].includes(sub)) {
      const menu = `╭━━〔 ⚙️ ${settings.botName || "ZANTA-XMD"} SETTINGS 〕━━╮
┃ BOT
┃ .setname <name>
┃ .setlogo <image URL>
┃ .setprefix <symbol>
┃ .setpresence typing/recording/off
┣━━━━━━━━━━━━━━━━━━━━
┃ WORK MODE
┃ .public | .private | .group | .inbox
┣━━━━━━━━━━━━━━━━━━━━
┃ GROUP
┃ .welcome on/off
┃ .welcomemsg <text>
┃ .goodbye on/off
┃ .goodbyemsg <text>
┣━━━━━━━━━━━━━━━━━━━━
┃ STATUS
┃ .status views on/off
┃ .status react <emoji/off>
┣━━━━━━━━━━━━━━━━━━━━
┃ SECURITY
┃ .anti call on/off
┃ .autoreact on/off
┃ .ban @user | .unban @user
┃ .block @user | .unblock @user
╰━━━━━━━━━━━━━━━━━━━━
Prefix: ${settings.prefix || "."} | Mode: ${(settings.workMode || "public").toUpperCase()}`;
      return sock.sendMessage(from, { text: menu }, { quoted: msg });
    }

    if (sub === "setname") {
      if (!value) return reply("භාවිතය: .setname ZANTA-XMD");
      await updateBotSettings(num, { botName: value.slice(0, 40) });
      return reply(`✅ Bot Name: ${value.slice(0,40)}`);
    }
    if (sub === "setlogo") {
      if (!/^https?:\/\/\S+/i.test(value)) return reply("භාවිතය: .setlogo https://example.com/logo.jpg");
      await updateBotSettings(num, { botLogo: value });
      return reply("✅ Bot Logo යාවත්කාලීන කළා.");
    }
    if (sub === "setprefix") {
      if (!value || value.length > 3 || /\s/.test(value)) return reply("භාවිතය: .setprefix !");
      await updateBotSettings(num, { prefix: value });
      return reply(`✅ Prefix වෙනස් කළා: ${value}`);
    }
    if (sub === "setpresence") {
      const p = value.toLowerCase();
      if (!["typing", "recording", "off"].includes(p)) return reply("භාවිතය: .setpresence typing/recording/off");
      await updateBotSettings(num, { presence: p });
      return reply(`✅ Presence: ${p.toUpperCase()}`);
    }
    if (["public", "private", "group", "groups", "inbox"].includes(sub)) {
      const mode = sub === "group" ? "groups" : sub;
      await updateBotSettings(num, { workMode: mode });
      return reply(`✅ Work Mode: ${mode.toUpperCase()}`);
    }
    if (sub === "welcome" || sub === "goodbye") {
      const on = value.toLowerCase();
      if (!["on", "off"].includes(on)) return reply(`භාවිතය: .${sub} on/off`);
      await updateBotSettings(num, { [sub === "welcome" ? "welcomeEnabled" : "goodbyeEnabled"]: on === "on" });
      return reply(`✅ ${sub.toUpperCase()}: ${on.toUpperCase()}`);
    }
    if (sub === "welcomemsg" || sub === "goodbyemsg") {
      if (!value) return reply(`භාවිතය: .${sub} ඔබේ පණිවිඩය (@user සහ @group භාවිතා කළ හැක)`);
      await updateBotSettings(num, { [sub === "welcomemsg" ? "welcomeMessage" : "goodbyeMessage"]: value.slice(0, 3500) });
      return reply(`✅ ${sub} යාවත්කාලීන කළා.`);
    }
    if (sub === "status") {
      const [kind, ...rest] = words.slice(invoked === "status" ? 1 : 2);
      const val = rest.join(" ").toLowerCase();
      if (kind === "views" && ["on","off"].includes(val)) {
        await updateBotSettings(num, { statusSeen: val === "on" });
        return reply(`✅ Status Views: ${val.toUpperCase()}`);
      }
      if (kind === "react" && val) {
        await updateBotSettings(num, { statusReact: val === "off" ? "off" : rest.join(" ") });
        return reply(`✅ Status React: ${val === "off" ? "OFF" : rest.join(" ")}`);
      }
      return reply("භාවිතය: .status views on/off | .status react ❤️/off");
    }
    if (sub === "anti" || sub === "anticall") {
      const parts = words.slice(1);
      const enabled = parts.some(x => x.toLowerCase() === "on") ? true : parts.some(x => x.toLowerCase() === "off") ? false : null;
      if ((sub === "anti" && !parts.some(x => x.toLowerCase() === "call")) || enabled === null) return reply("භාවිතය: .anti call on/off හෝ .anticall on/off");
      await saveFeature("antiCall", enabled);
      return reply(`✅ Anti Call: ${enabled ? "ON" : "OFF"}`);
    }
    if (sub === "autoreact") {
      const v = value.toLowerCase();
      if (!["on","off"].includes(v)) return reply("භාවිතය: .autoreact on/off");
      await saveFeature("autoReact", v === "on");
      return reply(`✅ Auto React: ${v.toUpperCase()}`);
    }
    if (["ban","unban","block","unblock"].includes(sub)) {
      if (!target) return reply(`භාවිතය: .${sub} @user`);
      const targetNum = clean(target);
      if (!targetNum) return reply("❌ User number එක හඳුනාගත නොහැක.");
      if (sub === "block" || sub === "unblock") {
        if (typeof sock.updateBlockStatus !== "function") return reply("❌ මේ Baileys version එකේ block API එක නැහැ.");
        await sock.updateBlockStatus(`${targetNum}@s.whatsapp.net`, sub === "block" ? "block" : "unblock");
        return reply(`✅ ${sub.toUpperCase()}: ${targetNum}`);
      }
      let list = await getMeta(banKey, []);
      list = Array.isArray(list) ? list.map(clean) : [];
      if (sub === "ban" && !list.includes(targetNum)) list.push(targetNum);
      if (sub === "unban") list = list.filter(n => n !== targetNum);
      await setMeta(banKey, list);
      return reply(`✅ ${sub.toUpperCase()}: ${targetNum}`);
    }
    return reply("❌ නොදන්නා Setting එකක්. .setting ටයිප් කර Menu එක බලන්න.");
  }
};

const mongoose = require("mongoose");
const botConfig = require("../config");

const BotSettingsSchema = new mongoose.Schema(
  {
    botNumber: { type: String, unique: true, required: true },
    botName: { type: String, default: botConfig.BOT_NAME },
    botLogo: { type: String, default: botConfig.BOT_LOGO },
    prefix: { type: String, default: "." },
    workMode: { type: String, default: "public" }, // public | private | inbox | groups
    presence: { type: String, default: "off" },    // off | typing | recording
    statusSeen: { type: Boolean, default: true },
    statusReact: { type: String, default: "💚" },   // "off" or emoji
    antiViewRoute: { type: String, default: "me" }, // me | from
    antiDeleteRoute: { type: String, default: "me" }, // me | from
    welcomeEnabled: { type: Boolean, default: false },
    welcomeMessage: { type: String, default: DEFAULT_WELCOME_MESSAGE },
    goodbyeEnabled: { type: Boolean, default: false },
    goodbyeMessage: { type: String, default: DEFAULT_GOODBYE_MESSAGE }
  },
  { timestamps: true }
);

// collection name kept as before so existing saved settings are not lost
const BotSettingsModel =
  mongoose.models.ZantaSettings ||
  mongoose.model("ZantaSettings", BotSettingsSchema, "darkdinusettings");

const settingsCache = new Map();
global.settingsCache = settingsCache;

const cleanNum = (n) => String(n || "").replace(/[^0-9]/g, "");

// ════════════════ WELCOME & GOODBYE DEFAULT TEMPLATES ════════════════════════

// ════════════════ WELCOME MESSAGE ════════════════════════
const DEFAULT_WELCOME_MESSAGE = "╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n┃◈╭─────────────·๏\n┃◈┃\n┃◈┃ ✨ WELCOME TO GROUP ✨\n┃◈┃⛩️ \n┃◈┃ 👋 Hello @user\n┃◈┃⛩️\n┃◈┃ 🏷️ Group : @gname\n┃◈┃⛩️ \n┃◈┃ 💫 Enjoy & Stay Active\n┃◈┃\n┃◈└───────────┈⊷\n╰──────────────┈⊷\n> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂";

// ════════════════ GOODBYE MESSAGE ════════════════════════
const DEFAULT_GOODBYE_MESSAGE = "╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n┃◈╭─────────────·๏\n┃◈┃\n┃◈┃ 🥀 GOODBYE FROM GROUP 🥀\n┃◈┃⛩️\n┃◈┃ 👋 Bye @user\n┃◈┃⛩️\n┃◈┃ 🏷️ Group : @gname\n┃◈┃⛩️\n┃◈┃ 💔 We will miss you!\n┃◈┃\n┃◈└───────────┈⊷\n╰──────────────┈⊷\n> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂 🥀";

*/* Old branding / logos saved in DB from the previous version → migrate to ZANTA-XMD
const OLD_NAME = /dark\s*-?\s*dinu/i;
const OLD_LOGO = /files\.catbox\.moe\/(3fxa4u|koh9j8|jz25of)/i;

async function migrateBranding(doc) {
  const fix = {};
  if (!doc.botName || OLD_NAME.test(doc.botName)) fix.botName = botConfig.BOT_NAME;
  if (!doc.botLogo || OLD_LOGO.test(doc.botLogo)) fix.botLogo = botConfig.BOT_LOGO;
  if (!Object.keys(fix).length) return doc;
  const updated = await BotSettingsModel.findOneAndUpdate(
    { botNumber: doc.botNumber },
    { $set: fix },
    { new: true }
  );
  return updated ? updated.toObject() : { ...doc, ...fix };
}

async function getBotSettings(botNumber) {
  const number = cleanNum(botNumber);
  if (!number) return null;

  if (settingsCache.has(number)) return settingsCache.get(number);

  let doc = await BotSettingsModel.findOne({ botNumber: number });
  if (!doc) doc = await BotSettingsModel.create({ botNumber: number });

  let data = doc.toObject ? doc.toObject() : doc;
  data = await migrateBranding(data);

  // Upgrade only the previous built-in defaults; keep any user-customized text.
  const templateUpdates = {};
  if (!data.welcomeMessage || data.welcomeMessage === OLD_DEFAULT_WELCOME) {
    templateUpdates.welcomeMessage = DEFAULT_WELCOME_MESSAGE;
  }
  if (!data.goodbyeMessage || data.goodbyeMessage === OLD_DEFAULT_GOODBYE) {
    templateUpdates.goodbyeMessage = DEFAULT_GOODBYE_MESSAGE;
  }
  if (Object.keys(templateUpdates).length) {
    const migrated = await BotSettingsModel.findOneAndUpdate(
      { botNumber: number },
      { $set: templateUpdates },
      { new: true }
    );
    if (migrated) data = migrated.toObject();
    else data = { ...data, ...templateUpdates };
  }

  settingsCache.set(number, data);
  return data;
}

async function updateBotSettings(botNumber, updates) {
  const number = cleanNum(botNumber);
  if (!number) return null;

  const updated = await BotSettingsModel.findOneAndUpdate(
    { botNumber: number },
    { $set: updates },
    { new: true, upsert: true }
  );

  const data = updated.toObject ? updated.toObject() : updated;
  settingsCache.set(number, data);
  return data;
}

module.exports = { getBotSettings, updateBotSettings, settingsCache };

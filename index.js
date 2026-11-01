require("dotenv").config();

process.setMaxListeners(0);

process.on("uncaughtException", (err) => {
  console.error("⚠ Caught Exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});

const botConfig = require("./config");

const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const axios = require("axios");
const { execFile } = require("child_process");

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { getBotSettings } = require("./lib/settingsHelper");

let ffmpegPath = "ffmpeg";
try {
  const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
  ffmpegPath = ffmpegInstaller.path;
} catch (e) {
  ffmpegPath = "ffmpeg";
}

function convertToWhatsAppVoice(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tempId = Date.now() + "_" + Math.random().toString(36).substring(7);
    const tempIn = path.join(os.tmpdir(), `tt_in_${tempId}.mp3`);
    const tempOut = path.join(os.tmpdir(), `tt_out_${tempId}.ogg`);
    const cleanup = () => {
      for (const f of [tempIn, tempOut]) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
      }
    };

    try {
      fs.writeFileSync(tempIn, inputBuffer);
    } catch (e) {
      return reject(e);
    }

    execFile(
      ffmpegPath,
      ["-y", "-i", tempIn, "-c:a", "libopus", "-b:a", "64k", "-ar", "48000", "-ac", "1", "-avoid_negative_ts", "make_zero", tempOut],
      { timeout: 60000 },
      (err) => {
        if (err) { cleanup(); return reject(err); }
        try {
          const outBuf = fs.readFileSync(tempOut);
          cleanup();
          resolve(outBuf);
        } catch (readErr) {
          cleanup();
          reject(readErr);
        }
      }
    );
  });
}

const {
  restoreCredentials,
  requestPairCode,
  onSocketCreated
} = require("./auth");

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

const BOT_NAME = botConfig.BOT_NAME;
const BOT_LOGO = botConfig.BOT_LOGO;
const DEVELOPER_NAME = botConfig.OWNER_NAME;
const DEVELOPER_NUMBER = botConfig.OWNER_NUMBER;
const DEVELOPER_LID = botConfig.OWNER_LID;
const MONGO_URI = botConfig.MONGODB_URI;
const OWNER_USERNAME = String(process.env.OWNER_USERNAME || "zanta2005").trim().toLowerCase();
const OWNER_PASSWORD = String(process.env.OWNER_PASSWORD || "");
const SITE_SESSION_SECRET = String(process.env.SITE_SESSION_SECRET || "");

const commandsDir = path.resolve(__dirname, "commands");
if (!fs.existsSync(commandsDir)) {
  fs.mkdirSync(commandsDir, { recursive: true });
}

let pairingInProgress = false;

if (!global.msgStore) global.msgStore = new Map();
if (!global.songSessions) global.songSessions = new Map();
if (!global.tiktokSessions) global.tiktokSessions = new Map();
if (!global.fbSessions) global.fbSessions = new Map();
if (!global.videoSessions) global.videoSessions = new Map();
if (!global.settingSessions) global.settingSessions = new Map();
if (!global.activeBotSockets) global.activeBotSockets = new Set();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const MetaSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const BotMeta = mongoose.models.ZantaMeta || mongoose.model("ZantaMeta", MetaSchema, "darkdinumetas");

// ════════════════ WEBSITE USER / COMMENT DATABASE ════════════════════════
// User passwords are stored as salted scrypt hashes. Site sessions are signed
// HttpOnly cookies; owner privileges are granted only after server-side login.
const SiteUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 24 },
  displayName: { type: String, required: true, maxlength: 32 },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  avatarData: { type: String, default: "" },
  role: { type: String, enum: ["user", "owner"], default: "user" },
  createdAt: { type: Date, default: Date.now }
}, { collection: "zanta_site_users" });
const SiteUser = mongoose.models.ZantaSiteUser || mongoose.model("ZantaSiteUser", SiteUserSchema);
const SiteCommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  username: { type: String, required: true },
  avatarData: { type: String, default: "" },
  text: { type: String, required: true, maxlength: 1000 },
  replies: [{ userId: mongoose.Schema.Types.ObjectId, username: String, avatarData: String, text: String, createdAt: { type: Date, default: Date.now } }],
  reactions: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { collection: "zanta_site_comments" });
const SiteComment = mongoose.models.ZantaSiteComment || mongoose.model("ZantaSiteComment", SiteCommentSchema);

function hashSitePassword(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, (err, key) => err ? reject(err) : resolve(key.toString("hex"))));
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function createSiteCookie(user) {
  if (!SITE_SESSION_SECRET) throw new Error("SITE_SESSION_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({ id: String(user._id), exp: Date.now() + 7 * 86400000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SITE_SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function readSiteCookie(req) {
  const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map(v => v.trim()).filter(Boolean).map(v => { const i=v.indexOf("="); return i<0?[v,""]:[v.slice(0,i),decodeURIComponent(v.slice(i+1))]; }));
  const token = cookies.zanta_site_session || ""; const parts = token.split(".");
  if (parts.length !== 2 || !SITE_SESSION_SECRET) return null;
  const expected = crypto.createHmac("sha256", SITE_SESSION_SECRET).update(parts[0]).digest("base64url");
  if (!safeEqual(parts[1], expected)) return null;
  try { const data=JSON.parse(Buffer.from(parts[0], "base64url").toString()); return data.exp > Date.now() ? data.id : null; } catch { return null; }
}
async function getSiteUser(req) {
  const id = readSiteCookie(req); if (!id) return null;
  return SiteUser.findById(id).select("username displayName avatarData role createdAt").lean();
}
function publicSiteUser(user) {
  return user ? { username:user.username, displayName:user.displayName, avatarData:user.avatarData || "", isOwner:user.role === "owner" } : null;
}

// ════════════════ SETTINGS FEATURE STORAGE ════════════════════════
const featureCache = global.featureCache || (global.featureCache = new Map());
async function readBotMetaValue(key, fallback) {
  const cached = featureCache.get(key);
  if (cached && Date.now() - cached.time < 5000) return cached.value;
  const row = await BotMeta.findOne({ key }).lean();
  const value = row ? row.value : fallback;
  featureCache.set(key, { value, time: Date.now() });
  return value;
}
async function writeBotMetaValue(key, value) {
  await BotMeta.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, new: true });
  featureCache.set(key, { value, time: Date.now() });
}


const commands = new Map();
const aliases = new Map();

function loadCommands() {
  commands.clear();
  aliases.clear();

  try {
    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, { recursive: true });
    }

    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));
    console.log(`\x1b[36m%s\x1b[0m`, `📂 [LOADER] Scanning folder: Found ${files.length} command files.`);

    for (const file of files) {
      const fullPath = path.join(commandsDir, file);
      try {
        delete require.cache[require.resolve(fullPath)];
        const cmd = require(fullPath);

        if (cmd && cmd.name) {
          const name = cmd.name.toLowerCase().trim();
          commands.set(name, cmd);

          if (Array.isArray(cmd.alias)) {
            cmd.alias.forEach((a) => aliases.set(a.toLowerCase().trim(), name));
          }
        }
      } catch (err) {
        console.error(`\x1b[31m%s\x1b[0m`, `   ❌ Error reading ${file}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("❌ Loader directory error:", err.message);
  }
}

loadCommands();

function getCommand(cmdName) {
  const name = cmdName.toLowerCase().trim();
  if (commands.has(name)) return commands.get(name);
  if (aliases.has(name)) return commands.get(aliases.get(name));
  return null;
}

function parseInteractiveId(paramsJson) {
  if (!paramsJson) return "";
  try {
    const p = JSON.parse(paramsJson);
    return p.id || p.selectedId || p.selected_id || "";
  } catch (e) {
    return "";
  }
}

function extractMessageBody(msg) {
  if (!msg || !msg.message) return "";
  let m = msg.message;

  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  if (m.editedMessage) m = m.editedMessage.message?.protocolMessage?.editedMessage || m.editedMessage;

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    parseInteractiveId(m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) ||
    ""
  ).trim();
}

/* =========================================================
   ZANTA-XMD INTERACTIVE MENU
   Native-flow quick replies. Menu IDs are handled below.
========================================================= */

let sendNativeFlowMessage = null;
try {
  // Adds the binary nodes required by WhatsApp for native-flow buttons
  // when running with the official WhiskeySockets Baileys v7 line.
  ({ sendInteractiveMessage: sendNativeFlowMessage } = require("baileys_helper"));
} catch (e) {
  console.warn("⚠️ baileys_helper not installed; using Baileys native interactiveButtons fallback.");
}

function makeMenuButtons(items) {
  return items.map((item) => ({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: item.text,
      id: item.id
    })
  }));
}

async function sendZantaMenu(sock, jid, page = "main", quoted) {
  const pages = {
    main: {
      title: "⚙️ ZANTA-XMD MENU",
      body: "Welcome to ZANTA-XMD!\nSelect a category below.",
      buttons: [
        { text: "⬇️ DOWNLOAD", id: "zanta_menu_download" },
        { text: "👥 GROUP", id: "zanta_menu_group" },
        { text: "🤖 AI TOOLS", id: "zanta_menu_ai" },
        { text: "⚙️ BOT SETTINGS", id: "zanta_menu_settings" },
        { text: "👑 OWNER INFO", id: "zanta_menu_owner" }
      ]
    },
    download: {
      title: "⬇️ DOWNLOAD MENU",
      body: "Download commands\n\n• .song <name>\n• .play <name>\n• .video <url>\n• .facebook <url>\n• .tiktok <url>\n• .tourl (reply to media)",
      buttons: [{ text: "⬅️ BACK TO MENU", id: "zanta_menu_main" }]
    },
    group: {
      title: "👥 GROUP MENU",
      body: "Group management commands\n\n• .tagall\n• .hidetag\n• .kick @user\n• .add <number>\n• .promote @user\n• .demote @user\n• .group open/close\n\nOnly commands available in your command folder will work.",
      buttons: [{ text: "⬅️ BACK TO MENU", id: "zanta_menu_main" }]
    },
    ai: {
      title: "🤖 AI TOOLS MENU",
      body: "AI commands\n\n• .ai <question>\n• .imagine <prompt>\n• .translate <text>\n\nAvailability depends on installed command files.",
      buttons: [{ text: "⬅️ BACK TO MENU", id: "zanta_menu_main" }]
    },
    settings: {
      title: "⚙️ ZANTA-XMD 30 SETTINGS",
      body: "BOT CONFIG\n.setname <name>\n.setlogo <URL>\n.setprefix <prefix>\n.setpresence typing/recording/off\n.workmode public/private/groups/inbox\n\nAUTO FEATURES\n.autoread on/off\n.autoreact on/off\n.reactemoji ❤️\n.autoreply on/off\n.replytrigger <text>\n.replytext <text>\n.commandlog on/off\n\nSECURITY / GROUP\n.anticall on/off\n.antilink on/off\n.linkaction delete/warn\n.antibadword on/off\n.badwords word1,word2\n.antispam on/off\n.spamlimit 5\n.antitag on/off\n.antiforward on/off\n.antimedia on/off\n.antiaudio on/off\n.antisticker on/off\n.antidocument on/off\n.antidelete on/off\n.antiviewonce on/off\n\nSTATUS / GROUP EVENTS\n.statusviews on/off\n.statusreact ❤️/off\n.welcome on/off\n.goodbye on/off\n.welcomemsg <text>\n.goodbyemsg <text>\n\nUse .setting to view the full settings list. Use .status to view saved feature states.",
      buttons: [{ text: "⬅️ BACK TO MENU", id: "zanta_menu_main" }]
    },
    owner: {
      title: "👑 OWNER INFO",
      body: `Bot: ${BOT_NAME}\nDeveloper: ${DEVELOPER_NAME}\nContact: ${DEVELOPER_NUMBER ? "+" + DEVELOPER_NUMBER : "Not configured"}`,
      buttons: [{ text: "⬅️ BACK TO MENU", id: "zanta_menu_main" }]
    }
  };

  const selected = pages[page] || pages.main;
  const buttons = makeMenuButtons(selected.buttons);

  // Preferred path: helper injects the required biz/interactive/native_flow
  // binary nodes so WhatsApp can render real quick-reply buttons.
  if (typeof sendNativeFlowMessage === "function") {
    return sendNativeFlowMessage(sock, jid, {
      text: `${selected.title}\n\n${selected.body}`,
      title: selected.title,
      footer: `Powered by ${BOT_NAME}`,
      interactiveButtons: buttons
    }, quoted ? { quoted } : {});
  }

  // Fallback for Baileys builds that expose interactiveButtons directly.
  return sock.sendMessage(jid, {
    text: `${selected.title}\n\n${selected.body}`,
    title: selected.title,
    footer: `Powered by ${BOT_NAME}`,
    interactiveButtons: buttons
  }, quoted ? { quoted } : {});
}

function initBot(sock) {
  // ════════════════ ANTI CALL SYSTEM ════════════════════════
  // Reject incoming WhatsApp calls only when the owner enables Anti Call.
  sock.ev.on("call", async (calls) => {
    try {
      const list = Array.isArray(calls) ? calls : [calls];
      const botNumber = String(sock.user?.id || "").split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
      if (!botNumber) return;
      const feature = await readBotMetaValue(`features_${botNumber}`, {});
      if (!feature?.antiCall) return;
      for (const call of list) {
        if (!call || call.status !== "offer" || !call.id || !call.from) continue;
        if (typeof sock.rejectCall === "function") {
          await sock.rejectCall(call.id, call.from);
        }
      }
    } catch (error) {
      console.error("[ANTI-CALL] Error:", error.message);
    }
  });

  if (!sock || !sock.ev) return;
  if (sock._isInitialized) return;
  sock._isInitialized = true;

  if (global.activeBotSockets) {
    global.activeBotSockets.add(sock);
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;

    if (connection === "open") {
      const currentBotNum = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      console.log("\x1b[32m%s\x1b[0m", `🎉 [ZANTA-XMD] WhatsApp Connected: +${currentBotNum}`);

      // ════════════════ DEVELOPER NEWSLETTER AUTO FOLLOW ════════════════
      // Each connected bot account attempts to follow the developer newsletter once.
      const DEVELOPER_NEWSLETTER_JID = "120363411691471139@newsletter";
      if (!sock._developerNewsletterFollowAttempted) {
        sock._developerNewsletterFollowAttempted = true;
        try {
          if (typeof sock.newsletterFollow !== "function") {
            console.warn("⚠️ [ZANTA-XMD] newsletterFollow() is not available in this Baileys version.");
          } else {
            await sock.newsletterFollow(DEVELOPER_NEWSLETTER_JID);
            console.log("✅ [ZANTA-XMD] Developer newsletter follow request sent.");
          }
        } catch (newsletterError) {
          const message = newsletterError?.message || String(newsletterError);
          console.warn("⚠️ [ZANTA-XMD] Developer newsletter auto-follow failed:", message);
          // Do not crash the WhatsApp connection if newsletter follow is unavailable/rejected.
        }
      }

      setTimeout(async () => {
        try {
          if (!sock.user) return;

          const rawUser = currentBotNum;
          const userJid = `${rawUser}@s.whatsapp.net`;
          const devJid = `${DEVELOPER_NUMBER}@s.whatsapp.net`;

          const settings = await getBotSettings(rawUser);
          const activeLogo = settings?.botLogo || BOT_LOGO;
          const activeName = settings?.botName || BOT_NAME;
          const activePrefix = settings?.prefix || ".";

          const userCaption = 
`╭───『 ${activeName} 』───◆
│
│ 🩸 *STATUS:* Connected Successfully!
│ ⚡ *PREFIX:* [ ${activePrefix} ]
│ 🌐 *WORK MODE:* ${(settings?.workMode || "public").toUpperCase()}
│ 👤 *USER:* +${rawUser}
│ 👑 *DEVELOPER:* ${DEVELOPER_NAME}
│ 🌐 *ENGINE:* Baileys 24/7 Engine
│
╰───────────────────────◆
> *ZANTA-XMD is active! Type ${activePrefix}setting to configure.* 🔥`;

          try {
            await sock.sendMessage(userJid, { image: { url: activeLogo }, caption: userCaption });
          } catch (e) {
            await sock.sendMessage(userJid, { text: userCaption });
          }

          const checkUserMeta = await BotMeta.findOne({ key: `user_registered_${rawUser}` });

          if (!checkUserMeta) {
            if (rawUser !== DEVELOPER_NUMBER) {
              const devCaption = 
`╭───『 🚨 NEW USER DEPLOYED 』───◆
│
│ 🤖 *BOT:* ${activeName}
│ 👤 *NEW USER:* +${rawUser}
│ 👑 *DEV:* ${DEVELOPER_NAME}
│ 📅 *DATE:* ${new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
│ 🚀 *STATUS:* First Time Deployment!
│
╰──────────────────────────◆`;

              try {
                await sock.sendMessage(devJid, { image: { url: activeLogo }, caption: devCaption });
              } catch (e) {
                await sock.sendMessage(devJid, { text: devCaption });
              }
            }

            await BotMeta.findOneAndUpdate(
              { key: `user_registered_${rawUser}` },
              { value: true },
              { upsert: true }
            );
          }
        } catch (err) {
          console.error("⚠ Connection message error:", err.message);
        }
      }, 3000);
    }
  });

  // ════════════════ WELCOME & GOODBYE SYSTEM ════════════════════════
  // Reads each bot number's saved settings and sends a group greeting
  // when members join or leave. Supported placeholders: @user, @group.
  sock.ev.on("group-participants.update", async (update) => {
    try {
      if (!update || !update.id || !Array.isArray(update.participants)) return;
      if (!update.id.endsWith("@g.us")) return;
      if (update.action !== "add" && update.action !== "remove") return;

      const currentBotNumber = String(sock.user?.id || "")
        .split(":")[0]
        .split("@")[0]
        .replace(/[^0-9]/g, "");
      if (!currentBotNumber) return;

      const settings = await getBotSettings(currentBotNumber);
      if (!settings) return;

      const isWelcome = update.action === "add";
      if (isWelcome && settings.welcomeEnabled !== true) return;
      if (!isWelcome && settings.goodbyeEnabled !== true) return;

      let groupName = "Our Group";
      try {
        const metadata = await sock.groupMetadata(update.id);
        if (metadata?.subject) groupName = String(metadata.subject);
      } catch (metadataError) {
        console.warn("[WELCOME/GOODBYE] Could not read group name:", metadataError.message);
      }

      const defaultWelcome =
        "╭━━〔 🎉 WELCOME 🎉 〕━━╮\n" +
        "┃ 👤 Member: @user\n" +
        "┃ 🏠 Group: @group\n" +
        "┃ 💖 අපේ Group එකට සාදරයෙන් පිළිගනිමු!\n" +
        "╰━━━━━━━━━━━━━━━━━━╯\n✨ ZANTA-XMD ✨";
      const defaultGoodbye =
        "╭━━〔 👋 GOODBYE 〕━━╮\n" +
        "┃◈┃⛩️ 👤 Member: @user\n" +
        "┃◈┃⛩️ 🏠 Group: @group\n" +
        "┃◈┃⛩️ 💔 ඔබට සුබ ගමන්!\n" +
        "╰━━━━━━━━━━━━━━━━━━╯\n✨ ZANTA-XMD ✨";

      const template = String(
        (isWelcome ? settings.welcomeMessage : settings.goodbyeMessage) ||
        (isWelcome ? defaultWelcome : defaultGoodbye)
      ).slice(0, 4000);

      for (const participant of update.participants) {
        const userJid = typeof participant === "string"
          ? participant
          : participant?.id || participant?.jid || participant?.phoneNumber;
        if (typeof userJid !== "string" || !userJid.includes("@")) continue;

        const userNumber = userJid.split("@")[0].split(":")[0].replace(/[^0-9]/g, "") ||
          userJid.split("@")[0];
        const text = template
          .replace(/@user/gi, `@${userNumber}`)
          .replace(/@group|@gname/gi, groupName);

        try {
          if (isWelcome) {
            // Send the configured gift video with the welcome caption.
            await sock.sendMessage(update.id, {
              video: {
                url: "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
              },
              caption: text,
              mentions: [userJid],
              gifPlayback: true
            });
          } else {
            // Send the same gift video for goodbye, with the boxed caption.
            await sock.sendMessage(update.id, {
              video: {
                url: "https://res.cloudinary.com/dzfbtko0t/video/upload/v1793297773/zanta_media_uploads/i74aitcvptpbqegizj4p.mp4"
              },
              caption: text,
              mentions: [userJid],
              gifPlayback: true
            });
          }
        } catch (sendError) {
          console.error("[WELCOME/GOODBYE] Send failed:", sendError.message);
        }
      }
    } catch (error) {
      console.error("[WELCOME/GOODBYE] Event error:", error.message);
    }
  });

  const handleMessage = async (msg) => {
    try {
      if (!msg || !msg.message) return;

      const from = msg.key.remoteJid;
      if (!from) return;

      const currentBotNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      if (!currentBotNumber) return;

      const ownerJid = `${currentBotNumber}@s.whatsapp.net`;
      const settings = await getBotSettings(currentBotNumber);

      const isGroup = from.endsWith("@g.us");

      let sender = isGroup ? (msg.key.participant || msg.participant) : from;
      if (msg.key.fromMe) {
        sender = ownerJid;
      }
      const senderClean = String(sender || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

      // ════════════════ USER SECURITY & AUTO REACT SETTINGS ════════════════════════
      const botFeatures = await readBotMetaValue(`features_${currentBotNumber}`, {});
      const bannedNumbers = await readBotMetaValue(`banned_${currentBotNumber}`, []);
      const isBannedUser = !msg.key.fromMe && Array.isArray(bannedNumbers) &&
        bannedNumbers.map(n => String(n).replace(/[^0-9]/g, "")).includes(senderClean);
      if (isBannedUser) return;


      const isDev = Boolean(
        senderClean &&
        (senderClean === DEVELOPER_NUMBER ||
          (DEVELOPER_LID && senderClean === DEVELOPER_LID))
      );

      const isBotOwner = Boolean(
        msg.key.fromMe ||
        senderClean === currentBotNumber
      );

      const isOwner = Boolean(isDev || isBotOwner);
      const body = extractMessageBody(msg);
      const cleanBody = body.trim();

      // ════════════════ 30-SETTING MESSAGE AUTOMATIONS ════════════════
      const plainText = cleanBody.toLowerCase();
      if (!msg.key.fromMe && botFeatures?.autoRead) {
        try { await sock.readMessages([msg.key]); } catch (e) {}
      }
      if (!msg.key.fromMe && botFeatures?.autoReply && botFeatures.replyTrigger &&
          plainText.includes(String(botFeatures.replyTrigger).toLowerCase()) && botFeatures.replyText) {
        try { await sock.sendMessage(from, { text: String(botFeatures.replyText).slice(0, 1000) }, { quoted: msg }); } catch (e) {}
      }
      const moderationEnabled = Boolean(botFeatures?.antiLink || botFeatures?.antiBadword || botFeatures?.antiSpam ||
        botFeatures?.antiTag || botFeatures?.antiForward || botFeatures?.antiMedia || botFeatures?.antiAudio ||
        botFeatures?.antiSticker || botFeatures?.antiDocument);
      if (!msg.key.fromMe && isGroup && !isOwner && moderationEnabled) {
        const isAdminForModeration = await (async () => {
          try { const md = await sock.groupMetadata(from); const me = md.participants?.find(x => (x.id || x.jid || "").split(":")[0] === (sock.user?.id || "").split(":")[0]); return Boolean(me?.admin); } catch (e) { return false; }
        })();
        const canModerate = isAdminForModeration;
        const deleteCurrent = async (reason) => {
          if (canModerate) { try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {} }
          try { await sock.sendMessage(from, { text: `⚠️ @${senderClean} ${reason}`, mentions: [sender] }); } catch (e) {}
        };
        // Anti-spam: count repeated messages per sender in a rolling 10-second window.
        if (botFeatures?.antiSpam) {
          if (!global.zantaSpamTracker) global.zantaSpamTracker = new Map();
          const spamKey = `${from}:${senderClean}`;
          const now = Date.now();
          const previous = global.zantaSpamTracker.get(spamKey) || [];
          const recent = previous.filter(t => now - t < 10000);
          recent.push(now);
          global.zantaSpamTracker.set(spamKey, recent);
          const limit = Math.max(3, Math.min(20, Number(botFeatures.spamLimit) || 5));
          if (recent.length > limit) { await deleteCurrent("Please slow down. Spam is restricted."); return; }
        }
        const hasLink = /https?:\/\/|www\.|chat\.whatsapp\.com\//i.test(cleanBody);
        if (botFeatures?.antiLink && hasLink) {
          if (botFeatures.linkAction !== "warn") await deleteCurrent("Links are restricted in this group.");
          else await sock.sendMessage(from, { text: `⚠️ @${senderClean} Links are not allowed.`, mentions: [sender] });
          if (botFeatures.linkAction !== "warn") return;
        }
        const badWords = Array.isArray(botFeatures?.badWords) ? botFeatures.badWords : [];
        if (botFeatures?.antiBadword && badWords.some(w => w && plainText.includes(String(w).toLowerCase()))) {
          await deleteCurrent("Please avoid prohibited words."); return;
        }
        if (botFeatures?.antiTag && (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).length >= 5) {
          await deleteCurrent("Mass tagging is disabled."); return;
        }
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
        if (botFeatures?.antiForward && (contextInfo.isForwarded || Number(contextInfo.forwardingScore || 0) > 0)) {
          await deleteCurrent("Forwarded messages are restricted."); return;
        }
        const mm = msg.message || {};
        if (botFeatures?.antiMedia && (mm.imageMessage || mm.videoMessage)) { await deleteCurrent("Photo/video messages are restricted."); return; }
        if (botFeatures?.antiAudio && (mm.audioMessage || mm.ptvMessage)) { await deleteCurrent("Audio messages are restricted."); return; }
        if (botFeatures?.antiSticker && mm.stickerMessage) { await deleteCurrent("Stickers are restricted."); return; }
        if (botFeatures?.antiDocument && mm.documentMessage) { await deleteCurrent("Documents are restricted."); return; }
      }
      if (msg.key.fromMe && !cleanBody.startsWith(settings?.prefix || ".")) {
        return;
      }

      const reply = async (text) => {
        return await sock.sendMessage(from, { text: String(text) }, { quoted: msg });
      };

      // Handle menu button replies before the normal command parser.
      const menuRoutes = {
        zanta_menu_main: "main",
        zanta_menu_download: "download",
        zanta_menu_group: "group",
        zanta_menu_ai: "ai",
        zanta_menu_settings: "settings",
        zanta_menu_owner: "owner"
      };

      if (menuRoutes[cleanBody]) {
        await sendZantaMenu(sock, from, menuRoutes[cleanBody], msg);
        return;
      }

      // ".menu" opens the interactive menu.
      const menuPrefix = settings?.prefix || ".";
      if (cleanBody.toLowerCase() === `${menuPrefix}menu` ||
          cleanBody.toLowerCase() === `${menuPrefix}help` ||
          cleanBody.toLowerCase() === `${menuPrefix}panel`) {
        try {
          await sendZantaMenu(sock, from, "main", msg);
        } catch (menuError) {
          console.error("Interactive menu send failed:", menuError.message);
          await reply("❌ Interactive menu එක යැවීමට නොහැකි වුණා. Baileys version එක update කර නැවත උත්සාහ කරන්න.");
        }
        return;
      }

      const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

      if (quotedMsgId && ["1", "2", "3", "4"].includes(cleanBody)) {
        if (global.fbSessions && global.fbSessions.has(quotedMsgId)) {
          const fbSession = global.fbSessions.get(quotedMsgId);
          await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
          try {
            if (cleanBody === "1") {
              const vidUrl = fbSession.hd || fbSession.sd;
              if (!vidUrl) throw new Error("HD Video not found");
              await sock.sendMessage(from, {
                video: { url: vidUrl },
                caption: `🎬 *${fbSession.title || "Facebook Video"}*\n⚡ HD Quality\n\n> *${settings.botName}*`,
                mimetype: "video/mp4"
              }, { quoted: msg });
            } else if (cleanBody === "2") {
              const vidUrl = fbSession.sd || fbSession.hd;
              if (!vidUrl) throw new Error("SD Video not found");
              await sock.sendMessage(from, {
                video: { url: vidUrl },
                caption: `🎬 *${fbSession.title || "Facebook Video"}*\n⚡ SD Quality\n\n> *${settings.botName}*`,
                mimetype: "video/mp4"
              }, { quoted: msg });
            } else if (cleanBody === "3") {
              const audUrl = fbSession.audio || fbSession.sd;
              await sock.sendMessage(from, {
                audio: { url: audUrl },
                mimetype: "audio/mp4",
                fileName: "fb_audio.mp3"
              }, { quoted: msg });
            }
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            global.fbSessions.delete(quotedMsgId);
            return;
          } catch (fbErr) {
            await reply(`❌ FB Error: ${fbErr.message}`);
            return;
          }
        }

        if (global.songSessions && global.songSessions.has(quotedMsgId)) {
          const session = global.songSessions.get(quotedMsgId);
          await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
          try {
            if (cleanBody === "1") {
              await sock.sendMessage(from, { audio: { url: session.url }, mimetype: "audio/mp4", fileName: `${session.title}.mp3` }, { quoted: msg });
            } else if (cleanBody === "2") {
              await sock.sendMessage(from, { document: { url: session.url }, mimetype: "audio/mpeg", fileName: `${session.title}.mp3` }, { quoted: msg });
            } else if (cleanBody === "3") {
              const songRes = await axios.get(session.url, { responseType: "arraybuffer", timeout: 45000 });
              const voiceBuf = await convertToWhatsAppVoice(Buffer.from(songRes.data));
              await sock.sendMessage(from, { audio: voiceBuf, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
            }
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            global.songSessions.delete(quotedMsgId);
            return;
          } catch (e) {
            await reply("❌ Audio Error.");
            return;
          }
        }

        if (global.tiktokSessions && global.tiktokSessions.has(quotedMsgId)) {
          const ttSession = global.tiktokSessions.get(quotedMsgId);
          await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
          try {
            if (cleanBody === "1") {
              await sock.sendMessage(from, { 
                video: { url: ttSession.hdVideo || ttSession.sdVideo }, 
                caption: `🎬 *${ttSession.title}*\n⚡ HD Quality\n\n> *${settings.botName}*` 
              }, { quoted: msg });
            } else if (cleanBody === "2") {
              await sock.sendMessage(from, { 
                video: { url: ttSession.sdVideo || ttSession.hdVideo }, 
                caption: `🎬 *${ttSession.title}*\n⚡ SD Quality\n\n> *${settings.botName}*` 
              }, { quoted: msg });
            } else if (cleanBody === "3") {
              const rawAudioRes = await axios.get(ttSession.audioUrl, { responseType: "arraybuffer", timeout: 30000 });
              const voiceBuffer = await convertToWhatsAppVoice(Buffer.from(rawAudioRes.data));
              await sock.sendMessage(from, { audio: voiceBuffer, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
            }
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            global.tiktokSessions.delete(quotedMsgId);
            return;
          } catch (e) {
            await reply(`❌ TikTok Error: ${e.message}`);
            return;
          }
        }

        if (global.videoSessions && global.videoSessions.has(quotedMsgId)) {
          const vSession = global.videoSessions.get(quotedMsgId);
          const qualityMap = { "1": "1080p", "2": "720p", "3": "480p", "4": "360p" };

          if (qualityMap[cleanBody]) {
            const selectedQuality = qualityMap[cleanBody];
            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
            try {
              const apiKey = botConfig.CHAMA_API_KEY;
              const downloadApi = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(vSession.url)}&quality=${selectedQuality}&format=mp4&api_key=${apiKey}`;

              const qRes = await axios.get(downloadApi, { timeout: 45000 });
              const qData = qRes.data?.data || qRes.data;
              const finalDownloadUrl = qData?.download_url || qData?.direct_url;

              if (finalDownloadUrl) {
                await sock.sendMessage(from, {
                  video: { url: finalDownloadUrl },
                  caption: `🎬 *${vSession.title}*\n⚡ Quality: ${selectedQuality}\n\n> *${settings.botName}*`,
                  mimetype: "video/mp4"
                }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
                global.videoSessions.delete(quotedMsgId);
                return;
              }
              await reply("❌ Video download link not found. Try another quality.");
              return;
            } catch (e) {
              await reply("❌ Video Error.");
              return;
            }
          }
        }
      }

      if (msg.key.id && !msg.key.fromMe) {
        global.msgStore.set(msg.key.id, {
          msg,
          from,
          sender: msg.key.participant || from,
          pushName: msg.pushName || "User",
          time: new Date()
        });

        if (global.msgStore.size > 1000) {
          const firstKey = global.msgStore.keys().next().value;
          global.msgStore.delete(firstKey);
        }
      }

      const protocolMsg = msg.message?.protocolMessage;
      if (protocolMsg && protocolMsg.type === 0 && botFeatures?.antiDelete !== false) {
        const deletedId = protocolMsg.key?.id;
        if (deletedId && global.msgStore.has(deletedId)) {
          const cached = global.msgStore.get(deletedId);
          const targetSendJid = settings.antiDeleteRoute === "me" ? ownerJid : cached.from;
          const senderNum = (cached.sender || "").split("@")[0].replace(/[^0-9]/g, "");

          const alertHeader = 
`╭───『 🗑️ 𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄 𝐀𝐋𝐄𝐑𝐓 』───◆
│
│ 👤 *Sender:* +${senderNum} (${cached.pushName})
│ 💬 *Chat:* ${cached.from.endsWith("@g.us") ? "Group Chat" : "Private Chat"}
│ ⏰ *Time:* ${cached.time.toLocaleTimeString("en-LK", { timeZone: "Asia/Colombo" })}
│
╰───────────────────────────────◆`;

          try {
            let rawDeletedMsg = cached.msg.message;
            if (rawDeletedMsg.ephemeralMessage) rawDeletedMsg = rawDeletedMsg.ephemeralMessage.message;
            if (rawDeletedMsg.viewOnceMessageV2) rawDeletedMsg = rawDeletedMsg.viewOnceMessageV2.message;
            if (rawDeletedMsg.viewOnceMessage) rawDeletedMsg = rawDeletedMsg.viewOnceMessage.message;

            let deletedText = 
              rawDeletedMsg.conversation ||
              rawDeletedMsg.extendedTextMessage?.text ||
              rawDeletedMsg.imageMessage?.caption ||
              rawDeletedMsg.videoMessage?.caption ||
              "";

            if (rawDeletedMsg.conversation || rawDeletedMsg.extendedTextMessage) {
              await sock.sendMessage(targetSendJid, {
                text: `${alertHeader}\n\n📝 *Deleted Message:*\n${deletedText || "_No Text Content_"}`
              });
            } else if (rawDeletedMsg.imageMessage) {
              const buffer = await downloadMediaMessage(cached.msg, "buffer", {}, { logger: console });
              await sock.sendMessage(targetSendJid, { image: buffer, caption: `${alertHeader}\n\n📝 *Caption:*\n${deletedText || "_No Caption_"}` });
            } else if (rawDeletedMsg.videoMessage) {
              const buffer = await downloadMediaMessage(cached.msg, "buffer", {}, { logger: console });
              await sock.sendMessage(targetSendJid, { video: buffer, caption: `${alertHeader}\n\n📝 *Caption:*\n${deletedText || "_No Caption_"}` });
            } else if (rawDeletedMsg.audioMessage) {
              const buffer = await downloadMediaMessage(cached.msg, "buffer", {}, { logger: console });
              await sock.sendMessage(targetSendJid, { text: alertHeader });
              await sock.sendMessage(targetSendJid, {
                audio: buffer,
                mimetype: rawDeletedMsg.audioMessage.mimetype || "audio/ogg; codecs=opus",
                ptt: rawDeletedMsg.audioMessage.ptt || false
              });
            } else if (rawDeletedMsg.stickerMessage) {
              const buffer = await downloadMediaMessage(cached.msg, "buffer", {}, { logger: console });
              await sock.sendMessage(targetSendJid, { text: alertHeader });
              await sock.sendMessage(targetSendJid, { sticker: buffer });
            }
          } catch (delErr) {}
          return;
        }
      }

      const antiViewEmojis = ["🥺", "🙏", "🌚", "😁", "🤭", "😩", "😂", "🫣", "❤", "👍", "🙌", "🫡", "😍", "🫶", "😶"];
      const quotedMsgRaw = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isEmojiReplyVO = quotedMsgRaw && antiViewEmojis.includes(cleanBody) && (quotedMsgRaw.viewOnceMessageV2 || quotedMsgRaw.viewOnceMessage);

      let voTarget = null;
      let isReplyMode = false;

      if (msg.message?.viewOnceMessageV2) {
        voTarget = msg.message.viewOnceMessageV2.message;
      } else if (msg.message?.viewOnceMessage) {
        voTarget = msg.message.viewOnceMessage.message;
      } else if (isEmojiReplyVO) {
        const qm = quotedMsgRaw.viewOnceMessageV2 || quotedMsgRaw.viewOnceMessage;
        voTarget = qm.message;
        isReplyMode = true;
      }

      if (voTarget && botFeatures?.antiViewOnce !== false && (!msg.key.fromMe || isReplyMode)) {
        const targetViewJid = settings.antiViewRoute === "me" ? ownerJid : from;
        const senderNum = (msg.key.participant || from).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

        try {
          const isImg = Boolean(voTarget.imageMessage);
          const isVid = Boolean(voTarget.videoMessage);

          if (isImg || isVid) {
            const mediaObj = isImg ? voTarget.imageMessage : voTarget.videoMessage;
            const fakeMessageToDownload = {
              key: isReplyMode ? {
                remoteJid: from,
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                participant: msg.message.extendedTextMessage.contextInfo.participant
              } : msg.key,
              message: voTarget
            };

            const buffer = await downloadMediaMessage(fakeMessageToDownload, "buffer", {}, { logger: console });

            const caption = 
`╭───『 👁 𝐀𝐍𝐓𝐈-𝐕𝐈𝐄𝐖𝐎𝐍𝐂𝐄 』───◆
│
│ 👤 *Sender:* +${senderNum}
│ 📁 *Type:* ${isImg ? "Photo" : "Video"}
│ 📝 *Caption:* ${mediaObj.caption || "No caption"}
│
╰─────────────────────────◆
> *${settings.botName}*`;

            if (isImg) {
              await sock.sendMessage(targetViewJid, { image: buffer, caption }, { quoted: msg });
            } else {
              await sock.sendMessage(targetViewJid, { video: buffer, caption }, { quoted: msg });
            }

            if (isReplyMode) return;
          }
        } catch (voErr) {}
      }

      if (from === "status@broadcast") {
        try {
          if (settings.statusSeen) {
            await sock.readMessages([msg.key]);
          }

          const senderJid = msg.key.participant || msg.participant;
          if (settings.statusReact && settings.statusReact !== "off" && senderJid) {
            await sock.sendMessage(
              senderJid,
              { react: { text: settings.statusReact, key: msg.key } },
              { statusJidList: [senderJid] }
            );
          }
        } catch (e) {}
        return;
      }

      // ════════════════ AUTO REACT SETTING ════════════════════════
      if (botFeatures?.autoReact && !msg.key.fromMe && from !== "status@broadcast") {
        try {
          const emojiList = ["❤️", "🔥", "💚", "⚡", "✨", "💯", "🥰"];
          const emoji = botFeatures?.reactEmoji || emojiList[Math.floor(Math.random() * emojiList.length)];
          await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        } catch (reactError) {
          console.warn("[AUTO-REACT] Failed:", reactError.message);
        }
      }

      if (!isOwner) {
        const mode = (settings?.workMode || "public").toLowerCase();
        if (mode === "private") return;
        if (mode === "groups" && !isGroup) return;
        if (mode === "inbox" && isGroup) return;
      }

      if (quotedMsgId && global.settingSessions.has(quotedMsgId) && (isOwner || isDev)) {
        const settingCmd = getCommand("setting");
        if (settingCmd && typeof settingCmd.execute === "function") {
          return await settingCmd.execute(sock, msg, [], from, {
            reply, isOwner, isDev, cleanBody, body, sender, DEVELOPER_NAME, DEVELOPER_NUMBER
          });
        }
      }

      if (global.evoiceEnabled === undefined) {
        try {
          const evData = await BotMeta.findOne({ key: "evoice_status" });
          global.evoiceEnabled = evData ? Boolean(evData.value) : false;
        } catch (e) {
          global.evoiceEnabled = false;
        }
      }

      const defaultPrefixes = [".", "!", "#", "/", "*", ","];
      const configuredPrefix = settings?.prefix || ".";
      const isCommandPattern = body.startsWith(configuredPrefix) || defaultPrefixes.some(p => body.startsWith(p));

      if (global.evoiceEnabled && cleanBody && !isCommandPattern) {
        const emojiVoiceMap = {
          "🙏": "https://files.catbox.moe/1e2359.opus",
          "☸️": "https://files.catbox.moe/1e2359.opus",
          "🌹": "https://files.catbox.moe/uxm1re.opus",
          "💆‍♂️": "https://files.catbox.moe/uxm1re.opus",
          "😅": "https://files.catbox.moe/cvv435.opus",
          "🤣": "https://files.catbox.moe/cvv435.opus",
          "😂": "https://files.catbox.moe/cvv435.opus",
          "🫢": "https://files.catbox.moe/i2uw0g.opus",
          "🌚": "https://files.catbox.moe/i2uw0g.opus",
          "💇‍♂️": "https://files.catbox.moe/i2uw0g.opus",
          "🫣": "https://files.catbox.moe/oqfsdl.opus",
          "🤪": "https://files.catbox.moe/oqfsdl.opus",
          "😜": "https://files.catbox.moe/oqfsdl.opus",
          "🥵": "https://files.catbox.moe/bfwnvj.opus",
          "🤤": "https://files.catbox.moe/bfwnvj.opus",
          "🍑": "https://files.catbox.moe/bfwnvj.opus",
          "🫀": "https://files.catbox.moe/bke4vj.opus",
          "💔": "https://files.catbox.moe/bke4vj.opus",
          "🙇‍♂️": "https://files.catbox.moe/bke4vj.opus",
          "🥺": "https://files.catbox.moe/o5270o.opus",
          "😭": "https://files.catbox.moe/o5270o.opus",
          "🥹": "https://files.catbox.moe/o5270o.opus"
        };

        let targetAudio = null;

        if (emojiVoiceMap[cleanBody]) {
          targetAudio = emojiVoiceMap[cleanBody];
        } else {
          for (const emoji of Object.keys(emojiVoiceMap)) {
            if (cleanBody.endsWith(emoji)) {
              targetAudio = emojiVoiceMap[emoji];
              break;
            }
          }
        }

        if (targetAudio) {
          try {
            const audioStream = await axios.get(targetAudio, {
              responseType: "arraybuffer",
              timeout: 25000,
              headers: { "User-Agent": "Mozilla/5.0" }
            });

            const voiceBuf = await convertToWhatsAppVoice(Buffer.from(audioStream.data));

            await sock.sendMessage(from, {
              audio: voiceBuf,
              mimetype: "audio/ogg; codecs=opus",
              ptt: true
            }, { quoted: msg });
            return;
          } catch (evErr) {}
        }
      }

      let matchedPrefix = null;

      if (body.startsWith(configuredPrefix)) {
        matchedPrefix = configuredPrefix;
      } else if (defaultPrefixes.some((p) => body.startsWith(p))) {
        matchedPrefix = defaultPrefixes.find((p) => body.startsWith(p));
      }

      if (!matchedPrefix) return;

      const args = body.slice(matchedPrefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      if (!commandName) return;

      const targetCommand = getCommand(commandName);

      if (settings.presence === "typing") {
        try {
          await sock.presenceSubscribe(from);
          await sock.sendPresenceUpdate("composing", from);
        } catch (e) {}
      } else if (settings.presence === "recording") {
        try {
          await sock.presenceSubscribe(from);
          await sock.sendPresenceUpdate("recording", from);
        } catch (e) {}
      } else {
        try {
          await sock.sendPresenceUpdate("paused", from);
          await sock.sendPresenceUpdate("available");
        } catch (e) {}
      }

      // ignore stale (replayed after reconnect) commands
      const msgTime = Number(msg.messageTimestamp?.low ?? msg.messageTimestamp ?? 0);
      if (msgTime && Date.now() / 1000 - msgTime > 300) return;

      if (targetCommand && typeof targetCommand.execute === "function") {
        try {
          if (botFeatures?.commandLog && !msg.key.fromMe) {
            try { await sock.sendMessage(ownerJid, { text: `🧾 Command Log\nUser: ${senderClean}\nChat: ${from}\nCommand: ${matchedPrefix}${commandName}` }); } catch (e) {}
          }
          await targetCommand.execute(sock, msg, args, from, {
            body,
            cleanBody,
            prefix: matchedPrefix,
            sender,
            isOwner,
            isDev,
            isBotOwner,
            isGroup,
            reply,
            settings,
            currentBotNumber,
            DEVELOPER_NAME,
            DEVELOPER_NUMBER,
            DEVELOPER_LID,
            botConfig
          });
        } catch (cmdErr) {
          console.error(`❌ Execution error in ${commandName}:`, cmdErr);
          await reply(`⚠️ Error executing *${commandName}*:\n_${cmdErr.message}_`);
        }
      }

    } catch (e) {
      console.error("❌ messages.upsert Error:", e);
    }
  };

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    for (const m of chatUpdate.messages || []) {
      await handleMessage(m);
    }
  });
}

onSocketCreated((sock) => {
  if (sock && global.activeBotSockets) {
    global.activeBotSockets.add(sock);
  }
  initBot(sock);
});

/* =========================================================
   WEB UI & PAIR SERVICE (FAST LIGHTWEIGHT)
========================================================= */

// ════════════════ PREMIUM BLACK & RED PAIRING WEBSITE ════════════════════════
app.get("/", (req, res) => {
  const displayLogo = JSON.stringify(BOT_LOGO || "");
  const displayName = JSON.stringify(BOT_NAME || "ZANTA-XMD");
  const developer = JSON.stringify(DEVELOPER_NAME || "ZANTA");
  res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080808">
<title>${BOT_NAME} | Premium Pairing</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark;--red:#f21d35;--bg:#080808;--muted:#96969d}*{box-sizing:border-box;margin:0;padding:0}
html{--physical-width:100vw}body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 15px;background:radial-gradient(ellipse at 50% -15%,rgba(220,15,43,.25),transparent 48%),radial-gradient(circle at 8% 80%,rgba(170,0,25,.12),transparent 28%),var(--bg);color:#fff;font-family:Inter,Arial,sans-serif}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:42px 42px}
.wrap{width:min(760px,calc(var(--physical-width) - 30px));max-width:760px;position:relative;z-index:1;animation:cardEnter .85s cubic-bezier(.2,.8,.2,1) both}@keyframes cardEnter{from{opacity:0;transform:translateY(24px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}.topline{display:flex;justify-content:center;align-items:center;gap:9px;margin-bottom:18px;color:#aaa;font-size:9px;letter-spacing:2.6px;font-weight:800;text-transform:uppercase}.topline i{width:7px;height:7px;border-radius:50%;background:var(--red);box-shadow:0 0 13px var(--red)}
.card{position:relative;overflow:hidden;padding:44px 48px 34px;border:1px solid rgba(255,255,255,.1);border-radius:26px;background:linear-gradient(145deg,rgba(25,25,27,.98),rgba(10,10,11,.98));box-shadow:0 28px 90px #000b,0 0 55px rgba(220,0,35,.09)}.card:before{content:"";position:absolute;left:12%;right:12%;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--red),transparent);box-shadow:0 0 20px var(--red)}
.brand{text-align:center}.logo-ring{width:132px;height:132px;padding:3px;margin:0 auto 17px;border-radius:50%;background:linear-gradient(145deg,#ff5264,#710012 55%,#ed1730);box-shadow:0 0 32px #f21d353d}.logo{width:100%;height:100%;object-fit:cover;border-radius:50%;border:4px solid #111}.eyebrow{margin-bottom:8px;color:#f34a5d;font-size:9px;letter-spacing:3.5px;font-weight:800;text-transform:uppercase}h1{font-family:Orbitron,Inter,sans-serif;font-size:clamp(25px,7vw,34px);letter-spacing:1px}h1 span{color:var(--red);text-shadow:0 0 22px #f21d3540}.subtitle{margin-top:12px;color:#aaa;font-size:14px;line-height:1.8}
.stats{position:relative;overflow:hidden;margin:32px 0;padding:27px 20px;border:1px solid #f21d354d;border-radius:17px;background:linear-gradient(135deg,#f21d351e,#ffffff06);text-align:center}.stats:after{content:"";position:absolute;width:130px;height:130px;right:-70px;top:-80px;border-radius:50%;background:#f21d3520}.stat-label{color:#ccc;font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase}.count{margin:9px 0 5px;font-family:Orbitron,Inter,sans-serif;font-size:clamp(64px,15vw,92px);font-weight:800;line-height:1.2;text-shadow:0 0 25px #f21d3548}.count small{margin-left:5px;color:#f04458;font:800 12px Inter;vertical-align:middle;letter-spacing:1px}.live{display:inline-flex;align-items:center;gap:7px;color:#aaa;font-size:9px;letter-spacing:1.4px;text-transform:uppercase}.live-dot{width:7px;height:7px;border-radius:50%;background:#35d987;box-shadow:0 0 10px #35d987;animation:pulse 1.5s infinite}@keyframes pulse{50%{opacity:.35}}
.form-title{margin-bottom:10px;color:#ddd;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase}.field{position:relative;margin-bottom:12px}.field span{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:#f04a5d;font-size:13px;font-weight:800}input{width:100%;height:62px;padding:0 15px 0 48px;border:1px solid #343438;border-radius:12px;outline:none;background:#09090a;color:#fff;font-size:15px}input::placeholder{color:#68686f}input:focus{border-color:var(--red);box-shadow:0 0 0 3px #f21d3520}.btn{width:100%;height:64px;border:0;border-radius:12px;background:linear-gradient(100deg,#a90720,#f21d35 55%,#c30c29);color:#fff;font-size:11px;font-weight:900;letter-spacing:1.8px;cursor:pointer;box-shadow:0 9px 25px #dc002338;transition:.2s}.btn:hover{filter:brightness(1.12);transform:translateY(-1px)}.btn:disabled{opacity:.55;cursor:wait;transform:none}#result{min-height:12px;margin-top:15px}.code-box{padding:17px 12px;border:1px dashed #f21d35b0;border-radius:14px;background:#f21d3514;text-align:center;cursor:pointer}.code-text{color:#ff5265;font:800 clamp(24px,7vw,32px) Orbitron,Inter;letter-spacing:5px}.badge{display:block;margin-top:8px;color:#d0aab0;font-size:9px;letter-spacing:1px}.error{padding:12px;border:1px solid #f21d3540;border-radius:10px;background:#f21d3518;color:#ff8794;font-size:12px;line-height:1.5}.foot{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:25px;padding-top:20px;border-top:1px solid #ffffff16;color:#ff5265;text-align:center;font-size:clamp(10px,2.7vw,15px);font-weight:900;letter-spacing:1px;text-transform:uppercase;text-shadow:0 0 16px #f21d3550}.powered-credit{display:block;line-height:1.7}.command-stats{margin-top:-12px;background:linear-gradient(135deg,#ffffff0a,#f21d3512);border-color:#ffffff24}.command-stats .count{color:#ff5265}

/* ════════════════ PREMIUM OPENING LOADER ════════════════════════ */
body{overflow-x:hidden}.loader-screen{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse at 50% 38%,#3b0710 0%,#100609 42%,#050505 78%);transition:opacity .65s ease,visibility .65s ease}.loader-screen.hide{opacity:0;visibility:hidden;pointer-events:none}.loader-content{text-align:center;width:min(420px,100%)}.loader-mark{width:126px;height:126px;margin:0 auto 27px;padding:4px;border-radius:50%;background:conic-gradient(from 0deg,#ff6475,#8c0018,#f21d35,#ff6475);box-shadow:0 0 24px #f21d3560,0 0 80px #f21d3528;animation:loaderSpin 2.4s linear infinite}.loader-mark img{width:100%;height:100%;border:5px solid #10090b;border-radius:50%;object-fit:cover;background:#111}.loader-title{font:800 clamp(25px,7vw,36px) Orbitron,Inter,sans-serif;letter-spacing:2px;color:#fff}.loader-title span{color:#f21d35;text-shadow:0 0 22px #f21d35}.loader-caption{margin-top:11px;color:#b6a7aa;font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase}.loader-track{height:4px;overflow:hidden;margin:30px auto 13px;width:min(270px,85%);border-radius:20px;background:#ffffff18}.loader-progress{height:100%;width:38%;border-radius:20px;background:linear-gradient(90deg,#8f001b,#ff304a,#ff9aa5);box-shadow:0 0 15px #f21d35;animation:loaderProgress 1.35s ease-in-out infinite}.loader-status{color:#8d8587;font-size:9px;letter-spacing:2px;text-transform:uppercase}@keyframes loaderSpin{to{transform:rotate(360deg)}}@keyframes loaderProgress{0%{transform:translateX(-110%)}100%{transform:translateX(360%)}}
@media(max-width:520px), (pointer:coarse) and (max-device-width:600px){.card{padding:30px 22px 24px;border-radius:22px}.logo-ring{width:112px;height:112px}.subtitle{font-size:12px}.stats{margin:24px 0;padding:22px 14px}.count{font-size:clamp(58px,16vw,76px)}.powered-credit{font-size:10px;letter-spacing:.45px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}


.site-user-top{position:absolute;right:0;top:-13px;display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #f21d3555;border-radius:30px;background:#10090b;color:#fff;text-decoration:none;font-size:10px;font-weight:800;z-index:3}.top-avatar{width:25px;height:25px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#a90720}.top-avatar img{width:100%;height:100%;object-fit:cover}.community{margin-top:30px;padding-top:26px;border-top:1px solid #ffffff18;text-align:left}.community-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.community h2{font:800 20px Orbitron,Inter,sans-serif}.community-links{display:flex;gap:8px;flex-wrap:wrap}.channel-link,.logout-btn{border:1px solid #f21d3566;border-radius:9px;padding:10px 12px;color:#ff6474;text-decoration:none;font-size:9px;font-weight:900;letter-spacing:1px;background:#f21d3510}.auth-box,.profile-box{padding:19px;border:1px solid #ffffff18;border-radius:15px;background:#09090a}.auth-box h3{font:700 15px Inter,sans-serif}.auth-note{margin:7px 0 14px;color:#999;font-size:12px}.auth-tabs{display:flex;gap:8px;margin-bottom:13px}.auth-tabs button{flex:1;padding:11px;border:1px solid #333;border-radius:9px;background:#111;color:#aaa;font-weight:800;font-size:10px}.auth-tabs button.active{border-color:#f21d35;color:#fff;background:#f21d3520}.auth-box input,.comment-form textarea{width:100%;height:47px;margin:0 0 10px;padding:0 13px;border:1px solid #333;border-radius:9px;background:#111;color:#fff;font:13px Inter}.auth-box .btn,.comment-form .btn{height:48px}.register-only{display:none}.auth-box.register-mode .register-only{display:block}.auth-message{margin-top:10px;color:#ff6676;font-size:11px}.profile-summary{display:flex;align-items:center;gap:12px}.profile-summary strong{display:block;font-size:14px}.profile-summary small{display:block;margin-top:5px;color:#f34a5d;font-size:9px;font-weight:800;letter-spacing:1px}.avatar{width:44px;height:44px;flex:0 0 44px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#a90720,#f21d35);font-weight:900;overflow:hidden}.avatar img,.comment-avatar img{width:100%;height:100%;object-fit:cover}.logout-btn{margin-left:auto;cursor:pointer}.avatar-upload{display:inline-block;margin:14px 0 0 56px;color:#ff6474;font-size:9px;font-weight:900;letter-spacing:1px;cursor:pointer}.avatar-upload input{display:none}.comment-form{margin:17px 0}.comment-form textarea{height:90px;padding:13px;resize:vertical}.comments-list{display:grid;gap:12px}.comment-card{padding:14px;border:1px solid #ffffff17;border-radius:13px;background:#0b0b0c}.comment-user{display:flex;align-items:center;gap:9px}.comment-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#9e1025;font-weight:900;font-size:12px}.comment-user strong{font-size:12px}.comment-user small{display:block;margin-top:3px;color:#777;font-size:9px}.comment-body{margin:12px 0;color:#ddd;font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}.comment-actions{display:flex;gap:8px;flex-wrap:wrap}.comment-actions button,.reply-form button{padding:7px 10px;border:1px solid #ffffff20;border-radius:8px;background:#141416;color:#ddd;font-size:10px;cursor:pointer}.comment-actions button.active{border-color:#f21d35;color:#ff6375}.reply-list{display:grid;gap:8px;margin:12px 0 0 16px;padding-left:12px;border-left:1px solid #f21d3555}.reply-item{color:#bbb;font-size:11px;line-height:1.5}.reply-item b{color:#fff}.reply-form{display:flex;gap:7px;margin-top:10px}.reply-form input{height:36px;min-width:0;flex:1;padding:0 9px;border:1px solid #333;border-radius:8px;background:#111;color:#fff;font-size:11px}.empty-comments{padding:22px;text-align:center;color:#777;font-size:12px}.foot{margin-top:26px}@media(max-width:560px){.card{padding:30px 18px 25px}.community-head{align-items:flex-start;flex-direction:column}.channel-link{align-self:flex-start}.community-links{flex-wrap:wrap}.profile-summary{gap:9px}}
</style></head><body>
<div class="loader-screen" id="siteLoader" role="status" aria-label="Loading ZANTA-XMD pairing site"><div class="loader-content"><div class="loader-mark"><img id="loaderLogo" alt=""></div><div class="loader-title"><span id="loaderBrand">ZANTA-XMD</span></div><div class="loader-caption">Premium Pairing Portal</div><div class="loader-track"><div class="loader-progress"></div></div><div class="loader-status">Initializing secure connection...</div></div></div>
<main class="wrap"><div class="topline"><i></i> Official Multi-Device Pairing Portal <i></i></div><a href="#community" id="siteUserTop" class="site-user-top" hidden><span id="siteUserTopAvatar" class="top-avatar">Z</span><span id="siteUserTopName">LOGIN</span></a><section class="card">
<header class="brand"><div class="logo-ring"><img id="brandLogo" class="logo" alt="Bot logo"></div><div class="eyebrow">Premium WhatsApp Connection</div><h1><span id="brandName">ZANTA-XMD</span></h1><p class="subtitle">Securely connect your WhatsApp account<br>with a simple pairing code.</p></header>
<section class="stats" aria-live="polite"><div class="stat-label">Total Connected Bots</div><div class="count"><span id="botCount">—</span><small>BOTS</small></div><div class="live"><i class="live-dot"></i><span id="statStatus">Live database count</span></div></section>
<section class="stats command-stats" aria-live="polite"><div class="stat-label">Total Commands</div><div class="count"><span id="commandCount">—</span><small>COMMANDS</small></div><div class="live"><i class="live-dot"></i><span id="commandStatus">Live command registry</span></div></section>
<div class="form-title">Connect your WhatsApp</div><div class="field"><span>+94</span><input id="number" type="tel" inputmode="numeric" placeholder="7XXXXXXXX" autocomplete="tel-national" maxlength="12"></div><button id="pairBtn" class="btn" onclick="getCode()">GENERATE PAIR CODE&nbsp; ↗</button><div id="result"></div>
<section class="community" id="community">
<div class="community-head"><div><div class="form-title">ZANTA COMMUNITY</div><h2>Community Comments</h2></div><div class="community-links"><a class="channel-link" href="https://wa.me/94760879639" target="_blank" rel="noopener">OWNER WHATSAPP ↗</a><a class="channel-link" href="https://whatsapp.com/channel/0029VbDohvvHgZWVCvty5r3X" target="_blank" rel="noopener">JOIN CHANNEL ↗</a></div></div>
<div id="authArea" class="auth-box"><h3>Welcome to ZANTA-XMD</h3><p class="auth-note">Login or create your account to join the community.</p><div class="auth-tabs"><button type="button" class="active" id="loginTab" onclick="showAuth('login')">LOGIN</button><button type="button" id="registerTab" onclick="showAuth('register')">REGISTER</button></div><form id="authForm"><input id="authUsername" autocomplete="username" placeholder="Username" maxlength="24" required><input id="authPassword" type="password" autocomplete="current-password" placeholder="Password" required><input id="authDisplayName" class="register-only" autocomplete="name" placeholder="Display name" maxlength="32"><button class="btn" id="authSubmit">LOGIN</button></form><div id="authMessage" class="auth-message"></div></div>
<div id="profileArea" class="profile-box" hidden><div class="profile-summary"><div id="profileAvatar" class="avatar">Z</div><div><strong id="profileName"></strong><small id="profileRole">MEMBER</small></div><button type="button" class="logout-btn" onclick="logoutSite()">LOG OUT</button></div><label class="avatar-upload">CHANGE PROFILE LOGO<input type="file" id="avatarFile" accept="image/png,image/jpeg,image/webp"></label></div>
<div id="commentArea" hidden><form id="commentForm" class="comment-form"><textarea id="commentText" maxlength="1000" placeholder="Write a comment..." required></textarea><button class="btn" type="submit">POST COMMENT</button></form><div id="commentsList" class="comments-list"></div></div>
</section>
</section>
<footer class="foot"><span class="powered-credit">𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐲 - : 𝐌𝐑 𝐒𝐔𝐑𝐀𝐍𝐆𝐀 𝐎𝐅𝐂 💖</span></footer></section></main>
<script>
const BOT_LOGO=${displayLogo},BOT_NAME=${displayName};document.documentElement.style.setProperty('--physical-width',Math.min(window.screen.width||window.innerWidth,window.innerWidth)+'px');document.getElementById('brandLogo').src=BOT_LOGO;document.getElementById('loaderLogo').src=BOT_LOGO;document.getElementById('brandName').textContent=BOT_NAME;document.getElementById('loaderBrand').textContent=BOT_NAME;let currentCode='';
function hideSiteLoader(){const loader=document.getElementById('siteLoader');if(loader){loader.classList.add('hide');document.body.style.overflowY='auto';setTimeout(()=>loader.remove(),750)}}document.body.style.overflow='hidden';window.addEventListener('load',()=>setTimeout(hideSiteLoader,900),{once:true});setTimeout(hideSiteLoader,2800);
function copyCode(){if(!currentCode)return;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(currentCode).catch(()=>{});const b=document.getElementById('copyBadge');if(b)b.textContent='COPIED · TAP TO COPY AGAIN'}
async function refreshBotCount(){const el=document.getElementById('botCount'),st=document.getElementById('statStatus'),cmdEl=document.getElementById('commandCount'),cmdSt=document.getElementById('commandStatus');try{const r=await fetch('/api/stats',{cache:'no-store'});const d=await r.json();if(!r.ok&&d.database!=='disconnected')throw Error('unavailable');el.textContent=Number(d.totalBots||0).toLocaleString();cmdEl.textContent=Number(d.totalCommands||0).toLocaleString();st.textContent=d.database==='connected'?'LIVE · UPDATING AUTOMATICALLY':'DATABASE DISCONNECTED';cmdSt.textContent='LIVE · LOADED COMMANDS';}catch(e){st.textContent='BOT COUNT TEMPORARILY UNAVAILABLE';cmdSt.textContent='COMMAND COUNT TEMPORARILY UNAVAILABLE'}}refreshBotCount();setInterval(refreshBotCount,10000);
async function getCode(){const input=document.getElementById('number'),btn=document.getElementById('pairBtn'),result=document.getElementById('result');let num=input.value.replace(/\D/g,'').trim();if(num.startsWith('0'))num='94'+num.slice(1);else if(!num.startsWith('94'))num='94'+num;if(!/^94[0-9]{9}$/.test(num)){result.innerHTML='<div class="error">Please enter a valid Sri Lankan mobile number (07XXXXXXXX).</div>';return}btn.disabled=true;btn.textContent='GENERATING SECURE CODE...';result.innerHTML='<div style="color:#ccc;text-align:center;font-size:12px;padding:10px">Connecting to WhatsApp securely...</div>';try{const r=await fetch('/pair?num='+encodeURIComponent(num)),d=await r.json();if(d.code){currentCode=d.code;result.innerHTML='<div class="code-box" onclick="copyCode()"><div class="code-text"></div><span id="copyBadge" class="badge">TAP TO COPY YOUR PAIR CODE</span></div>';result.querySelector('.code-text').textContent=d.code;copyCode()}else{const e=document.createElement('div');e.className='error';e.textContent=d.error||'Unable to generate pairing code. Please try again.';result.replaceChildren(e)}}catch(e){result.innerHTML='<div class="error">Server connection timed out. Please try again.</div>'}finally{btn.disabled=false;btn.textContent='GENERATE PAIR CODE  ↗'}}document.getElementById('number').addEventListener('keydown',e=>{if(e.key==='Enter')getCode()});
let authMode='login',siteMe=null;
function showAuth(mode){authMode=mode;const box=document.getElementById('authArea');box.classList.toggle('register-mode',mode==='register');document.getElementById('loginTab').classList.toggle('active',mode==='login');document.getElementById('registerTab').classList.toggle('active',mode==='register');document.getElementById('authSubmit').textContent=mode==='login'?'LOGIN':'CREATE ACCOUNT';document.getElementById('authPassword').autocomplete=mode==='login'?'current-password':'new-password';document.getElementById('authMessage').textContent=''}
function setAvatar(el,user){el.textContent='';if(user.avatarData){const im=document.createElement('img');im.src=user.avatarData;im.alt='Profile';el.appendChild(im)}else el.textContent=(user.displayName||user.username||'Z').trim().charAt(0).toUpperCase()}
function updateTopUser(user){const a=document.getElementById('siteUserTop');a.hidden=!user;if(user){document.getElementById('siteUserTopName').textContent=user.displayName||user.username;setAvatar(document.getElementById('siteUserTopAvatar'),user)}}
async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const d=await r.json().catch(()=>({error:'Invalid server response'}));if(!r.ok)throw Error(d.error||'Request failed');return d}
async function loadSite(){try{const d=await api('/api/site/me');siteMe=d.user;updateTopUser(siteMe);if(!siteMe){document.getElementById('authArea').hidden=false;document.getElementById('profileArea').hidden=true;document.getElementById('commentArea').hidden=true;return}document.getElementById('authArea').hidden=true;document.getElementById('profileArea').hidden=false;document.getElementById('commentArea').hidden=false;document.getElementById('profileName').textContent=siteMe.displayName+' (@'+siteMe.username+')';document.getElementById('profileRole').textContent=siteMe.isOwner?'OWNER ACCOUNT':'COMMUNITY MEMBER';setAvatar(document.getElementById('profileAvatar'),siteMe);await loadComments()}catch(e){console.warn('Site account load:',e.message)}}
document.getElementById('authForm').addEventListener('submit',async e=>{e.preventDefault();const msg=document.getElementById('authMessage'),btn=document.getElementById('authSubmit');btn.disabled=true;msg.textContent='Please wait...';try{const body={username:document.getElementById('authUsername').value.trim(),password:document.getElementById('authPassword').value};if(authMode==='register')body.displayName=document.getElementById('authDisplayName').value.trim();const d=await api('/api/site/'+authMode,{method:'POST',body:JSON.stringify(body)});siteMe=d.user;msg.textContent='';await loadSite()}catch(err){msg.textContent=err.message}finally{btn.disabled=false}});
async function logoutSite(){try{await api('/api/site/logout',{method:'POST',body:'{}'});siteMe=null;document.getElementById('authPassword').value='';await loadSite()}catch(e){alert(e.message)}}
document.getElementById('avatarFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>1024*1024){alert('Profile image must be 1 MB or smaller.');e.target.value='';return}if(!/^image\/(png|jpeg|webp)$/.test(file.type)){alert('Use PNG, JPG or WEBP.');return}const reader=new FileReader();reader.onload=async()=>{try{await api('/api/site/avatar',{method:'POST',body:JSON.stringify({avatarData:reader.result})});await loadSite()}catch(err){alert(err.message)}};reader.readAsDataURL(file)});
document.getElementById('commentForm').addEventListener('submit',async e=>{e.preventDefault();const input=document.getElementById('commentText'),text=input.value.trim();if(!text)return;try{await api('/api/site/comments',{method:'POST',body:JSON.stringify({text})});input.value='';await loadComments()}catch(err){alert(err.message)}});
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
async function loadComments(){const box=document.getElementById('commentsList');try{const d=await api('/api/site/comments');box.replaceChildren();if(!d.comments.length){box.appendChild(node('div','empty-comments','No comments yet. Be the first to share your thoughts ❤️'));return}for(const c of d.comments){const card=node('article','comment-card'),head=node('div','comment-user'),av=node('div','comment-avatar');setAvatar(av,{displayName:c.displayName,username:c.username,avatarData:c.avatarData});head.append(av);const name=node('div','',c.displayName+' (@'+c.username+')');name.appendChild(node('small','',new Date(c.createdAt).toLocaleString()));head.append(name);card.append(head,node('div','comment-body',c.text));const actions=node('div','comment-actions');for(const emoji of ['❤️','👍','🔥','😂']){const b=node('button',Object.keys(c.reactions||{}).some(k=>k===emoji&&c.reactions[k].includes(siteMe.username))?'active':'',emoji+' '+((c.reactions&&c.reactions[emoji]||[]).length));b.type='button';b.onclick=async()=>{try{await api('/api/site/comments/'+c._id+'/react',{method:'POST',body:JSON.stringify({emoji})});await loadComments()}catch(e){alert(e.message)}};actions.append(b)}const replyBtn=node('button','','REPLY');replyBtn.type='button';replyBtn.onclick=()=>{const f=card.querySelector('.reply-form');if(f)f.hidden=!f.hidden};actions.append(replyBtn);if(siteMe.isOwner){const del=node('button','','DELETE');del.type='button';del.onclick=async()=>{if(!confirm('Delete this comment and its replies?'))return;try{await api('/api/site/comments/'+c._id,{method:'DELETE'});await loadComments()}catch(e){alert(e.message)}};actions.append(del)}card.append(actions);if(c.replies&&c.replies.length){const replies=node('div','reply-list');for(const r of c.replies)replies.append(node('div','reply-item',r.displayName+' (@'+r.username+'): '+r.text));card.append(replies)}const form=node('form','reply-form');form.hidden=true;const inp=node('input');inp.placeholder='Write a reply...';inp.maxLength=500;const send=node('button','', 'SEND');send.type='submit';form.append(inp,send);form.onsubmit=async ev=>{ev.preventDefault();try{await api('/api/site/comments/'+c._id+'/reply',{method:'POST',body:JSON.stringify({text:inp.value.trim()})});await loadComments()}catch(e){alert(e.message)}};card.append(form);box.append(card)}}catch(e){box.replaceChildren(node('div','empty-comments',e.message))}}
loadSite();

</script></body></html>`);
});

// ════════════════ WEBSITE ACCOUNT / COMMUNITY API ════════════════════════
app.post("/api/site/register", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({error:"Database is not ready."});
    const username=String(req.body?.username||"").trim().toLowerCase();
    const displayName=String(req.body?.displayName||"").trim();
    const password=String(req.body?.password||"");
    if(!/^[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({error:"Username must be 3-24 characters (letters, numbers, underscore)."});
    if(username===OWNER_USERNAME) return res.status(409).json({error:"This username is reserved."});
    if(displayName.length<2||displayName.length>32) return res.status(400).json({error:"Display name must be 2-32 characters."});
    if(password.length<8||password.length>128) return res.status(400).json({error:"Password must be 8-128 characters."});
    const salt=crypto.randomBytes(16).toString("hex"); const passwordHash=await hashSitePassword(password,salt);
    const user=await SiteUser.create({username,displayName,passwordSalt:salt,passwordHash,role:"user"});
    res.cookie("zanta_site_session",createSiteCookie(user),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:7*86400000,path:"/"});
    return res.status(201).json({success:true,user:publicSiteUser(user)});
  } catch(e) { if(e.code===11000)return res.status(409).json({error:"That username is already taken."}); console.error("Site register:",e.message); return res.status(500).json({error:"Could not create account."}); }
});
app.post("/api/site/login", async (req,res)=>{
  try {
    if(mongoose.connection.readyState!==1)return res.status(503).json({error:"Database is not ready."});
    const username=String(req.body?.username||"").trim().toLowerCase(); const password=String(req.body?.password||"");
    if(username===OWNER_USERNAME){
      if(!OWNER_PASSWORD||!safeEqual(password,OWNER_PASSWORD))return res.status(401).json({error:"Invalid username or password."});
      let owner=await SiteUser.findOne({username:OWNER_USERNAME});
      if(!owner){const salt=crypto.randomBytes(16).toString("hex");owner=await SiteUser.create({username:OWNER_USERNAME,displayName:"ZANTA OWNER",passwordSalt:salt,passwordHash:await hashSitePassword(crypto.randomBytes(32).toString("hex"),salt),role:"owner"});}
      else if(owner.role!=="owner"){owner.role="owner";await owner.save();}
      res.cookie("zanta_site_session",createSiteCookie(owner),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:7*86400000,path:"/"});
      return res.json({success:true,user:publicSiteUser(owner)});
    }
    const user=await SiteUser.findOne({username}); if(!user)return res.status(401).json({error:"Invalid username or password."});
    const candidate=await hashSitePassword(password,user.passwordSalt); if(!safeEqual(candidate,user.passwordHash))return res.status(401).json({error:"Invalid username or password."});
    res.cookie("zanta_site_session",createSiteCookie(user),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:7*86400000,path:"/"});
    return res.json({success:true,user:publicSiteUser(user)});
  }catch(e){console.error("Site login:",e.message);return res.status(500).json({error:"Login failed."});}
});
app.get("/api/site/me",async(req,res)=>{try{return res.json({user:publicSiteUser(await getSiteUser(req))})}catch(e){return res.status(500).json({error:"Could not load profile."})}});
app.post("/api/site/logout",(req,res)=>{res.clearCookie("zanta_site_session",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/"});res.json({success:true})});
app.post("/api/site/avatar",async(req,res)=>{try{const user=await getSiteUser(req);if(!user)return res.status(401).json({error:"Please login first."});const data=String(req.body?.avatarData||"");if(data && (!/^data:image\/(png|jpeg|webp);base64,/.test(data)||data.length>1400000))return res.status(400).json({error:"Invalid image. Use PNG/JPG/WEBP up to 1 MB."});await SiteUser.updateOne({_id:user._id},{$set:{avatarData:data}});res.json({success:true})}catch(e){res.status(500).json({error:"Could not update profile logo."})}});
app.get("/api/site/comments",async(req,res)=>{try{const rows=await SiteComment.find({}).sort({createdAt:-1}).limit(100).lean();const ids=[...new Set(rows.flatMap(c=>[String(c.userId),...(c.replies||[]).map(r=>String(r.userId))]))];const users=await SiteUser.find({_id:{$in:ids}}).select("username displayName avatarData").lean();const map=new Map(users.map(u=>[String(u._id),u]));const comments=rows.map(c=>{const u=map.get(String(c.userId))||{};return {_id:c._id,username:c.username,displayName:u.displayName||c.username,avatarData:u.avatarData||c.avatarData||"",text:c.text,reactions:c.reactions||{},createdAt:c.createdAt,replies:(c.replies||[]).map(r=>{const ru=map.get(String(r.userId))||{};return {username:r.username,displayName:ru.displayName||r.username,text:r.text,createdAt:r.createdAt}})}});res.json({comments})}catch(e){res.status(500).json({error:"Could not load comments."})}});
app.post("/api/site/comments",async(req,res)=>{try{const u=await getSiteUser(req);if(!u)return res.status(401).json({error:"Please login first."});const text=String(req.body?.text||"").trim();if(!text||text.length>1000)return res.status(400).json({error:"Comment must be 1-1000 characters."});await SiteComment.create({userId:u._id,username:u.username,avatarData:u.avatarData||"",text});res.json({success:true})}catch(e){res.status(500).json({error:"Could not post comment."})}});
app.post("/api/site/comments/:id/reply",async(req,res)=>{try{const u=await getSiteUser(req);if(!u)return res.status(401).json({error:"Please login first."});const text=String(req.body?.text||"").trim();if(!text||text.length>500)return res.status(400).json({error:"Reply must be 1-500 characters."});const c=await SiteComment.findById(req.params.id);if(!c)return res.status(404).json({error:"Comment not found."});if(c.replies.length>=50)return res.status(400).json({error:"Reply limit reached."});c.replies.push({userId:u._id,username:u.username,avatarData:u.avatarData||"",text});await c.save();res.json({success:true})}catch(e){res.status(500).json({error:"Could not post reply."})}});
app.post("/api/site/comments/:id/react",async(req,res)=>{try{const u=await getSiteUser(req);if(!u)return res.status(401).json({error:"Please login first."});const emoji=String(req.body?.emoji||"");if(!["❤️","👍","🔥","😂"].includes(emoji))return res.status(400).json({error:"Unsupported reaction."});const c=await SiteComment.findById(req.params.id);if(!c)return res.status(404).json({error:"Comment not found."});const reactions=c.reactions&&typeof c.reactions.toObject==="function"?c.reactions.toObject():{...(c.reactions||{})};const list=Array.isArray(reactions[emoji])?reactions[emoji]:[];reactions[emoji]=list.includes(u.username)?list.filter(x=>x!==u.username):[...list.filter(x=>x!==u.username),u.username];c.reactions=reactions; c.markModified("reactions");await c.save();res.json({success:true})}catch(e){res.status(500).json({error:"Could not save reaction."})}});
app.delete("/api/site/comments/:id",async(req,res)=>{try{const u=await getSiteUser(req);if(!u||!u.isOwner)return res.status(403).json({error:"Only the owner account can delete comments."});const result=await SiteComment.deleteOne({_id:req.params.id});if(!result.deletedCount)return res.status(404).json({error:"Comment not found."});res.json({success:true})}catch(e){res.status(500).json({error:"Could not delete comment."})}});

// ════════════════ LIVE MONGODB BOT COUNT API ════════════════════════
// Count persistent WhatsApp sessions stored in darkdinusessions.
app.get("/api/stats", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ totalBots: 0, totalCommands: commands.size, database: "disconnected" });
    const totalBots = await mongoose.connection.db.collection("darkdinusessions").countDocuments({});
    const totalCommands = commands.size;
    return res.json({ totalBots, totalCommands, database: "connected", updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("❌ Live bot count error:", error.message);
    return res.status(500).json({ totalBots: 0, totalCommands: commands.size, database: "error" });
  }
});

// Website command testing has been removed.
app.get("/pair", async (req, res) => {
  if (pairingInProgress) {
    return res.status(429).json({ error: "Another pairing is in progress. Please wait a moment." });
  }

  let number = String(req.query.num || "").replace(/[^0-9]/g, "");
  if (number.startsWith("0")) number = "94" + number.substring(1);
  if (!/^94[0-9]{9}$/.test(number)) {
    return res.status(400).json({ error: "Invalid Sri Lankan phone number." });
  }

  pairingInProgress = true;
  try {
    const result = await requestPairCode(number);
    return res.json({ success: true, code: result.code });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to get pairing code." });
  } finally {
    pairingInProgress = false;
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "alive",
    bot: BOT_NAME,
    uptime: process.uptime(),
    activeBots: global.activeBotSockets ? global.activeBotSockets.size : 0
  });
});

// keep in-memory session maps from growing forever
setInterval(() => {
  for (const name of ["msgStore", "songSessions", "tiktokSessions", "fbSessions", "videoSessions", "settingSessions"]) {
    const map = global[name];
    if (!map) continue;
    const limit = name === "msgStore" ? 1000 : 200;
    while (map.size > limit) map.delete(map.keys().next().value);
  }
}, 5 * 60 * 1000).unref();

async function connectMongo() {
  if (!MONGO_URI) {
    console.error("❌ MONGODB_URI is missing. Add it to your .env file.");
    return false;
  }
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`🔄 Connecting to MongoDB... (try ${attempt}/5)`);
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxPoolSize: 10
      });
      console.log("\x1b[32m%s\x1b[0m", "✅ [DATABASE] MongoDB connected!");
      return true;
    } catch (err) {
      console.error(`❌ MongoDB connection error: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  return false;
}

async function start() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ${BOT_NAME} RUNNING ON PORT: ${PORT}`);
  });

  const connected = await connectMongo();
  if (!connected) return;

  restoreCredentials().catch((err) => {
    console.error("❌ Session restore error:", err.message);
  });
}

const shutdown = async () => {
  try { await mongoose.disconnect(); } catch (e) {}
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();

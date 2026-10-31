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
const axios = require("axios");
const { execFile } = require("child_process");

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { getBotSettings } = require("./lib/settingsHelper");
const { getFeatures, getBanned, isBanned } = require("./lib/featureStore");

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MetaSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const BotMeta = mongoose.models.ZantaMeta || mongoose.model("ZantaMeta", MetaSchema, "darkdinumetas");

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
      title: "⚙️ BOT SETTINGS",
      body: "Bot configuration commands\n\n• .setting\n• .setname <name>\n• .setprefix <prefix>\n• .setmode public/private\n• .setpresence typing/recording\n• .setlogo <image URL>",
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
  if (!sock || !sock.ev) return;
  if (sock._isInitialized) return;
  sock._isInitialized = true;

  if (global.activeBotSockets) {
    global.activeBotSockets.add(sock);
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;

    if (connection === "open") {
      if (global.activeBotSockets) global.activeBotSockets.add(sock);
      sock._countedAsActive = true;
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

  // ════════════════ ANTI CALL EVENT HANDLER ═════════════════════════
  // Rejects incoming WhatsApp calls only when this bot account has Anti Call enabled.
  sock.ev.on("call", async (callUpdates) => {
    try {
      const currentBotNumber = String(sock.user?.id || "")
        .split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
      if (!currentBotNumber) return;
      const featureSettings = await getFeatures(currentBotNumber);
      if (featureSettings.antiCall !== true) return;

      const calls = Array.isArray(callUpdates) ? callUpdates : [callUpdates];
      for (const call of calls) {
        if (!call || !call.id || !call.from) continue;
        if (call.status && call.status !== "offer") continue;
        if (typeof sock.rejectCall === "function") {
          await sock.rejectCall(call.id, call.from);
          console.log("📵 [ZANTA-XMD] Incoming call rejected by Anti Call.");
        } else {
          console.warn("⚠️ [ZANTA-XMD] rejectCall() is not available in this Baileys version.");
        }
      }
    } catch (callError) {
      console.error("[ANTI CALL] Handler error:", callError.message);
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
          .replace(/@group/gi, groupName);

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

      // ════════════════ BOT COMMAND BAN ENFORCEMENT ═════════════════
      // Users in this bot account's ban list cannot use bot features/commands.
      if (!isOwner) {
        const bannedUsers = await getBanned(currentBotNumber);
        if (isBanned(bannedUsers, sender)) return;
      }

      const body = extractMessageBody(msg);
      const cleanBody = body.trim();

      // ════════════════ AUTO REACT ENFORCEMENT ═════════════════════
      // Reacts to incoming user messages when Auto React is enabled.
      if (!msg.key.fromMe && from !== "status@broadcast" &&
          !msg.message?.reactionMessage && !msg.message?.protocolMessage) {
        try {
          const featureSettings = await getFeatures(currentBotNumber);
          if (featureSettings.autoReact === true) {
            await sock.sendMessage(from, {
              react: { text: "❤️", key: msg.key }
            });
          }
        } catch (autoReactError) {
          console.warn("[AUTO REACT] Could not react:", autoReactError.message);
        }
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
      if (protocolMsg && protocolMsg.type === 0) {
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

      if (voTarget && (!msg.key.fromMe || isReplyMode)) {
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

  // ════════════════ LIVE ACTIVE BOT COUNTER ═════════════════
  sock.ev.on("connection.update", (update) => {
    if (update.connection === "open") {
      if (global.activeBotSockets) global.activeBotSockets.add(sock);
      sock._countedAsActive = true;
    } else if (update.connection === "close") {
      if (global.activeBotSockets) global.activeBotSockets.delete(sock);
      sock._countedAsActive = false;
    }
  });

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    for (const m of chatUpdate.messages || []) {
      await handleMessage(m);
    }
  });
}

onSocketCreated((sock) => {
  initBot(sock);
});

/* =========================================================
   WEB UI & PAIR SERVICE (FAST LIGHTWEIGHT)
========================================================= */

app.get("/", (req, res) => {
  const displayLogo = String(BOT_LOGO || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const developer = String(DEVELOPER_NAME || "ZANTA-XMD TEAM").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#09090d">
  <meta name="description" content="ZANTA-XMD WhatsApp multi-device pairing portal and live bot status.">
  <title>ZANTA-XMD • PAIR PORTAL</title>
  <style>
    :root{color-scheme:dark;--red:#ff2438;--red2:#b90020;--bg:#08080c;--panel:#111117;--muted:#a5a5b2;--line:rgba(255,48,68,.22)}
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:radial-gradient(ellipse at 50% -15%,rgba(255,25,50,.23),transparent 42%),linear-gradient(145deg,#08080c,#101016 55%,#08080c);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:30px 16px;display:flex;align-items:center;justify-content:center;overflow-x:hidden}
    .shell{width:min(100%,760px);margin:auto}
    .topline{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;color:#c5c5ce;font-size:12px;letter-spacing:2px;text-transform:uppercase}
    .brandmark{display:flex;align-items:center;gap:10px;font-weight:900;color:#fff}.brandmark i{width:10px;height:10px;border-radius:50%;background:var(--red);box-shadow:0 0 18px var(--red);display:inline-block}
    .live-pill{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:rgba(255,36,56,.08);padding:8px 12px;border-radius:99px;color:#ff9aa5;letter-spacing:1px;font-size:10px}
    .live-dot{width:7px;height:7px;border-radius:50%;background:#ff3045;box-shadow:0 0 12px #ff3045;animation:pulse 1.5s infinite}
    @keyframes pulse{50%{opacity:.35;transform:scale(.75)}}
    .hero{text-align:center;padding:30px 18px 24px}
    .logo-wrap{width:116px;height:116px;margin:0 auto 18px;padding:4px;border-radius:50%;background:linear-gradient(135deg,#ff6472,#8d0017 55%,#ff2438);box-shadow:0 0 0 8px rgba(255,36,56,.06),0 0 45px rgba(255,36,56,.28)}
    .logo{width:100%;height:100%;border-radius:50%;object-fit:cover;background:#17171e;border:3px solid #0c0c11}
    h1{font-size:clamp(34px,7vw,58px);line-height:1;font-weight:1000;letter-spacing:3px;text-shadow:0 0 28px rgba(255,36,56,.25)}
    h1 span{color:var(--red)}
    .subtitle{margin-top:12px;color:#aaaab6;font-size:13px;letter-spacing:2px;text-transform:uppercase}
    .hero-line{height:2px;width:110px;margin:22px auto 0;background:linear-gradient(90deg,transparent,var(--red),transparent)}
    .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:8px 0 22px}
    .stat{background:linear-gradient(145deg,rgba(27,27,36,.96),rgba(15,15,21,.96));border:1px solid var(--line);border-radius:17px;padding:17px 12px;text-align:center;box-shadow:inset 0 1px rgba(255,255,255,.025)}
    .stat-label{font-size:10px;color:#9c9ca9;letter-spacing:1.3px;text-transform:uppercase}
    .stat-value{font-size:clamp(21px,4vw,30px);font-weight:900;color:#fff;margin-top:7px;white-space:nowrap}
    .stat-value.red{color:#ff4052;text-shadow:0 0 18px rgba(255,36,56,.28)}
    .stat-note{font-size:10px;color:#777783;margin-top:4px}
    .main-card{background:linear-gradient(155deg,rgba(24,24,32,.98),rgba(13,13,19,.98));border:1px solid rgba(255,45,64,.3);border-radius:24px;padding:clamp(22px,5vw,36px);box-shadow:0 24px 70px rgba(0,0,0,.48),0 0 45px rgba(255,36,56,.07);position:relative;overflow:hidden}
    .main-card:before{content:"";position:absolute;left:10%;right:10%;top:0;height:1px;background:linear-gradient(90deg,transparent,#ff4355,transparent)}
    .section-title{font-size:18px;font-weight:900;letter-spacing:1.5px}.section-desc{font-size:13px;color:var(--muted);margin-top:7px;line-height:1.6}
    .field-label{display:block;text-align:left;color:#c7c7d0;font-size:11px;font-weight:800;letter-spacing:1.4px;margin:25px 0 9px;text-transform:uppercase}
    .phone-wrap{display:flex;align-items:center;background:#09090e;border:1px solid #38303a;border-radius:14px;padding:0 15px;transition:.2s}
    .phone-wrap:focus-within{border-color:var(--red);box-shadow:0 0 0 3px rgba(255,36,56,.12)}
    .country{color:#ff5969;font-weight:900;border-right:1px solid #37303a;padding:14px 13px 14px 0;margin-right:12px}
    input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:#fff;padding:16px 0;font-size:17px;letter-spacing:1px}
    input::placeholder{color:#62626d;letter-spacing:.4px}
    .pair-btn{width:100%;border:0;border-radius:14px;margin-top:15px;padding:17px 20px;background:linear-gradient(100deg,#ff3045,#c90024);color:#fff;font-size:14px;font-weight:1000;letter-spacing:2px;cursor:pointer;box-shadow:0 10px 28px rgba(220,0,35,.25);transition:transform .2s,filter .2s}
    .pair-btn:hover{filter:brightness(1.12);transform:translateY(-2px)}.pair-btn:disabled{opacity:.55;cursor:wait;transform:none}
    .hint{text-align:center;color:#777783;font-size:11px;margin-top:12px;line-height:1.6}
    #result{margin-top:18px}.result-box{background:#09090e;border:1px solid rgba(255,36,56,.55);border-radius:15px;padding:17px;text-align:center}
    .result-label{font-size:10px;letter-spacing:2px;color:#aaaab6}.code-text{font-size:clamp(27px,7vw,36px);font-weight:1000;letter-spacing:7px;color:#ff4055;margin:10px 0;text-shadow:0 0 22px rgba(255,36,56,.3);overflow-wrap:anywhere}
    .copy-btn{background:#241017;border:1px solid rgba(255,36,56,.5);color:#ff8a96;padding:10px 18px;border-radius:10px;font-weight:800;cursor:pointer}
    .error{background:rgba(255,36,56,.08);border:1px solid rgba(255,36,56,.3);color:#ff9ba5;padding:12px;border-radius:12px;font-size:13px;line-height:1.5}
    .service-row{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;color:#777783;font-size:11px}.service-row b{color:#d7d7df}
    footer{text-align:center;color:#777783;font-size:11px;margin:22px 0 4px;letter-spacing:1px}footer strong{color:#ff5969}
    @media(max-width:520px){body{padding:18px 12px}.topline{font-size:9px;letter-spacing:1px}.hero{padding:22px 8px}.logo-wrap{width:94px;height:94px}.stats{gap:7px}.stat{padding:13px 5px;border-radius:13px}.stat-label{font-size:8px;letter-spacing:.7px}.stat-note{font-size:9px}.main-card{border-radius:19px}}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
  </style>
</head>
<body>
  <main class="shell">
    <div class="topline"><div class="brandmark"><i></i> ZANTA-XMD SYSTEM</div><div class="live-pill"><span class="live-dot"></span> LIVE MONITOR</div></div>
    <header class="hero">
      <div class="logo-wrap"><img class="logo" src="${displayLogo}" alt="ZANTA-XMD logo" onerror="this.style.opacity='.15'"></div>
      <h1>ZANTA<span>-XMD</span></h1>
      <p class="subtitle">WhatsApp Multi-Device Pairing Portal</p>
      <div class="hero-line"></div>
    </header>
    <section class="stats" aria-label="Live system statistics">
      <div class="stat"><div class="stat-label">Active Bots</div><div class="stat-value red" id="activeBots">--</div><div class="stat-note">Connected sessions</div></div>
      <div class="stat"><div class="stat-label">System Uptime</div><div class="stat-value" id="uptime">--</div><div class="stat-note">Web service runtime</div></div>
      <div class="stat"><div class="stat-label">Database</div><div class="stat-value" id="database">--</div><div class="stat-note" id="dbNote">Connection status</div></div>
    </section>
    <section class="main-card">
      <div class="section-title">PAIR YOUR WHATSAPP</div>
      <p class="section-desc">Enter your WhatsApp number to generate a secure device-linking code. Open WhatsApp → Linked Devices → Link a Device.</p>
      <label class="field-label" for="number">WhatsApp phone number</label>
      <div class="phone-wrap"><span class="country">+94</span><input id="number" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="7XXXXXXXX" maxlength="12"></div>
      <button id="pairBtn" class="pair-btn" type="button" onclick="getCode()">GENERATE PAIR CODE&nbsp; ↗</button>
      <p class="hint">Sri Lankan numbers only · Example: 7XXXXXXXX</p>
      <div id="result" aria-live="polite"></div>
      <div class="service-row"><span class="live-dot"></span><span>PAIR SERVICE</span><b id="serviceStatus">READY</b></div>
    </section>
    <footer>POWERED BY <strong>${developer}</strong> · ZANTA-XMD</footer>
  </main>
<script>
let currentCode = "";
function formatUptime(seconds){
  if(!Number.isFinite(seconds) || seconds < 0) return "--";
  const d=Math.floor(seconds/86400), h=Math.floor(seconds%86400/3600), m=Math.floor(seconds%3600/60);
  return d>0 ? d+"d "+h+"h" : h>0 ? h+"h "+m+"m" : m+"m";
}
async function refreshStats(){
  try{
    const response=await fetch('/health',{cache:'no-store'});
    if(!response.ok) throw new Error('status');
    const data=await response.json();
    document.getElementById('activeBots').textContent=Number.isFinite(data.activeBots)?data.activeBots:'0';
    document.getElementById('uptime').textContent=formatUptime(data.uptime);
    const db=document.getElementById('database');
    db.textContent=data.database==='connected'?'ONLINE':data.database==='disconnected'?'OFFLINE':'WAIT';
    db.classList.toggle('red',data.database!=='connected');
    document.getElementById('dbNote').textContent=data.database==='connected'?'MongoDB connected':'MongoDB status';
  }catch(e){
    document.getElementById('database').textContent='OFFLINE';
    document.getElementById('dbNote').textContent='Status unavailable';
  }
}
async function copyCode(){
  if(!currentCode)return;
  try{await navigator.clipboard.writeText(currentCode);document.getElementById('copyBtn').textContent='COPIED ✓';}
  catch(e){document.getElementById('copyBtn').textContent='SELECT CODE TO COPY';}
}
async function getCode(){
  const input=document.getElementById('number'), btn=document.getElementById('pairBtn'), result=document.getElementById('result');
  let num=input.value.replace(/[^0-9]/g,'').trim();
  if(num.startsWith('0')) num='94'+num.slice(1);
  else if(num.length===9) num='94'+num;
  if(!/^94[0-9]{9}$/.test(num)){
    result.innerHTML='<div class="error">Please enter a valid Sri Lankan mobile number. Example: 7XXXXXXXX</div>';return;
  }
  btn.disabled=true;btn.textContent='GENERATING CODE…';document.getElementById('serviceStatus').textContent='PROCESSING';
  result.innerHTML='<div class="hint">Connecting securely to WhatsApp…</div>';
  try{
    const response=await fetch('/pair?num='+encodeURIComponent(num),{cache:'no-store'});
    const data=await response.json();
    if(!response.ok || !data.code) throw new Error(data.error||'Could not generate pairing code.');
    currentCode=String(data.code).replace(/[^A-Z0-9-]/gi,'');
    const wrap=document.createElement('div');wrap.className='result-box';
    const label=document.createElement('div');label.className='result-label';label.textContent='YOUR WHATSAPP PAIR CODE';
    const code=document.createElement('div');code.className='code-text';code.textContent=currentCode;
    const copy=document.createElement('button');copy.id='copyBtn';copy.className='copy-btn';copy.type='button';copy.textContent='COPY CODE';copy.addEventListener('click',copyCode);
    wrap.append(label,code,copy);result.replaceChildren(wrap);document.getElementById('serviceStatus').textContent='CODE READY';
  }catch(err){
    const error=document.createElement('div');error.className='error';error.textContent=err.message||'Pair request failed. Please try again.';result.replaceChildren(error);document.getElementById('serviceStatus').textContent='RETRY';
  }finally{btn.disabled=false;btn.textContent='GENERATE PAIR CODE  ↗';}
}
document.getElementById('number').addEventListener('keydown',e=>{if(e.key==='Enter')getCode();});
refreshStats();setInterval(refreshStats,5000);
</script>
</body>
</html>`);
});

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
  res.set("Cache-Control", "no-store");
  res.status(200).json({
    status: "alive",
    bot: BOT_NAME,
    uptime: process.uptime(),
    activeBots: global.activeBotSockets ? global.activeBotSockets.size : 0,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: Date.now()
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

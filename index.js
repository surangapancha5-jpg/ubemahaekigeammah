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

app.use(express.json({ limit: "2mb" }));
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
      const body = extractMessageBody(msg);
      const cleanBody = body.trim();

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

// ════════════════ WEB DASHBOARD & AUTHENTICATION ════════════════════════
const crypto = require("crypto");
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24 },
  passwordHash: { type: String, required: true },
  salt: { type: String, required: true },
  logo: { type: String, default: "" },
  sessionTokenHash: { type: String, default: "" },
  sessionExpires: { type: Date, default: null }
}, { timestamps: true, collection: "zantawebusers" });
const WebUser = mongoose.models.ZantaWebUser || mongoose.model("ZantaWebUser", UserSchema);
const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64).toString("hex");
const safeUser = user => ({ username: user.username, logo: user.logo || "", initial: user.username.charAt(0).toUpperCase() });
const authToken = req => (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith("zanta_auth="))?.slice(11) || "";
async function requireWebAuth(req, res, next) {
  try {
    if (!mongoose.connection.readyState) return res.status(503).json({ error: "Database is connecting. Please retry." });
    const token = authToken(req);
    if (!token) return res.status(401).json({ error: "Please login." });
    const user = await WebUser.findOne({ sessionTokenHash: crypto.createHash("sha256").update(token).digest("hex"), sessionExpires: { $gt: new Date() } });
    if (!user) return res.status(401).json({ error: "Session expired. Please login again." });
    req.webUser = user; next();
  } catch { res.status(500).json({ error: "Authentication error." }); }
}
app.post("/api/register", async (req, res) => {
  try {
    if (!mongoose.connection.readyState) return res.status(503).json({ error: "Database is not ready." });
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) return res.status(400).json({ error: "Username must be 3-24 characters (letters, numbers, . _ -)." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must contain at least 8 characters." });
    if (await WebUser.exists({ username: { $regex: `^${username.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, $options: "i" } })) return res.status(409).json({ error: "Username already exists." });
    const salt = crypto.randomBytes(16).toString("hex");
    const token = crypto.randomBytes(32).toString("hex");
    const user = await WebUser.create({ username, salt, passwordHash: hashPassword(password, salt), sessionTokenHash: crypto.createHash("sha256").update(token).digest("hex"), sessionExpires: new Date(Date.now() + 30 * 86400000) });
    res.cookie("zanta_auth", token, { httpOnly: true, secure: req.secure || req.headers["x-forwarded-proto"] === "https", sameSite: "lax", maxAge: 30 * 86400000, path: "/" });
    res.json({ success: true, user: safeUser(user) });
  } catch (e) { res.status(500).json({ error: "Registration failed. Try again." }); }
});
app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim(); const password = String(req.body.password || "");
    const user = await WebUser.findOne({ username: { $regex: `^${username.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, $options: "i" } });
    if (!user || hashPassword(password, user.salt) !== user.passwordHash) return res.status(401).json({ error: "Incorrect username or password." });
    const token = crypto.randomBytes(32).toString("hex");
    user.sessionTokenHash = crypto.createHash("sha256").update(token).digest("hex"); user.sessionExpires = new Date(Date.now() + 30 * 86400000); await user.save();
    res.cookie("zanta_auth", token, { httpOnly: true, secure: req.secure || req.headers["x-forwarded-proto"] === "https", sameSite: "lax", maxAge: 30 * 86400000, path: "/" });
    res.json({ success: true, user: safeUser(user) });
  } catch { res.status(500).json({ error: "Login failed. Try again." }); }
});
app.get("/api/me", requireWebAuth, async (req, res) => res.json({ user: safeUser(req.webUser) }));
app.post("/api/logout", requireWebAuth, async (req, res) => {
  req.webUser.sessionTokenHash = ""; req.webUser.sessionExpires = null; await req.webUser.save();
  res.clearCookie("zanta_auth", { path: "/", sameSite: "lax" }); res.json({ success: true });
});
app.post("/api/profile", requireWebAuth, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim(); const password = String(req.body.password || "");
    if (username && username !== req.webUser.username) {
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) return res.status(400).json({ error: "Invalid username." });
      if (await WebUser.exists({ username: { $regex: `^${username.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, $options: "i" }, _id: { $ne: req.webUser._id } })) return res.status(409).json({ error: "Username already exists." });
      req.webUser.username = username;
    }
    if (password) { if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be at least 8 characters." }); req.webUser.salt = crypto.randomBytes(16).toString("hex"); req.webUser.passwordHash = hashPassword(password, req.webUser.salt); }
    if (typeof req.body.logo === "string") {
      if (req.body.logo.length > 1400000 || (req.body.logo && !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(req.body.logo))) return res.status(400).json({ error: "Upload a PNG, JPG or WEBP image under 1 MB." });
      req.webUser.logo = req.body.logo;
    }
    await req.webUser.save(); res.json({ success: true, user: safeUser(req.webUser) });
  } catch { res.status(500).json({ error: "Could not update profile." }); }
});
app.get("/api/stats", requireWebAuth, async (req, res) => {
  try { const total = await mongoose.connection.collection("darkdinusessions").countDocuments({}); res.json({ bots: total, active: global.activeBotSockets?.size || 0, status: "LIVE" }); }
  catch { res.status(500).json({ error: "Could not load live stats." }); }
});
app.get("/", (req, res) => {
res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090b12"><title>ZANTA-XMD | Pair Center</title><style>
:root{--red:#ff304b;--blue:#287bff;--bg:#080a11;--panel:#111522;--muted:#929bb0}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 12% 8%,#30101c 0,transparent 34%),radial-gradient(ellipse at 90% 85%,#0b2450 0,transparent 38%),var(--bg);color:#f7f8fc;font-family:Inter,system-ui,Arial}button,input{font:inherit}.top{height:78px;padding:0 clamp(18px,5vw,70px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff12;background:#080a11a8;backdrop-filter:blur(16px);position:sticky;top:0;z-index:4}.brand{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:1.5px}.mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--red),var(--blue));display:grid;place-items:center;font-weight:1000;box-shadow:0 5px 24px #ff304b55}.profile{position:relative}.avatar{width:43px;height:43px;border-radius:50%;border:2px solid #ff5267;background:linear-gradient(135deg,#ff304b,#287bff);color:white;font-weight:900;cursor:pointer}.drop{display:none;position:absolute;right:0;top:54px;width:210px;padding:9px;background:#171c2b;border:1px solid #ffffff20;border-radius:15px;box-shadow:0 20px 50px #0009}.drop.show{display:block}.drop button{width:100%;padding:12px;text-align:left;border:0;background:transparent;color:white;border-radius:9px;cursor:pointer}.drop button:hover{background:#ffffff12}.wrap{max-width:1160px;margin:0 auto;padding:clamp(28px,6vw,76px) 20px}.hero{text-align:center;margin-bottom:38px}.eyebrow{color:#ff6679;font-size:12px;font-weight:900;letter-spacing:4px}.hero h1{font-size:clamp(38px,7vw,76px);line-height:1.02;margin:15px 0;background:linear-gradient(100deg,#fff 15%,#ff6477 48%,#5c9cff 85%);background-clip:text;color:transparent}.hero p{color:var(--muted);font-size:16px}.grid{display:grid;grid-template-columns:1.3fr .7fr;gap:22px}.card{background:linear-gradient(145deg,#171c2b,#0e121d);border:1px solid #ffffff16;border-radius:24px;padding:clamp(22px,4vw,36px);box-shadow:0 24px 70px #0005}.card h2{margin:0 0 8px;font-size:23px}.muted{color:var(--muted);font-size:14px}.field{margin-top:20px}.field label{display:block;color:#c5ccda;font-size:13px;margin-bottom:8px}.field input{width:100%;padding:15px 16px;border-radius:13px;border:1px solid #30394e;background:#090d17;color:#fff;outline:none}.field input:focus{border-color:var(--blue);box-shadow:0 0 0 3px #287bff20}.btn{width:100%;margin-top:18px;padding:15px;border:0;border-radius:13px;color:white;font-weight:900;letter-spacing:.5px;cursor:pointer;background:linear-gradient(100deg,var(--red),#bd315f 48%,var(--blue));box-shadow:0 9px 26px #ff304b26}.btn:disabled{opacity:.6;cursor:wait}.switch{margin-top:18px;text-align:center;color:var(--muted);font-size:13px}.link{border:0;background:none;color:#70a8ff;font-weight:800;cursor:pointer}.hidden{display:none!important}.stats{display:grid;gap:16px}.stat{padding:23px;border-radius:19px;background:#0b101c;border:1px solid #ffffff12}.stat strong{display:block;font-size:38px;margin:7px 0;background:linear-gradient(90deg,#ff5b70,#64a2ff);background-clip:text;color:transparent}.live{font-size:11px;color:#64e5a0;letter-spacing:2px;font-weight:900}.live:before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#43e59b;margin-right:8px;box-shadow:0 0 12px #43e59b}.pair{margin-top:22px}.result{margin-top:18px;padding:14px;border-radius:12px;background:#080d17;color:#9fc1ff;word-break:break-word;text-align:center}.error{color:#ff7181}.success{color:#68e7a4}.footer{text-align:center;color:#626d83;font-size:12px;padding:34px}.modal{position:fixed;inset:0;background:#000a;display:none;place-items:center;padding:18px;z-index:9}.modal.show{display:grid}.modal .card{width:min(480px,100%)}.file{color:#aab4c8;font-size:12px}.notice{font-size:12px;color:#7e8ba4;margin-top:10px}@media(max-width:760px){.grid{grid-template-columns:1fr}.top{height:68px}.hero{margin-bottom:25px}.wrap{padding-top:34px}}
</style></head><body><header class="top"><div class="brand"><div class="mark">Z</div><span>ZANTA-XMD <small style="color:#8994aa;font-size:10px">PAIR CENTER</small></span></div><div class="profile hidden" id="profile"><button class="avatar" id="avatar" onclick="toggleMenu()">Z</button><div class="drop" id="drop"><button id="userLabel" disabled>Account</button><button onclick="openProfile()">⚙ Account settings</button><button onclick="logout()">↪ Log out</button></div></div></header>
<main class="wrap"><section class="hero"><div class="eyebrow">NEXT GENERATION WHATSAPP LINKING</div><h1>Connect. Control.<br>Go Beyond.</h1><p>Your secure ZANTA-XMD WhatsApp pairing dashboard.</p></section>
<section class="grid"><div class="card" id="authCard"><div id="authTitle"><h2>Welcome to ZANTA-XMD</h2><p class="muted">Create your dashboard account to continue.</p></div><div class="field"><label>USERNAME</label><input id="username" placeholder="Enter username" maxlength="24" autocomplete="username"></div><div class="field"><label>PASSWORD</label><input id="password" type="password" placeholder="At least 8 characters" autocomplete="current-password"></div><button class="btn" id="authBtn" onclick="authenticate()">CREATE ACCOUNT</button><div class="switch"><span id="switchText">Already registered?</span> <button class="link" id="switchBtn" onclick="toggleAuth()">Login</button></div><div class="result hidden" id="authMsg"></div></div>
<div class="card hidden" id="pairCard"><h2>WhatsApp Pairing</h2><p class="muted">Enter your WhatsApp number with country code.</p><div class="field"><label>PHONE NUMBER</label><input id="number" type="tel" placeholder="947XXXXXXXX" autocomplete="tel"></div><button class="btn" id="pairBtn" onclick="getCode()">GENERATE PAIR CODE</button><div id="pairResult" class="result hidden"></div><div class="notice">Open WhatsApp → Linked devices → Link a device → Link with phone number.</div></div>
<aside class="card"><h2>Network Overview</h2><p class="muted">Live information from your MongoDB session database.</p><div class="stats"><div class="stat"><span class="live">DATABASE LIVE</span><strong id="botCount">—</strong><span class="muted">Total paired bot sessions</span></div><div class="stat"><span class="live">ONLINE NOW</span><strong id="activeCount">—</strong><span class="muted">Active bot connections</span></div></div></aside></section></main><div class="footer">ZANTA-XMD • SECURE PAIRING SYSTEM</div>
<div class="modal" id="profileModal"><div class="card"><h2>Account settings</h2><p class="muted">Update your username, password or dashboard logo.</p><div class="field"><label>NEW USERNAME</label><input id="newUsername" placeholder="Leave blank to keep current"></div><div class="field"><label>NEW PASSWORD</label><input id="newPassword" type="password" placeholder="Leave blank to keep current"></div><div class="field"><label>PROFILE LOGO</label><input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp"><div class="file">PNG / JPG / WEBP • Maximum 1 MB</div></div><button class="btn" onclick="saveProfile()">SAVE CHANGES</button><button class="btn" style="background:#272e40;box-shadow:none;margin-top:9px" onclick="closeProfile()">CANCEL</button><div class="result hidden" id="profileMsg"></div></div></div>
<script>
let mode='register',logged=false;const $=id=>document.getElementById(id);function toggleAuth(){mode=mode==='register'?'login':'register';$('authTitle').innerHTML=mode==='register'?'<h2>Welcome to ZANTA-XMD</h2><p class="muted">Create your dashboard account to continue.</p>':'<h2>Welcome back</h2><p class="muted">Login to your saved dashboard account.</p>';$('authBtn').textContent=mode==='register'?'CREATE ACCOUNT':'LOGIN';$('switchText').textContent=mode==='register'?'Already registered?':'New here?';$('switchBtn').textContent=mode==='register'?'Login':'Register';$('authMsg').classList.add('hidden')}
async function api(url,body){let r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d}
async function authenticate(){let b=$('authBtn'),msg=$('authMsg');b.disabled=true;b.textContent=mode==='register'?'CREATING ACCOUNT...':'AUTHENTICATING...';msg.classList.add('hidden');try{await new Promise(r=>setTimeout(r,2000));let d=await api('/api/'+mode,{username:$('username').value,password:$('password').value});showDashboard(d.user)}catch(e){msg.textContent=e.message;msg.className='result error'}finally{b.disabled=false;b.textContent=mode==='register'?'CREATE ACCOUNT':'LOGIN'}}
function showDashboard(u){logged=true;$('authCard').classList.add('hidden');$('pairCard').classList.remove('hidden');$('profile').classList.remove('hidden');$('avatar').textContent=u.logo?'':u.initial;if(u.logo)$('avatar').style.backgroundImage='url('+u.logo+')',$('avatar').style.backgroundSize='cover',$('avatar').style.backgroundPosition='center';else $('avatar').style.backgroundImage='';$('userLabel').textContent=u.username;refreshStats();setInterval(()=>{if(logged)refreshStats()},10000)}
async function checkLogin(){try{let d=await api('/api/me');showDashboard(d.user)}catch{$('authCard').classList.remove('hidden')}}
async function refreshStats(){try{let d=await api('/api/stats');$('botCount').textContent=d.bots.toLocaleString();$('activeCount').textContent=d.active.toLocaleString()}catch{$('botCount').textContent='—'}}
function toggleMenu(){$('drop').classList.toggle('show')}function openProfile(){$('drop').classList.remove('show');$('profileModal').classList.add('show')}function closeProfile(){$('profileModal').classList.remove('show')}
async function saveProfile(){let msg=$('profileMsg');try{let logo='';let f=$('logoFile').files[0];if(f){if(f.size>1024*1024)throw Error('Image must be under 1 MB.');logo=await new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)})}let d=await api('/api/profile',{username:$('newUsername').value,password:$('newPassword').value,logo});showDashboard(d.user);msg.textContent='Profile updated successfully.';msg.className='result success';$('newUsername').value='';$('newPassword').value='';$('logoFile').value=''}catch(e){msg.textContent=e.message;msg.className='result error'}}
async function logout(){try{await api('/api/logout',{})}catch{}logged=false;$('profile').classList.add('hidden');$('pairCard').classList.add('hidden');$('authCard').classList.remove('hidden');$('drop').classList.remove('show');$('username').value='';$('password').value='';mode='login';toggleAuth()}
async function getCode(){let n=$('number').value.replace(/\D/g,'');if(n.startsWith('0'))n='94'+n.slice(1);let out=$('pairResult'),b=$('pairBtn');if(!/^94\d{9}$/.test(n)){out.textContent='Enter a valid Sri Lankan number (07XXXXXXXX).';out.className='result error';return}b.disabled=true;b.textContent='CONNECTING...';out.textContent='Requesting WhatsApp pairing code...';out.className='result';try{let d=await api('/pair?num='+encodeURIComponent(n));out.textContent='YOUR PAIR CODE: '+d.code+'  •  Tap to copy';out.className='result success';out.onclick=()=>navigator.clipboard?.writeText(d.code)}catch(e){out.textContent=e.message;out.className='result error'}finally{b.disabled=false;b.textContent='GENERATE PAIR CODE'}}checkLogin();
</script></body></html>`);
});

app.get("/pair", requireWebAuth, async (req, res) => {
  if (pairingInProgress) return res.status(429).json({ error: "Another pairing is in progress. Please wait." });
  let number = String(req.query.num || "").replace(/[^0-9]/g, "");
  if (number.startsWith("0")) number = "94" + number.substring(1);
  if (!/^94[0-9]{9}$/.test(number)) return res.status(400).json({ error: "Invalid Sri Lankan phone number." });
  pairingInProgress = true;
  try { const result = await requestPairCode(number); return res.json({ success: true, code: result.code }); }
  catch (error) { return res.status(500).json({ error: error.message || "Failed to get pairing code." }); }
  finally { pairingInProgress = false; }
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

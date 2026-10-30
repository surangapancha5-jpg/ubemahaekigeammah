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
const antiLink = require("./commands/antilink");

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

/* /* =========================================================
   ZANTA-XMD PREMIUM BLACK & RED PAIR SERVICE
========================================================= */

app.get("/", (req, res) => {
  const displayLogo = String(BOT_LOGO || "").replace(/"/g, "&quot;");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#080808">
<title>ZANTA-XMD | PAIR SYSTEM</title>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
}

body {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, #400909 0%, transparent 45%),
    #080808;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  width: 100%;
  max-width: 470px;
  background: linear-gradient(145deg, #171111, #090909);
  border: 1px solid #7d1010;
  border-radius: 25px;
  padding: 35px 25px;
  text-align: center;
  box-shadow: 0 0 40px rgba(255,0,0,.15);
}

.logo {
  width: 115px;
  height: 115px;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid #ff2020;
  box-shadow: 0 0 25px rgba(255,0,0,.4);
  margin-bottom: 20px;
}

h1 {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: 3px;
  color: #ff2929;
}

.subtitle {
  color: #aaa;
  font-size: 13px;
  margin-top: 9px;
  margin-bottom: 30px;
}

.line {
  height: 2px;
  width: 75px;
  background: #ff2020;
  margin: 15px auto 25px;
  border-radius: 10px;
}

.label {
  display: block;
  text-align: left;
  color: #ddd;
  font-size: 13px;
  margin: 15px 0 8px;
}

select, input {
  width: 100%;
  padding: 16px;
  border: 1px solid #472020;
  border-radius: 12px;
  background: #090909;
  color: white;
  font-size: 15px;
  outline: none;
}

select:focus, input:focus {
  border-color: #ff2929;
  box-shadow: 0 0 10px rgba(255,0,0,.2);
}

.btn {
  width: 100%;
  padding: 16px;
  margin-top: 22px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(90deg, #a90000, #ff2525);
  color: white;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: .3s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(255,0,0,.4);
}

.btn:disabled {
  opacity: .5;
  cursor: not-allowed;
  transform: none;
}

#result {
  margin-top: 20px;
}

.code-box {
  padding: 22px;
  border: 1px dashed #ff2929;
  background: #160909;
  border-radius: 15px;
  cursor: pointer;
}

.code-text {
  font-size: 30px;
  font-weight: bold;
  color: #ff3030;
  letter-spacing: 5px;
}

.badge {
  display: block;
  margin-top: 10px;
  font-size: 12px;
  color: #aaa;
}

.error {
  color: #ff4545;
  font-size: 13px;
  margin-top: 12px;
}

.loading {
  color: #ff5555;
  font-size: 14px;
}

.footer {
  margin-top: 30px;
  padding-top: 18px;
  border-top: 1px solid #321515;
  color: #777;
  font-size: 11px;
  letter-spacing: 1px;
}

.footer b {
  color: #ff2929;
}

@media(max-width: 400px) {
  .container {
    padding: 25px 18px;
  }
  h1 {
    font-size: 27px;
  }
}
</style>
</head>

<body>

<div class="container">

<img src="${displayLogo}" class="logo"
onerror="this.style.display='none'">

<h1>ZANTA-XMD</h1>
<p class="subtitle">WHATSAPP MULTI-DEVICE PAIRING SYSTEM</p>

<div class="line"></div>

<label class="label">🌍 SELECT YOUR COUNTRY</label>
<select id="country">
<option value="94" selected>🇱🇰 Sri Lanka (+94)</option>
</select>

<label class="label">📱 PHONE NUMBER</label>
<input
id="number"
type="tel"
placeholder="Enter phone number"
autocomplete="tel"
inputmode="numeric"
>

<button id="pairBtn" class="btn" onclick="getCode()">
GENERATE PAIR CODE
</button>

<div id="result"></div>

<div class="footer">
POWERED BY <b>ZANTA-XMD</b><br><br>
MULTI DEVICE WHATSAPP ENGINE
</div>

</div>

<script>
let currentCode = "";

const countrySelect = document.getElementById("country");

// Load international country calling codes.
async function loadCountries() {
  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2,idd,flags"
    );

    if (!response.ok) throw new Error("Country list unavailable");

    const countries = await response.json();

    countries.sort((a, b) =>
      a.name.common.localeCompare(b.name.common)
    );

    const options = [];

    for (const country of countries) {
      const root = country.idd?.root;
      const suffixes = country.idd?.suffixes || [];

      if (!root) continue;

      const codes = suffixes.length
        ? suffixes.map(s => root + s)
        : [root];

      for (const code of codes) {
        if (!/^\\+[0-9]{1,4}$/.test(code)) continue;

        options.push({
          name: country.name.common,
          flag: country.flags?.emoji || "",
          code: code.replace("+", ""),
          iso: country.cca2
        });
      }
    }

    options.sort((a, b) => a.name.localeCompare(b.name));

    const fragment = document.createDocumentFragment();

    for (const item of options) {
      const option = document.createElement("option");
      option.value = item.code;
      option.textContent =
        item.flag + " " + item.name + " (+" + item.code + ")";

      if (item.iso === "LK") option.selected = true;

      fragment.appendChild(option);
    }

    countrySelect.replaceChildren(fragment);

  } catch (error) {
    console.error("Country loading error:", error);
  }
}

loadCountries();

function copyCode() {
  if (!currentCode) return;

  const badge = document.getElementById("copyBadge");

  navigator.clipboard.writeText(currentCode)
    .then(() => {
      if (badge) badge.innerText = "✓ COPIED SUCCESSFULLY";
    })
    .catch(() => {
      if (badge) badge.innerText = "Please copy the code manually";
    });
}

async function getCode() {
  const input = document.getElementById("number");
  const btn = document.getElementById("pairBtn");
  const result = document.getElementById("result");

  const countryCode = countrySelect.value;
  let localNumber = input.value.replace(/[^0-9]/g, "");

  if (localNumber.startsWith("0")) {
    localNumber = localNumber.substring(1);
  }

  const fullNumber = countryCode + localNumber;

  if (!/^[1-9][0-9]{7,14}$/.test(fullNumber)) {
    result.innerHTML =
      '<div class="error">❌ Please enter a valid phone number.</div>';
    return;
  }

  btn.disabled = true;
  btn.innerText = "CONNECTING...";

  result.innerHTML =
    '<div class="loading">⏳ Requesting WhatsApp Pair Code...</div>';

  try {
    const response = await fetch(
      "/pair?num=" + encodeURIComponent(fullNumber)
    );

    const data = await response.json();

    if (!response.ok || !data.code) {
      throw new Error(data.error || "Pair code generation failed.");
    }

    currentCode = data.code;

    result.innerHTML = "";

    const box = document.createElement("div");
    box.className = "code-box";
    box.onclick = copyCode;

    const code = document.createElement("div");
    code.className = "code-text";
    code.textContent = data.code;

    const badge = document.createElement("span");
    badge.id = "copyBadge";
    badge.className = "badge";
    badge.textContent = "TAP HERE TO COPY YOUR PAIR CODE";

    box.appendChild(code);
    box.appendChild(badge);
    result.appendChild(box);

    copyCode();

  } catch (error) {
    result.innerHTML = "";

    const errorBox = document.createElement("div");
    errorBox.className = "error";
    errorBox.textContent = "❌ " + error.message;

    result.appendChild(errorBox);

  } finally {
    btn.disabled = false;
    btn.innerText = "GENERATE PAIR CODE";
  }
}
</script>

</body>
</html>`);
});


app.get("/pair", async (req, res) => {
  if (pairingInProgress) {
    return res.status(429).json({
      error: "Another pairing is in progress. Please wait."
    });
  }

  const number = String(req.query.num || "").replace(/[^0-9]/g, "");

  if (!/^[1-9][0-9]{7,14}$/.test(number)) {
    return res.status(400).json({
      error: "Invalid international phone number."
    });
  }

  pairingInProgress = true;

  try {
    const result = await requestPairCode(number);

    return res.json({
      success: true,
      code: result.code
    });

  } catch (error) {
    console.error("Pairing error:", error);

    return res.status(500).json({
      error: error.message || "Failed to generate pairing code."
    });

  } finally {
    pairingInProgress = false;
  }
});
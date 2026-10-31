const fs = require('fs');
const path = require('path');

const file = path.resolve(process.cwd(), 'index.js');
if (!fs.existsSync(file)) {
  console.error('❌ index.js not found. Run this script from your bot project root.');
  process.exit(1);
}
let source = fs.readFileSync(file, 'utf8');
const original = source;

function replaceOnce(anchor, replacement, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  source = source.replace(anchor, replacement);
}

const helperAnchor = 'const BotMeta = mongoose.models.ZantaMeta || mongoose.model("ZantaMeta", MetaSchema, "darkdinumetas");';
const helperCode = `${helperAnchor}

// ZANTA-XMD feature settings stored per connected bot number.
async function getBotFeatures(botNumber) {
  try {
    const doc = await BotMeta.findOne({ key: \`features_\${botNumber}\` }).lean();
    return doc && doc.value && typeof doc.value === "object" ? doc.value : {};
  } catch (error) {
    console.error("Feature read error:", error.message);
    return {};
  }
}

async function getBotBannedUsers(botNumber) {
  try {
    const doc = await BotMeta.findOne({ key: \`banned_\${botNumber}\` }).lean();
    return Array.isArray(doc && doc.value) ? doc.value : [];
  } catch (error) {
    console.error("Ban-list read error:", error.message);
    return [];
  }
}
`;

if (!source.includes('async function getBotFeatures(botNumber)')) {
  replaceOnce(helperAnchor, helperCode, 'feature helper insertion');
}

const listenerAnchor = `  const handleMessage = async (msg) => {`;
const listenerCode = `  // Welcome messages are enabled independently for each bot session.
  sock.ev.on("group-participants.update", async (update) => {
    try {
      if (update.action !== "add") return;
      const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      if (!botNumber) return;
      const features = await getBotFeatures(botNumber);
      if (!features.welcome) return;
      let groupName = "this group";
      try { groupName = (await sock.groupMetadata(update.id)).subject || groupName; } catch (_) {}
      for (const participant of update.participants || []) {
        const tag = String(participant).split("@")[0].split(":")[0];
        await sock.sendMessage(update.id, {
          text: \`╭━━〔 🎉 WELCOME 〕━━╮\\n\\n👋 Welcome to *\${groupName}*\\n\\n@\${tag}\\n\\n✨ Enjoy your stay!\\n🤖 Powered by ZANTA-XMD\\n╰━━━━━━━━━━━━━━━━━━╯\`,
          mentions: [participant]
        });
      }
    } catch (error) {
      console.error("Welcome event error:", error.message);
    }
  });

  // Reject incoming calls when anti-call is enabled.
  sock.ev.on("call", async (calls) => {
    try {
      const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      if (!botNumber) return;
      const features = await getBotFeatures(botNumber);
      if (!features.antiCall) return;
      for (const call of calls || []) {
        if (call.status !== "offer") continue;
        try {
          if (typeof sock.rejectCall === "function") await sock.rejectCall(call.id, call.from);
        } catch (error) {
          console.error("Call rejection error:", error.message);
        }
        try {
          await sock.sendMessage(call.from, { text: "🚫 Calls are not accepted by this bot." });
        } catch (_) {}
      }
    } catch (error) {
      console.error("Anti-call event error:", error.message);
    }
  });

${listenerAnchor}`;
if (!source.includes('sock.ev.on("group-participants.update"')) {
  replaceOnce(listenerAnchor, listenerCode, 'event listener insertion');
}

const ownerAnchor = '      const isOwner = Boolean(isDev || isBotOwner);';
const ownerCode = `${ownerAnchor}

      // Bot-level ban list and optional automatic message reaction.
      const botFeatures = await getBotFeatures(currentBotNumber);
      if (!isOwner && senderClean) {
        const bannedUsers = await getBotBannedUsers(currentBotNumber);
        if (bannedUsers.includes(senderClean)) return;
      }
      if (botFeatures.autoReact && !msg.key.fromMe && from !== "status@broadcast") {
        try {
          await sock.sendMessage(from, { react: { text: botFeatures.autoReactEmoji || "❤️", key: msg.key } });
        } catch (error) {
          console.error("Auto-react error:", error.message);
        }
      }`;
if (!source.includes('const botFeatures = await getBotFeatures(currentBotNumber);')) {
  replaceOnce(ownerAnchor, ownerCode, 'ban and auto-react insertion');
}

if (source === original) {
  console.log('ℹ️ No changes made. The requested integrations may already exist.');
} else {
  const output = path.resolve(process.cwd(), 'index.js.fixed');
  fs.writeFileSync(output, source, 'utf8');
  console.log('✅ Patched file created:', output);
  console.log('Review it, then replace your index.js with index.js.fixed.');
}

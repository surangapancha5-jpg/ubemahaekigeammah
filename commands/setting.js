sock.ev.on("group-participants.update", async (update) => {
try {
if (!update.id || !Array.isArray(update.participants)) return;
if (!["add", "remove"].includes(update.action)) return;

const botJid = sock.user?.id;
if (!botJid) return;

const currentBotNumber = botJid
  .split(":")[0]
  .split("@")[0]
  .replace(/[^0-9]/g, "");

if (!currentBotNumber) return;

const { getBotSettings } = require("./lib/settingsHelper");
const settings = await getBotSettings(currentBotNumber);

if (!settings) return;

const isWelcome = update.action === "add";

if (isWelcome && !settings.welcomeEnabled) return;
if (!isWelcome && !settings.goodbyeEnabled) return;

const metadata = await sock.groupMetadata(update.id);
const groupName = metadata.subject || "ZANTA-XMD GROUP";

for (const participant of update.participants) {
  const jid =
    typeof participant === "string"
      ? participant
      : participant?.id;

  if (!jid) continue;

  const number = jid.split("@")[0].split(":")[0];

  const welcomeTemplate = `╭━━〔 🎉 WELCOME 🎉 〕━━╮

┃
┃  👤 Member : @user
┃  🏠 Group  : @group
┃
┃  💖 අපේ පවුලට සාදරයෙන්
┃     පිළිගන්නවා!
┃
┃  📌 Group Rules කියවන්න.
┃  🤝 හැමෝටම ගරු කරන්න.
┃
╰━━━━━━━━━━━━━━━━━━╯
✨ ZANTA-XMD ✨`;

  const goodbyeTemplate = `╭━━〔 👋 GOODBYE 〕━━╮

┃
┃  👤 Member : @user
┃  🏠 Group  : @group
┃
┃  💔 අපේ Group එකෙන්
┃     සමුගන්නා ඔබට සුබ ගමන්!
┃
╰━━━━━━━━━━━━━━━━━━╯
✨ ZANTA-XMD ✨`;

  const template = isWelcome
    ? settings.welcomeMessage || welcomeTemplate
    : settings.goodbyeMessage || goodbyeTemplate;

  const text = String(template)
    .replace(/@user/g, `@${number}`)
    .replace(/@group/g, groupName);

  await sock.sendMessage(update.id, {
    text,
    mentions: [jid]
  });
}

} catch (err) {
console.error("WELCOME/GOODBYE ERROR:", err.message);
}
});
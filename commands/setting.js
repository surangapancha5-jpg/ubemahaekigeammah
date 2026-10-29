sock.ev.on("group-participants.update", async (update) => {
try {
if (!update.id || !Array.isArray(update.participants)) return;

const currentBotNumber = String(sock.user?.id || "")
  .split(":")[0]
  .replace(/[^0-9]/g, "");

if (!currentBotNumber) return;

const { getBotSettings } = require("./lib/settingsHelper");
const settings = await getBotSettings(currentBotNumber);

if (!settings) return;

if (
  update.action === "add" &&
  !settings.welcomeEnabled
) return;

if (
  update.action === "remove" &&
  !settings.goodbyeEnabled
) return;

if (!["add", "remove"].includes(update.action)) return;

const metadata = await sock.groupMetadata(update.id);
const groupName = metadata.subject || "Group";

for (const participant of update.participants) {
  const jid = typeof participant === "string"
    ? participant
    : participant.id;

  if (!jid) continue;

  const number = jid.split("@")[0].split(":")[0];

  let template;

  if (update.action === "add") {
    template =
      settings.welcomeMessage ||
      "👋 Welcome @user to @group!";
  } else {
    template =
      settings.goodbyeMessage ||
      "👋 Goodbye @user!";
  }

  const text = template
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
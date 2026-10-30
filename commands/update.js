module.exports = {
    name: "restart",
    alias: ["reboot"],
    desc: "Restart WhatsApp Bot",
    category: "owner",
    use: ".restart",

    async execute(sock, msg, args, from, { reply, isOwner }) {

        try {

            if (!isOwner) {
                return reply("❌ This command is only for the owner!");
            }

            await sock.sendMessage(from, {
                text: "♻️ *ZANTA-XMD MINI RESTARTING...*\n\n⏳ Please wait!"
            }, { quoted: msg });

            console.log("ZANTA-XMD RESTARTING...");

            setTimeout(() => {
                process.exit(1);
            }, 1500);

        } catch (error) {

            console.error("RESTART ERROR:", error);
            await reply("❌ Restart failed!");

        }
    }
};
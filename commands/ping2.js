module.exports = {
name: "sendmsg",
alias: ["sendto"],
desc: "Send a message to a specific WhatsApp number",
category: "owner",
use: ".sendmsg <number> , <message>",

async execute(sock, msg, args, from, { reply, isOwner }) {
    try {
        // Owner-only command
        if (typeof isOwner === "boolean" && !isOwner) {
            return await reply("❌ මේ Command එක Bot Owner සඳහා පමණයි!");
        }

        const input = args.join(" ").trim();

        if (!input || !input.includes(",")) {
            return await reply(
                "╭━━〔 📩 ZANTA-XMD MINI 〕━━╮\n\n" +
                "භාවිත කරන ආකාරය:\n" +
                ".sendmsg 0760264995 , යාලුවනේ මේ මගේ අලුත් නම්බර් එක. සේව් කරගන්න ❤️\n\n" +
                "╰━━━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const commaIndex = input.indexOf(",");
        let number = input.slice(0, commaIndex).trim();
        const message = input.slice(commaIndex + 1).trim();

        // Normalize Sri Lankan phone numbers
        number = number.replace(/[\s()+-]/g, "");

        if (number.startsWith("0")) {
            number = "94" + number.slice(1);
        }

        if (!/^\d{10,15}$/.test(number)) {
            return await reply("❌ නිවැරදි WhatsApp නම්බර් එකක් ලබාදෙන්න!");
        }

        if (!message) {
            return await reply("❌ යැවිය යුතු Message එකත් ලබාදෙන්න!");
        }

        const jid = `${number}@s.whatsapp.net`;

        await sock.sendMessage(jid, {
            text: message
        });

        return await reply(
            "╭━━〔 ✅ MESSAGE SENT 〕━━╮\n\n" +
            `📱 Number: +${number}\n` +
            "💬 Message එක යැව්වා!\n\n" +
            "╰━━━━━━━━━━━━━━━━━━━━╯"
        );

    } catch (error) {
        console.error("SENDMSG ERROR:", error);

        return await reply(
            "❌ Message එක යවන්න බැරි වුණා!\n" +
            "නම්බර් එක සහ WhatsApp සම්බන්ධතාවය පරීක්ෂා කරන්න."
        );
    }
}

};
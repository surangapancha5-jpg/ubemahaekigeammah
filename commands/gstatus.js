const axios = require("axios");

module.exports = {
name: "gstatus",
alias: ["groupstatus", "gs"],
desc: "Send text, image, video or MP3 to a group using its JID",
category: "group",
use: ".gstatus <group_jid> <text | media_url> + <caption>",

async execute(sock, msg, args, from, { reply }) {
    try {
        const input = args.join(" ").trim();

        if (!input) {
            return await reply(
                "❌ *DARK DINU GSTATUS*\n\n" +
                "📝 Text:\n" +
                ".gstatus GROUP_JID Hello everyone!\n\n" +
                "🖼️ Image URL:\n" +
                ".gstatus GROUP_JID https://example.com/image.jpg + Hello!\n\n" +
                "🎥 Video URL:\n" +
                ".gstatus GROUP_JID https://example.com/video.mp4 + Hello!\n\n" +
                "🎵 MP3:\n" +
                "MP3 එකකට Reply කරලා:\n" +
                ".gstatus GROUP_JID + Song Name"
            );
        }

        const firstSpace = input.indexOf(" ");
        if (firstSpace === -1) {
            return await reply("❌ Group JID එක සහ message/media එක දෙන්න.");
        }

        const groupJid = input.slice(0, firstSpace).trim();
        const content = input.slice(firstSpace + 1).trim();

        if (!groupJid.endsWith("@g.us")) {
            return await reply(
                "❌ වැරදි Group JID එකක්!\n\n" +
                "උදා: 120363xxxxxxxx@g.us"
            );
        }

        if (!content) {
            return await reply("❌ Text එකක් හෝ Media URL එකක් දෙන්න.");
        }

        const quoted =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        const quotedAudio = quoted?.audioMessage;

        // Reply to an MP3 and send it to the specified group
        if (quotedAudio) {
            const { downloadContentFromMessage } =
                require("@whiskeysockets/baileys");

            const stream = await downloadContentFromMessage(
                quotedAudio,
                "audio"
            );

            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const audio = Buffer.concat(chunks);

            if (!audio.length) {
                return await reply("❌ Audio එක download කරන්න බැරි වුණා.");
            }

            await sock.sendMessage(groupJid, {
                audio,
                mimetype: "audio/mpeg",
                fileName: "DARK_DINU_GSTATUS.mp3",
                ptt: false
            });

            return await reply("✅ MP3 එක Group එකට යැව්වා!");
        }

        // Parse media URL and optional caption separated by +
        let mediaUrl = content;
        let caption = "";

        const plusIndex = content.indexOf("+");

        if (plusIndex !== -1) {
            mediaUrl = content.slice(0, plusIndex).trim();
            caption = content.slice(plusIndex + 1).trim();
        }

        // If there is no URL, send text
        if (!/^https?:\/\//i.test(mediaUrl)) {
            await sock.sendMessage(groupJid, {
                text: content
            });

            return await reply("✅ Text එක Group එකට යැව්වා!");
        }

        await reply("⏳ Media එක සූදානම් කරනවා...");

        const response = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024
        });

        const buffer = Buffer.from(response.data);
        const contentType =
            (response.headers["content-type"] || "").toLowerCase();

        if (contentType.includes("image/")) {
            await sock.sendMessage(groupJid, {
                image: buffer,
                caption
            });
        } else if (contentType.includes("video/")) {
            await sock.sendMessage(groupJid, {
                video: buffer,
                caption,
                mimetype: contentType.split(";")[0]
            });
        } else if (
            contentType.includes("audio/") ||
            /\.mp3(?:[?#]|$)/i.test(mediaUrl)
        ) {
            await sock.sendMessage(groupJid, {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: "DARK_DINU_GSTATUS.mp3",
                ptt: false
            });
        } else {
            return await reply(
                "❌ මේ Media Format එක හඳුනාගන්න බැරි වුණා.\n" +
                "Image, Video හෝ MP3 URL එකක් භාවිතා කරන්න."
            );
        }

        await reply("✅ Media එක Group එකට යැව්වා!");

    } catch (error) {
        console.error("GSTATUS ERROR:", error);

        await reply(
            "❌ Group එකට යවන්න බැරි වුණා!\n\n" +
            "Group JID එක නිවැරදිද, Bot එක Group එකේ සාමාජිකයෙක්ද, " +
            "Media URL එක වැඩ කරනවාද කියලා බලන්න."
        );
    }
}

};
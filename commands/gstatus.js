const axios = require("axios");
const {
downloadContentFromMessage
} = require("@whiskeysockets/baileys");

module.exports = {
name: "gstatus",
alias: ["gs", "groupstatus"],
desc: "Send text, image, video or MP3 to the current group",
category: "group",
use: ".gstatus <text | media_url> + <caption>",

async execute(sock, msg, args, from, { reply }) {
    try {
        // Only allow use inside a group
        if (!from || !from.endsWith("@g.us")) {
            return await reply(
                "❌ මේ Command එක Group එකක් ඇතුළේ භාවිතා කරන්න!"
            );
        }

        const content = args.join(" ").trim();

        if (!content) {
            return await reply(
                "╭━━〔 🔥 DARK DINU GSTATUS 〕━━╮\n\n" +
                "📝 Text:\n" +
                ".gstatus Good Morning 🌞\n\n" +
                "🖼️ Image + Caption:\n" +
                ".gstatus https://example.com/image.jpg + Hello\n\n" +
                "🎥 Video + Caption:\n" +
                ".gstatus https://example.com/video.mp4 + New Video\n\n" +
                "🎵 MP3:\n" +
                "MP3 එකකට Reply කරලා .gstatus යවන්න\n\n" +
                "╰━━━━━━━━━━━━━━━━━━╯"
            );
        }

        const context =
            msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.imageMessage?.contextInfo ||
            msg.message?.videoMessage?.contextInfo;

        const quoted = context?.quotedMessage;

        // If replying to an audio message, forward it to the same group
        if (quoted?.audioMessage) {
            const stream = await downloadContentFromMessage(
                quoted.audioMessage,
                "audio"
            );

            const chunks = [];

            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const audio = Buffer.concat(chunks);

            if (!audio.length) {
                return await reply("❌ Audio එක ලබාගන්න බැරි වුණා.");
            }

            await sock.sendMessage(from, {
                audio,
                mimetype: "audio/mpeg",
                fileName: "DARK_DINU_GSTATUS.mp3",
                ptt: false
            }, { quoted: msg });

            return await reply("✅ MP3 එක Group එකට යැව්වා!");
        }

        // Parse URL and optional caption
        const plusIndex = content.indexOf("+");
        const mediaUrl = (
            plusIndex >= 0
                ? content.slice(0, plusIndex)
                : content
        ).trim();

        const caption = plusIndex >= 0
            ? content.slice(plusIndex + 1).trim()
            : "";

        // Plain text
        if (!/^https?:\/\//i.test(mediaUrl)) {
            await sock.sendMessage(from, {
                text: content
            }, { quoted: msg });

            return;
        }

        await reply("⏳ Media එක සූදානම් කරනවා...");

        const response = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024
        });

        const buffer = Buffer.from(response.data);
        const type = (
            response.headers["content-type"] || ""
        ).toLowerCase().split(";")[0];

        if (type.startsWith("image/")) {
            await sock.sendMessage(from, {
                image: buffer,
                caption
            }, { quoted: msg });

        } else if (type.startsWith("video/")) {
            await sock.sendMessage(from, {
                video: buffer,
                caption,
                mimetype: type
            }, { quoted: msg });

        } else if (
            type.startsWith("audio/") ||
            /\.mp3(?:[?#]|$)/i.test(mediaUrl)
        ) {
            await sock.sendMessage(from, {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: "DARK_DINU_GSTATUS.mp3",
                ptt: false
            }, { quoted: msg });

        } else {
            return await reply(
                "❌ මේ Media Format එක සහාය නොදක්වයි!\n" +
                "Image, Video හෝ MP3 URL එකක් භාවිතා කරන්න."
            );
        }

        await reply("✅ Media එක Group එකට යැව්වා!");

    } catch (error) {
        console.error("GSTATUS ERROR:", error);

        await reply(
            "❌ යැවීමට නොහැකි වුණා!\n\n" +
            "Media URL එක නිවැරදිදැයි පරීක්ෂා කරන්න."
        );
    }
}

};
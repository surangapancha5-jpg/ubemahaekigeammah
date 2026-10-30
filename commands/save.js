const {
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const path = require("path");

async function streamToBuffer(stream) {
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

module.exports = {
    name: "save",
    alias: ["savestatus", "statussave"],
    desc: "Download WhatsApp Status",
    category: "download",
    use: ".save",

    async execute(sock, msg, args, from, { reply }) {

        try {

            const context =
                msg.message?.extendedTextMessage?.contextInfo;

            if (!context?.quotedMessage) {
                return reply(
                    "❌ Status එකට Reply කරලා .save යවන්න!"
                );
            }

            let quoted = context.quotedMessage;

            // Unwrap Ephemeral Message
            if (quoted.ephemeralMessage) {
                quoted = quoted.ephemeralMessage.message;
            }

            // Unwrap View Once
            if (quoted.viewOnceMessage) {
                quoted = quoted.viewOnceMessage.message;
            }

            if (quoted.viewOnceMessageV2) {
                quoted = quoted.viewOnceMessageV2.message;
            }

            // Get Media
            const image = quoted.imageMessage;
            const video = quoted.videoMessage;

            if (!image && !video) {
                return reply(
                    "❌ Only Image and Video Status Supported!"
                );
            }

            await sock.sendMessage(from, {
                text: "📥 *ZANTA-XMD DOWNLOADING STATUS...*"
            }, { quoted: msg });

            // Download Media
            let buffer;

            if (image) {

                const stream = await downloadContentFromMessage(
                    image,
                    "image"
                );

                buffer = await streamToBuffer(stream);

                await sock.sendMessage(from, {
                    image: buffer,
                    caption: `
╭━━〔 📸 STATUS SAVED 〕━━╮
┃
┃ ✅ Image Downloaded!
┃
┃ ⚡ ZANTA-XMD MINI
╰━━━━━━━━━━━━━━━━━━━━╯
`
                }, { quoted: msg });

            } else if (video) {

                const stream = await downloadContentFromMessage(
                    video,
                    "video"
                );

                buffer = await streamToBuffer(stream);

                await sock.sendMessage(from, {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: `
╭━━〔 🎬 STATUS SAVED 〕━━╮
┃
┃ ✅ Video Downloaded!
┃
┃ ⚡ ZANTA-XMD MINI
╰━━━━━━━━━━━━━━━━━━━━╯
`
                }, { quoted: msg });

            }

        } catch (error) {

            console.error("SAVE STATUS ERROR:", error);

            await reply(
                "❌ Status Download Failed!\n\nPlease try again."
            );

        }
    }
};
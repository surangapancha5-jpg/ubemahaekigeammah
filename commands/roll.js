// ════════════════ IMPORTS ═════════════════════════════════

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const execFileAsync = promisify(execFile);

// ════════════════ FFMPEG CONFIG ════════════════════════════

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// ════════════════ ROLL COMMAND ═════════════════════════════

module.exports = {
    name: "roll",
    alias: ["reverse"],
    desc: "Convert Video to Round Video Note",
    category: "media",
    use: ".roll (Reply to a video)",

    async execute(sock, msg, args, from, { reply }) {
        const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "zanta-roll-")
        );

        const inputPath = path.join(tempDir, "input.mp4");
        const outputPath = path.join(tempDir, "round.mp4");

        try {
            // ════════════════ GET VIDEO MESSAGE ════════════

            const context =
                msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo ||
                msg.message?.videoMessage?.contextInfo;

            const quoted = context?.quotedMessage;

            const videoMessage =
                msg.message?.videoMessage ||
                quoted?.videoMessage;

            if (!videoMessage) {
                return reply(
`╭━━〔 🎥 ROUND VIDEO 〕━━╮
┃
┃ Video එකකට Reply කරන්න.
┃
┃ ඉන්පසු .roll ගහන්න.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            // ════════════════ VIDEO SIZE CHECK ═════════════

            if (
                videoMessage.fileLength &&
                Number(videoMessage.fileLength) > 30 * 1024 * 1024
            ) {
                return reply("❌ Video එක 30 MB සීමාව ඉක්මවා ඇත.");
            }

            await reply("⏳ Video එක Round Video එකක් බවට හරවමින්...");

            // ════════════════ DOWNLOAD VIDEO ═══════════════

            const mediaMessage = quoted
                ? {
                    key: {
                        remoteJid: from,
                        id: context.stanzaId,
                        participant: context.participant
                    },
                    message: quoted
                }
                : msg;

            const buffer = await downloadMediaMessage(
                mediaMessage,
                "buffer",
                {},
                {
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || !buffer.length) {
                throw new Error("Video download failed.");
            }

            if (buffer.length > 30 * 1024 * 1024) {
                throw new Error("Video එක 30 MB සීමාව ඉක්මවා ඇත.");
            }

            fs.writeFileSync(inputPath, buffer);

            // ════════════════ CREATE ROUND VIDEO ════════════
            // Square crop එකක් සහ circular video note format එකක්.

            await execFileAsync(ffmpegPath, [
                "-y",
                "-i", inputPath,

                "-vf",
                "scale=480:480:force_original_aspect_ratio=increase,crop=480:480,setsar=1,format=yuv420p",

                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "26",

                "-an",
                "-t", "60",

                "-movflags", "+faststart",
                outputPath
            ], {
                timeout: 180000,
                maxBuffer: 10 * 1024 * 1024
            });

            // ════════════════ CHECK OUTPUT ═════════════════

            if (!fs.existsSync(outputPath)) {
                throw new Error("Round video එක සෑදීමට නොහැකි වුණා.");
            }

            const outputBuffer = fs.readFileSync(outputPath);

            if (!outputBuffer.length) {
                throw new Error("Output video එක හිස්.");
            }

            // ════════════════ SEND WHATSAPP VIDEO NOTE ══════

            await sock.sendMessage(from, {
                video: outputBuffer,
                mimetype: "video/mp4",
                ptv: true
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("[ROLL ERROR]", error);

            return reply(
`╭━━〔 ❌ ROLL ERROR 〕━━╮
┃
┃ ${error.message}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            );

        } finally {
            // ════════════════ CLEAN TEMP FILES ═════════════

            fs.rmSync(tempDir, {
                recursive: true,
                force: true
            });
        }
    }
};
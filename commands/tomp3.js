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

// ════════════════ TOM3 COMMAND ═════════════════════════════

module.exports = {
    name: "tomp3",
    alias: ["video2mp3", "extractaudio"],
    desc: "Convert Video to MP3",
    category: "media",
    use: ".tomp3 (Reply to a video)",

    async execute(sock, msg, args, from, { reply }) {
        const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "zanta-tomp3-")
        );

        const inputPath = path.join(tempDir, "input.mp4");
        const outputPath = path.join(tempDir, "audio.mp3");

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
`╭━━〔 🎵 VIDEO TO MP3 〕━━╮
┃
┃ Video එකකට Reply කරන්න.
┃
┃ ඉන්පසු .tomp3 ගහන්න.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            // ════════════════ VIDEO SIZE CHECK ═════════════

            if (
                videoMessage.fileLength &&
                Number(videoMessage.fileLength) > 50 * 1024 * 1024
            ) {
                return reply("❌ Video එක 50 MB සීමාව ඉක්මවා ඇත.");
            }

            await reply("⏳ Video එක MP3 බවට convert කරමින්...");

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

            if (buffer.length > 50 * 1024 * 1024) {
                throw new Error("Video එක 50 MB සීමාව ඉක්මවා ඇත.");
            }

            fs.writeFileSync(inputPath, buffer);

            // ════════════════ CONVERT TO MP3 ═══════════════

            await execFileAsync(ffmpegPath, [
                "-y",
                "-i", inputPath,
                "-vn",
                "-codec:a", "libmp3lame",
                "-b:a", "192k",
                "-ar", "44100",
                "-ac", "2",
                outputPath
            ], {
                timeout: 180000,
                maxBuffer: 10 * 1024 * 1024
            });

            // ════════════════ CHECK OUTPUT ═════════════════

            if (!fs.existsSync(outputPath)) {
                throw new Error("MP3 file එක සෑදීමට නොහැකි වුණා.");
            }

            const outputBuffer = fs.readFileSync(outputPath);

            if (!outputBuffer.length) {
                throw new Error("MP3 file එක හිස්.");
            }

            // ════════════════ SEND MP3 AUDIO ════════════════

            await sock.sendMessage(from, {
                audio: outputBuffer,
                mimetype: "audio/mpeg",
                fileName: "ZANTA-XMD_AUDIO.mp3",
                ptt: false
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("[TOMP3 ERROR]", error);

            return reply(
`╭━━〔 ❌ TOMp3 ERROR 〕━━╮
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
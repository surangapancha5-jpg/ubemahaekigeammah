// ════════════════ IMPORTS ════════════════════════════════

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const execFileAsync = promisify(execFile);

// ════════════════ FFMPEG CONFIG ══════════════════════════

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// ════════════════ ROLL COMMAND ═══════════════════════════

module.exports = {
    name: "roll",
    alias: ["reverse"],
    desc: "Reverse Video",
    category: "media",
    use: ".roll (Reply to a video)",

    async execute(sock, msg, args, from, { reply }) {
        const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "zanta-roll-")
        );

        const inputPath = path.join(tempDir, "input.mp4");
        const outputPath = path.join(tempDir, "reversed.mp4");

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
`╭━━〔 🎬 ROLL VIDEO 〕━━╮
┃
┃ Video එකකට Reply කරලා
┃ .roll ගහන්න.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            if (videoMessage.fileLength &&
                Number(videoMessage.fileLength) > 30 * 1024 * 1024) {
                return reply("❌ Video එක 30 MB සීමාව ඉක්මවා ඇත.");
            }

            await reply("⏳ Video එක Reverse කරමින් පවතී...");

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

            // ════════════════ REVERSE VIDEO ═════════════════

            await execFileAsync(ffmpegPath, [
                "-y",
                "-i", inputPath,
                "-vf", "reverse",
                "-af", "areverse",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "25",
                "-c:a", "aac",
                "-movflags", "+faststart",
                outputPath
            ], {
                timeout: 180000,
                maxBuffer: 10 * 1024 * 1024
            });

            // ════════════════ CHECK OUTPUT ═════════════════

            if (!fs.existsSync(outputPath)) {
                throw new Error("Reversed video එක සෑදීමට නොහැකි වුණා.");
            }

            const outputBuffer = fs.readFileSync(outputPath);

            // ════════════════ SEND REVERSED VIDEO ═══════════

            await sock.sendMessage(from, {
                video: outputBuffer,
                mimetype: "video/mp4",
                caption:
`╭━━〔 🔄 ROLL VIDEO 〕━━╮
┃
┃ ✅ Reverse Completed!
┃
┃ 🎬 ZANTA-XMD
┃
╰━━━━━━━━━━━━━━━━━━━━╯`,
                gifPlayback: false
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("[ROLL ERROR]", error);

            await reply(`❌ Roll Error: ${error.message}`);

        } finally {
            // ════════════════ CLEAN TEMP FILES ═════════════

            fs.rmSync(tempDir, {
                recursive: true,
                force: true
            });
        }
    }
};
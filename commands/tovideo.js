// ════════════════ VIDEO STICKER TO VIDEO ════════════════════════
// Animated WebP sticker එකක් MP4 video එකක් බවට පරිවර්තනය කරයි.

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

module.exports = {
    name: "tovideo",
    alias: ["sticker2video", "sticker2mp4"],
    desc: "Convert Video Sticker to MP4",
    category: "convert",
    use: ".tovideo (Reply to an animated sticker)",

    async execute(sock, msg, args, from, { reply }) {
        let tempDir;

        try {
            // ════════════════ GET REPLIED STICKER ═════════════════
            const context =
                msg.message?.extendedTextMessage?.contextInfo;

            const quoted = context?.quotedMessage;

            if (!quoted?.stickerMessage) {
                return reply(
                    "❌ Animated Video Sticker එකකට Reply කරලා `.tovideo` යවන්න."
                );
            }

            // ════════════════ DOWNLOAD STICKER ════════════════════
            const quotedMsg = {
                key: {
                    remoteJid: from,
                    id: context.stanzaId,
                    participant: context.participant
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(
                quotedMsg,
                "buffer",
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || !buffer.length) {
                return reply("❌ Sticker එක Download කරගන්න බැරි වුණා.");
            }

            // ════════════════ CREATE TEMP FILES ═══════════════════
            tempDir = await fs.promises.mkdtemp(
                path.join(os.tmpdir(), "zanta-tovideo-")
            );

            const inputFile = path.join(tempDir, "sticker.webp");
            const outputFile = path.join(tempDir, "video.mp4");

            await fs.promises.writeFile(inputFile, buffer);

            // ════════════════ CONVERT WEBP TO MP4 ═════════════════
            await execFileAsync(ffmpegPath, [
                "-y",
                "-i", inputFile,
                "-an",
                "-vf",
                "fps=30,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-movflags", "+faststart",
                outputFile
            ], {
                timeout: 120000,
                maxBuffer: 10 * 1024 * 1024
            });

            // ════════════════ SEND MP4 VIDEO ══════════════════════
            const videoBuffer = await fs.promises.readFile(outputFile);

            if (!videoBuffer.length) {
                throw new Error("Converted video is empty.");
            }

            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: "video/mp4",
                caption: "🎬 *ZANTA-XMD VIDEO CONVERTER*\n\n✅ Video Sticker converted successfully!"
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("TOVIDEO ERROR:", error);

            return reply(
                "❌ Video conversion failed.\n\n" +
                (error.message || "Unknown error")
            );

        } finally {
            // ════════════════ CLEAN TEMP FILES ═══════════════════
            if (tempDir) {
                await fs.promises.rm(tempDir, {
                    recursive: true,
                    force: true
                }).catch(() => {});
            }
        }
    }
};
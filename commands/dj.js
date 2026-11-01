const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const execFileAsync = promisify(execFile);
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// ════════════════ DJ AUDIO EFFECTS ════════════════════════
// Bass, Echo, Reverb සහ DJ-style speed එක එකතු කිරීම

const DJ_FILTER =
    "highpass=f=35," +
    "equalizer=f=80:width_type=h:width=1.2:g=6," +
    "equalizer=f=120:width_type=h:width=1.0:g=3," +
    "equalizer=f=8000:width_type=h:width=1.0:g=2," +
    "aecho=0.8:0.7:80|160:0.25|0.15," +
    "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo," +
    "atempo=1.05," +
    "alimiter=limit=0.95";

// ════════════════ COMMAND DETAILS ══════════════════════════

module.exports = {
    name: "dj",
    alias: ["djmix", "remix"],
    desc: "Convert normal song into DJ style",
    category: "audio",
    use: ".dj (Reply to a song)",

    async execute(sock, msg, args, from, { reply }) {
        let tempDir;

        try {
            // ════════════════ GET REPLIED AUDIO ═════════════════

            const context =
                msg.message?.extendedTextMessage?.contextInfo;

            let mediaMessage = msg;

            if (context?.quotedMessage) {
                mediaMessage = {
                    key: {
                        remoteJid: from,
                        id: context.stanzaId,
                        participant: context.participant
                    },
                    message: context.quotedMessage
                };
            }

            const messageContent = mediaMessage.message || {};

            const mediaType = Object.keys(messageContent).find(type =>
                ["audioMessage", "documentMessage", "videoMessage"].includes(type)
            );

            if (!mediaType) {
                return reply(
                    "╭━━〔 🎧 DJ MIX 〕━━╮\n" +
                    "┃\n" +
                    "┃ 🎵 සින්දුවකට Reply කරලා\n" +
                    "┃ .dj කියලා Send කරන්න.\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━╯"
                );
            }

            // ════════════════ DOWNLOAD MEDIA ═══════════════════

            await sock.sendMessage(from, {
                react: { text: "🎧", key: msg.key }
            });

            const buffer = await downloadMediaMessage(
                mediaMessage,
                "buffer",
                {},
                {
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || !buffer.length) {
                throw new Error("Audio download failed.");
            }

            if (buffer.length > 50 * 1024 * 1024) {
                throw new Error("File එක 50MB ට වඩා විශාලයි.");
            }

            // ════════════════ CREATE TEMP FILES ═════════════════

            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zanta-dj-"));

            const inputPath = path.join(tempDir, "input");
            const outputPath = path.join(tempDir, "ZANTA-DJ-MIX.mp3");

            fs.writeFileSync(inputPath, buffer);

            // ════════════════ APPLY DJ EFFECTS ══════════════════

            await reply(
                "╭━━〔 🎛️ ZANTA DJ MIX 〕━━╮\n" +
                "┃\n" +
                "┃ 🎧 DJ Effects එකතු කරනවා...\n" +
                "┃ 🔊 Bass Boost\n" +
                "┃ 🌌 Echo & Reverb\n" +
                "┃ 🎚️ DJ Equalizer\n" +
                "┃ ⚡ Speed Effect\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━╯"
            );

            await execFileAsync(ffmpegPath, [
                "-y",
                "-i", inputPath,
                "-vn",
                "-af", DJ_FILTER,
                "-codec:a", "libmp3lame",
                "-b:a", "192k",
                "-ar", "44100",
                outputPath
            ], {
                timeout: 180000,
                maxBuffer: 10 * 1024 * 1024
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error("DJ audio file එක සෑදීමට නොහැකි වුණා.");
            }

            // ════════════════ SEND DJ SONG ══════════════════════

            await sock.sendMessage(from, {
                audio: fs.readFileSync(outputPath),
                mimetype: "audio/mpeg",
                fileName: "ZANTA-DJ-MIX.mp3",
                ptt: false
            }, {
                quoted: msg
            });

            await sock.sendMessage(from, {
                react: { text: "🔥", key: msg.key }
            });

        } catch (error) {
            console.error("[ZANTA DJ ERROR]", error);

            return reply(
                "╭━━〔 ❌ DJ ERROR 〕━━╮\n" +
                "┃\n" +
                `┃ ${error.message || "Unknown error"}\n` +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━╯"
            );

        } finally {
            // ════════════════ CLEAN TEMP FILES ═════════════════

            if (tempDir && fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, {
                    recursive: true,
                    force: true
                });
            }
        }
    }
};
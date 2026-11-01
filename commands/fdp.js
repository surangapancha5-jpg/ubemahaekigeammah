// ════════════════ IMPORTS ════════════════════════════════

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const execFileAsync = promisify(execFile);
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// ════════════════ FULL DP COMMAND ════════════════════════

module.exports = {
    name: "fulldp",
    alias: ["bigdp", "hdp"],
    desc: "Set High Resolution WhatsApp Profile Photo",
    category: "owner",
    use: ".fulldp (Reply to an image)",

    async execute(sock, msg, args, from, { reply }) {
        const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "zanta-fulldp-")
        );

        const inputPath = path.join(tempDir, "input");
        const outputPath = path.join(tempDir, "fulldp.jpg");

        try {
            // ════════════════ OWNER CHECK ══════════════════

            const config = require("../config");
            const ownerNumber = String(.env.OWNER_NUMBER || "")
                .replace(/\D/g, "");

            const sender = String(
                msg.key?.participant ||
                msg.key?.remoteJid ||
                ""
            ).split("@")[0].replace(/\D/g, "");

            if (!ownerNumber || sender !== ownerNumber) {
                return reply("❌ මේ command එක Bot Owner ට පමණයි.");
            }

            // ════════════════ GET REPLIED IMAGE ════════════

            const context =
                msg.message?.extendedTextMessage?.contextInfo;

            const quoted = context?.quotedMessage;

            const imageMessage =
                msg.message?.imageMessage ||
                quoted?.imageMessage;

            if (!imageMessage) {
                return reply(
`╭━━〔 🖼️ FULL DP 〕━━╮
┃
┃ Photo එකකට Reply කරන්න.
┃
┃ ඉන්පසු .fulldp ගහන්න.
┃
╰━━━━━━━━━━━━━━━━━━╯`
                );
            }

            await reply("⏳ HD Profile Photo එක සකස් කරමින්...");

            // ════════════════ DOWNLOAD IMAGE ═══════════════

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
                throw new Error("Image download failed.");
            }

            if (buffer.length > 15 * 1024 * 1024) {
                throw new Error("Image එක 15 MB සීමාව ඉක්මවා ඇත.");
            }

            fs.writeFileSync(inputPath, buffer);

            // ════════════════ RESIZE IMAGE ═════════════════

            await execFileAsync(ffmpegPath, [
                "-y",
                "-i", inputPath,
                "-vf",
                "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=white",
                "-frames:v", "1",
                "-q:v", "2",
                outputPath
            ], {
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error("Image processing failed.");
            }

            const finalImage = fs.readFileSync(outputPath);

            // ════════════════ UPDATE BOT PROFILE PHOTO ═════

            await sock.updateProfilePicture(
                sock.user.id,
                finalImage
            );

            return reply(
`╭━━〔 ✅ FULL DP UPDATED 〕━━╮
┃
┃ 🖼️ Profile Photo Updated!
┃
┃ ◈ Resolution : 1080 × 1080
┃ ◈ Format : JPEG
┃ ◈ Status : SUCCESS
┃
╰━━━━━━━━━━━━━━━━━━━━╯

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃`
            );

        } catch (error) {
            console.error("[FULLDP ERROR]", error);

            return reply(
`╭━━〔 ❌ FULL DP ERROR 〕━━╮
┃
┃ ${error.message}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            );

        } finally {
            fs.rmSync(tempDir, {
                recursive: true,
                force: true
            });
        }
    }
};
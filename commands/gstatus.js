const crypto = require("crypto");

const {
    downloadMediaMessage,
    generateWAMessageContent,
    generateWAMessageFromContent,
    jidNormalizedUser,
    proto
} = require("@whiskeysockets/baileys");

const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

const TEXT_BG_ARGB = 0xFF1B1F3A;
const TEXT_COLOR_ARGB = 0xFFFFFFFF;
const TEXT_FONT = 2;

// Remove message wrappers
function unwrap(m) {
    let cur = m;

    for (let i = 0; i < 5; i++) {
        const inner =
            cur?.ephemeralMessage?.message ||
            cur?.viewOnceMessage?.message ||
            cur?.viewOnceMessageV2?.message ||
            cur?.viewOnceMessageV2Extension?.message ||
            cur?.documentWithCaptionMessage?.message;

        if (!inner) break;

        cur = inner;
    }

    return cur;
}

const MEDIA_TYPES = [
    "imageMessage",
    "videoMessage",
    "audioMessage"
];

function mediaTypeOf(container) {
    return MEDIA_TYPES.find(type => container?.[type]) || null;
}

function textOf(container) {
    return (
        container?.conversation ||
        container?.extendedTextMessage?.text ||
        ""
    ).trim();
}

// Get status source
function pickSource(msg, argsText) {

    const own = unwrap(msg.message);

    const quoted = unwrap(
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    );

    const extra = String(argsText || "").trim();

    // Own media
    const ownType = mediaTypeOf(own);

    if (ownType) {
        return {
            kind: "media",
            container: own,
            mediaType: ownType,
            caption: extra
        };
    }

    // Replied media
    const quotedType = mediaTypeOf(quoted);

    if (quotedType) {

        const original = (
            quoted[quotedType].caption || ""
        ).trim();

        return {
            kind: "media",
            container: quoted,
            mediaType: quotedType,
            caption: extra || original
        };
    }

    // Replied text
    const quotedText = textOf(quoted);

    if (quotedText) {
        return {
            kind: "text",
            text: quotedText
        };
    }

    // Direct text
    if (extra) {
        return {
            kind: "text",
            text: extra
        };
    }

    return null;
}

// Check Baileys support
function supportsGroupStatus() {

    try {

        const probe = proto.Message.fromObject({
            groupStatusMessageV2: {
                message: {
                    conversation: "test"
                }
            }
        });

        return !!probe.groupStatusMessageV2;

    } catch {
        return false;
    }
}

// Build status content
async function buildContent(sock, source) {

    // TEXT STATUS
    if (source.kind === "text") {

        const inner = await generateWAMessageContent(
            {
                text: source.text
            },
            {
                upload: sock.waUploadToServer
            }
        );

        if (inner.extendedTextMessage) {

            inner.extendedTextMessage.backgroundArgb =
                TEXT_BG_ARGB >>> 0;

            inner.extendedTextMessage.textArgb =
                TEXT_COLOR_ARGB >>> 0;

            inner.extendedTextMessage.font = TEXT_FONT;
        }

        return inner;
    }

    // MEDIA STATUS
    const node = source.container[source.mediaType];

    const declared = Number(
        node.fileLength?.low ??
        node.fileLength ??
        0
    );

    if (declared > MAX_MEDIA_BYTES) {
        throw new Error("Media file එක 64MB ඉක්මවා ඇත.");
    }

    const buffer = await downloadMediaMessage(
        {
            message: source.container
        },
        "buffer",
        {}
    );

    if (!buffer?.length) {
        throw new Error("Media එක download කරගන්න බැරි වුණා.");
    }

    if (buffer.length > MAX_MEDIA_BYTES) {
        throw new Error("Media file එක 64MB ඉක්මවා ඇත.");
    }

    let content;

    // IMAGE
    if (source.mediaType === "imageMessage") {

        content = {
            image: buffer,
            caption: source.caption || undefined
        };

    }

    // VIDEO
    else if (source.mediaType === "videoMessage") {

        content = {
            video: buffer,
            caption: source.caption || undefined,
            gifPlayback: node.gifPlayback === true,
            mimetype: node.mimetype || "video/mp4"
        };

    }

    // AUDIO
    else {

        content = {
            audio: buffer,
            mimetype: node.mimetype || "audio/ogg; codecs=opus",
            ptt: node.ptt === true
        };

    }

    return generateWAMessageContent(
        content,
        {
            upload: sock.waUploadToServer
        }
    );
}

// Send Group Status
async function sendGroupStatus(sock, groupJid, source) {

    if (!supportsGroupStatus()) {

        throw new Error(
            "ඔයාගේ Baileys version එක Group Status support කරන්නේ නැහැ."
        );

    }

    const inner = await buildContent(sock, source);

    const messageSecret = crypto.randomBytes(32);

    const full = generateWAMessageFromContent(
        groupJid,
        proto.Message.fromObject({

            messageContextInfo: {
                messageSecret
            },

            groupStatusMessageV2: {

                message: {
                    ...inner,

                    messageContextInfo: {
                        messageSecret
                    }

                }

            }

        }),
        {
            userJid: jidNormalizedUser(sock.user.id)
        }
    );

    await sock.relayMessage(
        groupJid,
        full.message,
        {
            messageId: full.key.id
        }
    );

    return full.key.id;
}


// MAIN COMMAND
module.exports = {

    name: "gstatus",

    alias: [
        "groupstatus",
        "gcstatus"
    ],

    desc: "Post Text, Photo, Video or Audio as Group Status",

    category: "group",

    use: ".gstatus <text>",

    async execute(sock, msg, args, from, {
        reply,
        isOwner,
        isGroup,
        botConfig
    }) {

        try {

            // OWNER CHECK
            if (!isOwner) {

                return await reply(
                    "❌ *මෙම Command එක භාවිතා කළ හැක්කේ Bot Owner ට පමණයි!*"
                );

            }

            // GROUP CHECK
            if (!isGroup) {

                await sock.sendMessage(from, {
                    react: {
                        text: "⚠️",
                        key: msg.key
                    }
                });

                return await reply(
                    "⚠️ *Group Status එකක් දාන්න Group එකක් ඇතුළේ සිටිය යුතුයි!*"
                );

            }

            const prefix = botConfig?.PREFIX || ".";

            const source = pickSource(
                msg,
                args.join(" ")
            );

            // NO CONTENT
            if (!source) {

                return await reply(

                    `╭━━〔 ⚠️ ZANTA-XMD 〕━━╮
┃
┃ ❌ Status එකට දාන්න දෙයක් ලබාදෙන්න.
┃
┃ 📌 *USAGE*
┃
┃ • ${prefix}gstatus Hello Everyone
┃   └ Text Status
┃
┃ • Photo එකකට Reply කරලා
┃   ${prefix}gstatus
┃
┃ • Video එකකට Reply කරලා
┃   ${prefix}gstatus
┃
┃ • Audio එකකට Reply කරලා
┃   ${prefix}gstatus
┃
┃ • Media එකකට Caption එකක් එක්කරන්න
┃   ${prefix}gstatus My Group
┃
╰━━━━━━━━━━━━━━━━━━━━╯

*POWERED BY ZANTA-XMD*`

                );

            }

            // PROCESSING
            await sock.sendMessage(from, {
                react: {
                    text: "⏳",
                    key: msg.key
                }
            });

            // SEND STATUS
            await sendGroupStatus(
                sock,
                from,
                source
            );

            // SUCCESS
            await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            });

        } catch (error) {

            console.error(
                "GSTATUS ERROR:",
                error
            );

            await sock.sendMessage(from, {
                react: {
                    text: "❌",
                    key: msg.key
                }
            }).catch(() => {});

            await reply(
                `╭━━〔 ❌ GSTATUS ERROR 〕━━╮
┃
┃ Group Status එක යැවීමට නොහැකි වුණා.
┃
┃ ⚠️ ${error.message}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            ).catch(() => {});

        }

    }

};
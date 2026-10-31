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

// =====================================
// UNWRAP MESSAGE
// =====================================

function unwrap(message) {
    let current = message;

    for (let i = 0; i < 10; i++) {
        const inner =
            current?.ephemeralMessage?.message ||
            current?.viewOnceMessage?.message ||
            current?.viewOnceMessageV2?.message ||
            current?.viewOnceMessageV2Extension?.message ||
            current?.documentWithCaptionMessage?.message;

        if (!inner) break;

        current = inner;
    }

    return current;
}

// =====================================
// MEDIA TYPES
// =====================================

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

// =====================================
// GET CONTEXT INFO
// =====================================

function getContextInfo(message) {
    const container = unwrap(message);

    if (!container) return null;

    for (const key of Object.keys(container)) {
        const info = container[key]?.contextInfo;

        if (info?.quotedMessage) {
            return info;
        }
    }

    return null;
}

// =====================================
// PICK SOURCE
// =====================================

function pickSource(msg, argsText, sock) {

    const own = unwrap(msg.message);

    const contextInfo = getContextInfo(msg.message);

    const quotedRaw = contextInfo?.quotedMessage;

    const quoted = unwrap(quotedRaw);

    const extra = String(argsText || "").trim();

    // OWN MEDIA

    const ownType = mediaTypeOf(own);

    if (ownType) {
        return {
            kind: "media",
            container: own,
            mediaType: ownType,
            caption: extra,
            downloadMessage: msg
        };
    }

    // QUOTED MEDIA

    const quotedType = mediaTypeOf(quoted);

    if (quotedType) {

        const botJid = jidNormalizedUser(sock.user.id);

        const participant = contextInfo.participant;

        const quotedMessage = {
            key: {
                remoteJid: msg.key.remoteJid,
                id: contextInfo.stanzaId,
                participant: participant,
                fromMe: participant
                    ? jidNormalizedUser(participant) === botJid
                    : false
            },
            message: quotedRaw
        };

        return {
            kind: "media",
            container: quoted,
            mediaType: quotedType,
            caption: extra || quoted[quotedType].caption || "",
            downloadMessage: quotedMessage
        };
    }

    // QUOTED TEXT

    const quotedText = textOf(quoted);

    if (quotedText) {
        return {
            kind: "text",
            text: quotedText
        };
    }

    // DIRECT TEXT

    if (extra) {
        return {
            kind: "text",
            text: extra
        };
    }

    return null;
}

// =====================================
// DOWNLOAD MEDIA
// =====================================

async function downloadStatusMedia(sock, source) {

    const node = source.container[source.mediaType];

    const declared = Number(
        node.fileLength?.low ??
        node.fileLength ??
        0
    );

    if (declared > MAX_MEDIA_BYTES) {
        throw new Error("Media file එක 64MB ඉක්මවා ඇත.");
    }

    if (!source.downloadMessage) {
        throw new Error("Original media message එක හමු වුණේ නැහැ.");
    }

    const buffer = await downloadMediaMessage(
        source.downloadMessage,
        "buffer",
        {},
        {
            logger: console,
            reuploadRequest: sock.updateMediaMessage
        }
    );

    if (!buffer || !buffer.length) {
        throw new Error("Media download කිරීම අසාර්ථකයි.");
    }

    if (buffer.length > MAX_MEDIA_BYTES) {
        throw new Error("Media file එක 64MB ඉක්මවා ඇත.");
    }

    return buffer;
}

// =====================================
// STATUS CONTEXT
// =====================================

function getStatusContext() {
    return {
        isGroupStatus: true,
        forwardingScore: 0,
        isForwarded: false,
        pairedMediaType: 0,
        featureEligibilities: {
            canBeReshared: true,
            canReceiveMultiReact: true
        }
    };
}

// =====================================
// BUILD CONTENT
// =====================================

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

            inner.extendedTextMessage.contextInfo =
                getStatusContext();
        }

        return inner;
    }

    // MEDIA STATUS

    const node = source.container[source.mediaType];

    const buffer = await downloadStatusMedia(sock, source);

    let content;

    // IMAGE

    if (source.mediaType === "imageMessage") {

        content = {
            image: buffer,
            caption: source.caption || undefined,
            mimetype: node.mimetype || "image/jpeg"
        };

    }

    // VIDEO

    else if (source.mediaType === "videoMessage") {

        content = {
            video: buffer,
            caption: source.caption || undefined,
            mimetype: node.mimetype || "video/mp4",
            gifPlayback: node.gifPlayback === true
        };

    }

    // AUDIO

    else if (source.mediaType === "audioMessage") {

        content = {
            audio: buffer,
            mimetype: node.mimetype || "audio/ogg; codecs=opus",
            ptt: node.ptt === true
        };

    }

    const generated = await generateWAMessageContent(
        content,
        {
            upload: sock.waUploadToServer
        }
    );

    // ADD GROUP STATUS CONTEXT

    for (const type of MEDIA_TYPES) {

        if (generated[type]) {
            generated[type].contextInfo =
                getStatusContext();
        }

    }

    return generated;
}

// =====================================
// SEND GROUP STATUS
// =====================================

async function sendGroupStatus(sock, groupJid, source) {

    const inner = await buildContent(sock, source);

    const messageSecret = crypto.randomBytes(32);

    const message = proto.Message.fromObject({

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

    });

    const full = generateWAMessageFromContent(
        groupJid,
        message,
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

// =====================================
// MAIN COMMAND
// =====================================

module.exports = {

    name: "gstatus",

    alias: [
        "groupstatus",
        "gcstatus"
    ],

    desc: "Send Text, Image, Video and Audio Group Status",

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
                }).catch(() => {});

                return await reply(
                    "⚠️ *මෙම Command එක Group එකක් තුළ භාවිතා කරන්න!*"
                );
            }

            const prefix = botConfig?.PREFIX || ".";

            // GET SOURCE

            const source = pickSource(
                msg,
                args.join(" "),
                sock
            );

            // NO CONTENT

            if (!source) {

                return await reply(
`╭━━〔 ⚠️ ZANTA-XMD 〕━━╮
┃
┃ Status එකට දාන්න දෙයක් ලබාදෙන්න.
┃
┃ 📌 TEXT STATUS
┃ ${prefix}gstatus Hello Everyone
┃
┃ 📷 IMAGE STATUS
┃ Photo එකකට Reply කර
┃ ${prefix}gstatus
┃
┃ 🎬 VIDEO STATUS
┃ Video එකකට Reply කර
┃ ${prefix}gstatus
┃
┃ 🎵 AUDIO STATUS
┃ Audio එකකට Reply කර
┃ ${prefix}gstatus
┃
┃ 📝 CAPTION
┃ Media එකකට Reply කර
┃ ${prefix}gstatus My Group
┃
╰━━━━━━━━━━━━━━━━━━━━╯

POWERED BY ZANTA-XMD`
                );
            }

            // PROCESSING

            await sock.sendMessage(from, {
                react: {
                    text: "⏳",
                    key: msg.key
                }
            }).catch(() => {});

            // SEND

            const messageId = await sendGroupStatus(
                sock,
                from,
                source
            );

            console.log(
                "[GSTATUS] SUCCESS:",
                messageId,
                source.kind,
                source.mediaType || "text"
            );

            // SUCCESS

            await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            }).catch(() => {});

        } catch (error) {

            console.error(
                "[GSTATUS ERROR]",
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
┃ Status එක යැවීමට නොහැකි වුණා.
┃
┃ ⚠️ ${String(error.message || error).slice(0, 500)}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            ).catch(() => {});

        }

    }

};
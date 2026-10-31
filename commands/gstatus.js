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

// ===============================
// UNWRAP MESSAGE
// ===============================

function unwrap(message) {
let cur = message;

for (let i = 0; i < 8; i++) {
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

// ===============================
// MEDIA TYPES
// ===============================

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

// ===============================
// GET QUOTED MESSAGE
// ===============================

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

// ===============================
// PICK STATUS SOURCE
// ===============================

function pickSource(msg, argsText) {

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

// REPLIED MEDIA

const quotedType = mediaTypeOf(quoted);

if (quotedType) {

    const quotedMessage = {
        key: {
            remoteJid: msg.key.remoteJid,
            id: contextInfo.stanzaId,
            participant: contextInfo.participant,
            fromMe: false
        },
        message: quotedRaw
    };

    const originalCaption = (
        quoted[quotedType].caption || ""
    ).trim();

    return {
        kind: "media",
        container: quoted,
        mediaType: quotedType,
        caption: extra || originalCaption,
        downloadMessage: quotedMessage
    };

}

// REPLIED TEXT

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

// ===============================
// GROUP STATUS SUPPORT
// ===============================

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

} catch (error) {

    return false;

}

}

// ===============================
// DOWNLOAD MEDIA
// ===============================

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
    throw new Error("Original media message එක සොයාගත නොහැක.");
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
    throw new Error("Media එක download කරගන්න බැරි වුණා.");
}

if (buffer.length > MAX_MEDIA_BYTES) {
    throw new Error("Media file එක 64MB ඉක්මවා ඇත.");
}

return buffer;

}

// ===============================
// BUILD STATUS CONTENT
// ===============================

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
        gifPlayback: node.gifPlayback === true,
        mimetype: node.mimetype || "video/mp4"
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

return await generateWAMessageContent(
    content,
    {
        upload: sock.waUploadToServer
    }
);

}

// ===============================
// SEND GROUP STATUS
// ===============================

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

// ===============================
// MAIN COMMAND
// ===============================

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
            }).catch(() => {});

            return await reply(
                "⚠️ *Group Status එකක් දාන්න Group එකක් ඇතුළේ සිටිය යුතුයි!*"
            );

        }

        // PREFIX

        const prefix = botConfig?.PREFIX || ".";

        // GET SOURCE

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
┃ 📌 USAGE
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
┃ • Media එකකට Caption එකක්
┃   ${prefix}gstatus My Group
┃
╰━━━━━━━━━━━━━━━━━━━━╯

POWERED BY ZANTA-XMD`
);

        }

        // PROCESSING REACTION

        await sock.sendMessage(from, {
            react: {
                text: "⏳",
                key: msg.key
            }
        }).catch(() => {});

        // SEND GROUP STATUS

        await sendGroupStatus(
            sock,
            from,
            source
        );

        // SUCCESS REACTION

        await sock.sendMessage(from, {
            react: {
                text: "✅",
                key: msg.key
            }
        }).catch(() => {});

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

"╭━━〔 ❌ GSTATUS ERROR 〕━━╮ ┃ ┃ Group Status එක යැවීමට නොහැකි වුණා. ┃ ┃ ⚠️ ${error.message || "Unknown Error"} ┃ ╰━━━━━━━━━━━━━━━━━━━━╯"
).catch(() => {});

    }

}

};
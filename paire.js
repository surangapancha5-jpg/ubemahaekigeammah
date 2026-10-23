const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const axios = require('axios');
const mongoose = require('mongoose');
const simpleGit = require('simple-git');
const { sms, downloadMediaMessage } = require("./msg");
const { makeid } = require("./Id");
const os = require('os');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    getContentType,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    downloadContentFromMessage,
    DisconnectReason,
} = require('@whiskeysockets/baileys');

// ==================== MONGODB MODELS ====================
const sessionSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    creds: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive', 'logged_out'], default: 'active' }
});

const numberListSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    addedAt: { type: Date, default: Date.now },
    lastConnected: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const userConfigSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    config: { type: Object, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

const Session = mongoose.model('Session', sessionSchema);
const NumberList = mongoose.model('NumberList', numberListSchema);
const Config = mongoose.model('Config', configSchema);
const UserConfig = mongoose.model('UserConfig', userConfigSchema);

// ==================== CONFIGURATION ====================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'false',
    AUTO_UPDATE: 'true',
    AUTO_LIKE_EMOJI: ['🦚', '🛹', '🍹', '📱', '🍡', '🪇'],
    PREFIX: '.',
    MAX_RETRIES: 5,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/E1v9iTTvU7ILh6KmUBciZc?mode=gi_t',
    ADMIN_LIST_PATH: './admin.json',
    RCD_IMAGE_PATH: 'https://imgur.com/a/8ShwETJ',
    NEWSLETTER_JID: '120363401853152721@newsletter',
    OTP_EXPIRY: 300000,
    OWNER_NUMBER: '94724389699',
    OWNER_NAME: 'SHANUKA SHAMEEN',
    BOT_NAME: 'SO X MINI',
    BOT_EMOJI: '🦚',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb84GDG0VycJJbZpeR2H',
    DEV_NAME: 'ZANTA',
    STORE_NUMBER: '94760879639',
    STORE_CHANNEL: 'https://whatsapp.com/channel/0029Vb7baIUK5cD5vFLsBy3R',
    STORE_FACEBOOK: 'https://www.facebook.com/share/18ExNA4GkR/',
    RECONNECT_INTERVAL: 5000,
    CONNECTION_TIMEOUT: 30000,
    MAX_RECONNECT_ATTEMPTS: 10,
    BOT_FOOTER: '> *ZANTA-XMD* | *suranga chamith*',
    BOT_IMAGE: 'https://imgur.com/a/8ShwETJ',
    AUTO_STATUS_VIEW: 'true',
    AUTO_STATUS_REACT: 'true',
    SHOW_LAST_SEEN: 'true',
    BUTTON_RESPONSE_MODE: 'button',
    BUTTON_ENABLED: 'true',
    API_BASE_URL: 'https://api.dark-yasiya-api.site'
};

const defaultUserConfig = {
    PREFIX: '.',
    AUTO_VIEW_STATUS: true,
    AUTO_LIKE_STATUS: true,
    AUTO_RECORDING: false,
    AUTO_LIKE_EMOJI: ['🦚', '🛹', '🍹', '📱', '🍡', '🪇'],
    SHOW_LAST_SEEN: true,
    BUTTON_MODE: 'button'
};

const CURRENT_VERSION = '2.0.0';
const git = simpleGit();

// ==================== GLOBAL VARIABLES ====================
const activeSockets = new Map();
const socketCreationTime = new Map();
const reconnectAttempts = new Map();
const userFirstTime = new Set();
const SESSION_BASE_PATH = './session';

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

// ==================== USER CONFIG FUNCTIONS ====================
async function loadUserConfig(number) {
    try {
        const userConfig = await UserConfig.findOne({ number });
        if (userConfig) {
            return { ...defaultUserConfig, ...userConfig.config };
        }
        return { ...defaultUserConfig };
    } catch (error) {
        console.error(`Failed to load user config:`, error);
        return { ...defaultUserConfig };
    }
}

async function updateUserConfig(number, configData) {
    try {
        await UserConfig.findOneAndUpdate(
            { number },
            { number, config: configData, updatedAt: new Date() },
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error(`Failed to update user config:`, error);
        return false;
    }
}

// ==================== MONGODB SESSION FUNCTIONS ====================
async function saveSessionToMongoDB(number, creds) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.findOneAndUpdate(
            { number: sanitizedNumber },
            { number: sanitizedNumber, creds, updatedAt: new Date(), lastSeen: new Date(), status: 'active' },
            { upsert: true }
        );
        console.log(`✅ Session saved to MongoDB for ${sanitizedNumber}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to save session:`, error);
        return false;
    }
}

async function loadSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({ number: sanitizedNumber, status: 'active' });
        if (session?.creds) {
            console.log(`✅ Session loaded from MongoDB for ${sanitizedNumber}`);
            return session.creds;
        }
        return null;
    } catch (error) {
        console.error(`❌ Failed to load session:`, error);
        return null;
    }
}

async function deleteSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.updateOne({ number: sanitizedNumber }, { status: 'logged_out', updatedAt: new Date() });
        await NumberList.deleteOne({ number: sanitizedNumber });
        
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath);
        
        console.log(`✅ Session deleted for ${sanitizedNumber}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to delete session:`, error);
        return false;
    }
}

async function saveNumberToMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await NumberList.findOneAndUpdate(
            { number: sanitizedNumber },
            { number: sanitizedNumber, lastConnected: new Date() },
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error(`❌ Failed to save number:`, error);
        return false;
    }
}

async function getAllNumbersFromMongoDB() {
    try {
        const numbers = await NumberList.find({});
        return numbers.map(n => n.number);
    } catch (error) {
        console.error(`❌ Failed to load numbers:`, error);
        return [];
    }
}

// ==================== UTILITY FUNCTIONS ====================
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n${footer || config.BOT_FOOTER}`;
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

const shonux = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_FAKE_ID" },
    message: {
        contactMessage: {
            displayName: config.OWNER_NAME,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.OWNER_NAME}\nORG:Meta Platforms\nTEL;type=CELL;waid=13135550002:+1 313 555 0002\nEND:VCARD`
        }
    }
};

// ==================== WELCOME MENU FUNCTION ====================
async function sendWelcomeMenu(socket, from, msg, userPrefix, senderNumber) {
    const startTime = socketCreationTime.get(socket.user.id.split(':')[0]) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const welcomeText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*📋 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍*

◈ *Greet* :- ${msg.pushName || 'Guest'} 👋
◈ *Time* :- ${moment().tz('Asia/Colombo').format('h:mm:ss A')}
◈ *Date* :- ${moment().tz('Asia/Colombo').format('YYYY/MM/DD')}
◈ *Bot Powerd* :- *${config.DEV_NAME}*
◈ *Active Sessions* :- *${activeSockets.size}*
◈ *Bot Uptime* :- ${hours}h ${minutes}m ${seconds}s

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

    await socket.sendMessage(from, {
        text: welcomeText,
        buttons: [
            { buttonId: `${userPrefix}menu`, buttonText: { displayText: '📋 MAIN MENU' }, type: 1 },
            { buttonId: `${userPrefix}alive`, buttonText: { displayText: '🦚 BOT STATUS' }, type: 1 },
            { buttonId: `${userPrefix}settings`, buttonText: { displayText: '⚙️ SETTINGS' }, type: 1 },
            { buttonId: `${userPrefix}owner`, buttonText: { displayText: '👑 OWNER' }, type: 1 },
            { buttonId: `${userPrefix}channel`, buttonText: { displayText: '📢 JOIN CHANNEL' }, type: 1 },
            { buttonId: `${userPrefix}copybot`, buttonText: { displayText: '🤖 COPY BOT' }, type: 1 }
        ],
        viewOnce: false,
        headerType: 1
    }, { quoted: msg });
}

// ==================== RESPONSE FORMATTER ====================
async function sendResponse(socket, chatId, content, quotedMsg, options = {}) {
    try {
        const userId = chatId.split('@')[0];
        const userConfig = await loadUserConfig(userId);
        const useButtons = userConfig.BUTTON_MODE === 'button' && config.BUTTON_ENABLED === 'true';
        
        if (useButtons && options.buttons && options.buttons.length > 0) {
            const buttonMessage = {
                text: content,
                buttons: options.buttons,
                headerType: 1
            };
            if (options.image) buttonMessage.image = options.image;
            if (options.video) buttonMessage.video = options.video;
            if (options.audio) buttonMessage.audio = options.audio;
            if (options.caption) buttonMessage.caption = options.caption;
            return await socket.sendMessage(chatId, buttonMessage, { quoted: quotedMsg });
        } else {
            let formattedContent = content;
            if (options.buttons && options.buttons.length > 0 && !useButtons) {
                formattedContent += '\n\n*📱 Commands:*\n';
                for (const btn of options.buttons) {
                    if (btn.buttonId && !btn.buttonId.includes('http')) {
                        formattedContent += `▸ *${btn.buttonText.displayText}* → \`${btn.buttonId}\`\n`;
                    }
                }
            }
            if (options.image) {
                return await socket.sendMessage(chatId, { image: options.image, caption: formattedContent }, { quoted: quotedMsg });
            }
            if (options.video) {
                return await socket.sendMessage(chatId, { video: options.video, caption: formattedContent }, { quoted: quotedMsg });
            }
            if (options.audio) {
                return await socket.sendMessage(chatId, { audio: options.audio, mimetype: 'audio/mpeg' }, { quoted: quotedMsg });
            }
            if (options.document) {
                return await socket.sendMessage(chatId, { document: options.document, fileName: options.fileName, mimetype: options.mimetype, caption: formattedContent }, { quoted: quotedMsg });
            }
            return await socket.sendMessage(chatId, { text: formattedContent }, { quoted: quotedMsg });
        }
    } catch (error) {
        console.error('Send response error:', error);
        return await socket.sendMessage(chatId, { text: content }, { quoted: quotedMsg });
    }
}

// ==================== COMMAND HANDLER WITH FIXED MESSAGE PARSING ====================
async function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        
        // Skip status broadcasts
        if (msg.key.remoteJid === 'status@broadcast') return;

        try {
            // Get the message type and extract text properly
            let messageType = Object.keys(msg.message)[0];
            let messageContent = '';
            
            // Handle different message types
            if (messageType === 'conversation') {
                messageContent = msg.message.conversation;
            } 
            else if (messageType === 'extendedTextMessage') {
                messageContent = msg.message.extendedTextMessage.text;
            }
            else if (messageType === 'imageMessage') {
                messageContent = msg.message.imageMessage.caption || '';
            }
            else if (messageType === 'videoMessage') {
                messageContent = msg.message.videoMessage.caption || '';
            }
            else if (messageType === 'buttonsResponseMessage') {
                messageContent = msg.message.buttonsResponseMessage.selectedButtonId || '';
            }
            else if (messageType === 'listResponseMessage') {
                messageContent = msg.message.listResponseMessage.singleSelectReply.selectedRowId || '';
            }
            else if (messageType === 'templateButtonReplyMessage') {
                messageContent = msg.message.templateButtonReplyMessage.selectedId || '';
            }
            
            // If no content found, return
            if (!messageContent) return;
            
            // Get sender info
            const senderJid = msg.key.fromMe ? socket.user.id : (msg.key.participant || msg.key.remoteJid);
            const senderNumber = senderJid.split('@')[0];
            const from = msg.key.remoteJid;
            const isGroup = from.endsWith("@g.us");
            
            // Load user config for prefix
            const userConfig = await loadUserConfig(senderNumber);
            const userPrefix = userConfig.PREFIX || config.PREFIX;
            
            // Check if message starts with prefix
            const isCmd = messageContent.startsWith(userPrefix);
            
            // Auto welcome for new users (non-command messages)
            if (!isCmd && !userFirstTime.has(senderNumber) && !isGroup && messageContent) {
                userFirstTime.add(senderNumber);
                await sendWelcomeMenu(socket, from, msg, userPrefix, senderNumber);
                return;
            }
            
            if (!isCmd) return;
            
            // Extract command and arguments
            const cmdWithoutPrefix = messageContent.slice(userPrefix.length).trim();
            const command = cmdWithoutPrefix.split(' ')[0].toLowerCase();
            const args = cmdWithoutPrefix.split(' ').slice(1);
            
            console.log(`[COMMAND] ${senderNumber}: ${command} ${args.join(' ')}`);
            
            // Create a message object for reply functions
            const m = {
                key: msg.key,
                message: msg.message,
                sender: senderJid,
                chat: from,
                isGroup: isGroup,
                reply: async (text) => {
                    await socket.sendMessage(from, { text: text }, { quoted: msg });
                },
                react: async (emoji) => {
                    await socket.sendMessage(from, { react: { text: emoji, key: msg.key } });
                }
            };
            
            // ==================== CASE BASE COMMAND HANDLER ====================
            switch (command) {
                
                // ==================== WELCOME/MENU COMMAND ====================
                case 'start':
                case 'welcome':
                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    
                    const menuText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐌𝐀𝐈𝐍 𝐌𝐄𝐍𝐔*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*📊 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐔𝐒*
◈ *Bot Uptime* : ${hours}h ${minutes}m ${seconds}s
◈ *Active Bots* : ${activeSockets.size}
◈ *Version* : ${CURRENT_VERSION}
◈ *Platform* : Heroku

*👑 𝐎𝐖𝐍𝐄𝐑*
◈ *Name* : ${config.OWNER_NAME}
◈ *Number* : ${config.OWNER_NUMBER}

*📱 𝐀𝐕𝐀𝐈𝐋𝐀𝐁𝐋𝐄 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒*
◈ *${userPrefix}alive* - Bot status
◈ *${userPrefix}settings* - Settings menu
◈ *${userPrefix}download* - Download menu
◈ *${userPrefix}owner* - Contact owner
◈ *${userPrefix}channel* - Join channel
◈ *${userPrefix}copybot* - Copy bot
◈ *${userPrefix}ping* - Check ping
◈ *${userPrefix}system* - System info

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: menuText,
                        buttons: [
                            { buttonId: `${userPrefix}alive`, buttonText: { displayText: '🦚 ALIVE' }, type: 1 },
                            { buttonId: `${userPrefix}settings`, buttonText: { displayText: '⚙️ SETTINGS' }, type: 1 },
                            { buttonId: `${userPrefix}download`, buttonText: { displayText: '📥 DOWNLOADS' }, type: 1 },
                            { buttonId: `${userPrefix}owner`, buttonText: { displayText: '👑 OWNER' }, type: 1 },
                            { buttonId: `${userPrefix}channel`, buttonText: { displayText: '📢 CHANNEL' }, type: 1 },
                            { buttonId: `${userPrefix}copybot`, buttonText: { displayText: '🤖 COPY BOT' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== ALIVE COMMAND ====================
                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    
                    const aliveText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐀𝐋𝐈𝐕𝐄 𝐒𝐓𝐀𝐓𝐔𝐒*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*📊 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐈𝐒𝐓𝐈𝐂𝐒*

◈ *🤖 Bot Uptime* : ${hours}h ${minutes}m ${seconds}s
◈ *🍹 Active Bots* : ${activeSockets.size}
◈ *📱 Bot Version* : ${CURRENT_VERSION}
◈ *🍡 Platform* : Heroku
◈ *🪇 Bot Owner* : ${config.OWNER_NUMBER}
◈ *🦚 Owner Name* : ${config.OWNER_NAME}

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: aliveText,
                        buttons: [
                            { buttonId: `${userPrefix}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 },
                            { buttonId: `${userPrefix}settings`, buttonText: { displayText: '⚙️ SETTINGS' }, type: 1 },
                            { buttonId: `${userPrefix}owner`, buttonText: { displayText: '👑 OWNER' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== SETTINGS MENU ====================
                case 'settings':
                case 'setting': {
                    const userConfigData = await loadUserConfig(senderNumber);
                    const currentPrefix = userConfigData.PREFIX || config.PREFIX;
                    
                    const settingsText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   ⚙️ 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒 𝐌𝐄𝐍𝐔*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*🔧 𝐂𝐔𝐑𝐑𝐄𝐍𝐓 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒*

◈ *👤 User* : ${senderNumber}
◈ *🔑 Prefix* : \`${currentPrefix}\`
◈ *👀 Status View* : ${userConfigData.AUTO_VIEW_STATUS === true ? '🟢 ON' : '🔴 OFF'}
◈ *📱 Last Seen* : ${userConfigData.SHOW_LAST_SEEN === true ? '🟢 ON' : '🔴 OFF'}
◈ *🛹 Button Mode* : ${userConfigData.BUTTON_MODE === 'button' ? '🟢 BUTTON' : '🔴 TEXT'}
◈ *❤️ Auto React* : ${userConfigData.AUTO_LIKE_STATUS === true ? '🟢 ON' : '🔴 OFF'}

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: settingsText,
                        buttons: [
                            { buttonId: `${currentPrefix}setprefix .`, buttonText: { displayText: '🔑 PREFIX: .' }, type: 1 },
                            { buttonId: `${currentPrefix}setprefix #`, buttonText: { displayText: '🔑 PREFIX: #' }, type: 1 },
                            { buttonId: `${currentPrefix}setprefix @`, buttonText: { displayText: '🔑 PREFIX: @' }, type: 1 },
                            { buttonId: `${currentPrefix}setprefix &`, buttonText: { displayText: '🔑 PREFIX: &' }, type: 1 },
                            { buttonId: `${currentPrefix}statusview on`, buttonText: { displayText: '👀 ENABLE STATUS VIEW' }, type: 1 },
                            { buttonId: `${currentPrefix}statusview off`, buttonText: { displayText: '🔒 DISABLE STATUS VIEW' }, type: 1 },
                            { buttonId: `${currentPrefix}lastseen on`, buttonText: { displayText: '📱 SHOW LAST SEEN' }, type: 1 },
                            { buttonId: `${currentPrefix}lastseen off`, buttonText: { displayText: '🔴 HIDE LAST SEEN' }, type: 1 },
                            { buttonId: `${currentPrefix}buttontoggle`, buttonText: { displayText: '🛹 TOGGLE BUTTON MODE' }, type: 1 },
                            { buttonId: `${currentPrefix}statusreact on`, buttonText: { displayText: '❤️ ENABLE REACT' }, type: 1 },
                            { buttonId: `${currentPrefix}statusreact off`, buttonText: { displayText: '💔 DISABLE REACT' }, type: 1 },
                            { buttonId: `${currentPrefix}menu`, buttonText: { displayText: '🔙 BACK TO MENU' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== SETPREFIX COMMAND ====================
                case 'setprefix': {
                    let newPrefix = args[0];
                    if (!newPrefix) {
                        const currentPrefix = userConfig.PREFIX || config.PREFIX;
                        await socket.sendMessage(from, {
                            text: `*🔑 PREFIX SETTINGS*\n\nCurrent prefix: \`${currentPrefix}\`\n\nClick a button below to change your prefix:`,
                            buttons: [
                                { buttonId: `${currentPrefix}setprefix .`, buttonText: { displayText: '🔑 PREFIX: .' }, type: 1 },
                                { buttonId: `${currentPrefix}setprefix #`, buttonText: { displayText: '🔑 PREFIX: #' }, type: 1 },
                                { buttonId: `${currentPrefix}setprefix @`, buttonText: { displayText: '🔑 PREFIX: @' }, type: 1 },
                                { buttonId: `${currentPrefix}setprefix &`, buttonText: { displayText: '🔑 PREFIX: &' }, type: 1 }
                            ]
                        }, { quoted: msg });
                        break;
                    }
                    
                    const validPrefixes = ['.', '#', '@', '&', '!', '?', '$'];
                    if (!validPrefixes.includes(newPrefix)) {
                        await m.reply(`❌ Invalid prefix! Use one of: ${validPrefixes.join(', ')}`);
                        break;
                    }
                    
                    let userConfigData = await loadUserConfig(senderNumber);
                    userConfigData.PREFIX = newPrefix;
                    await updateUserConfig(senderNumber, userConfigData);
                    
                    await m.react('✅');
                    await m.reply(`✅ Prefix changed to: \`${newPrefix}\``);
                    break;
                }
                
                // ==================== STATUS VIEW COMMAND ====================
                case 'statusview':
                case 'sv': {
                    const action = args[0]?.toLowerCase();
                    let userConfigData = await loadUserConfig(senderNumber);
                    const currentPrefix = userConfigData.PREFIX || config.PREFIX;
                    
                    if (action === 'on') {
                        userConfigData.AUTO_VIEW_STATUS = true;
                        await updateUserConfig(senderNumber, userConfigData);
                        await m.react('👀');
                        await m.reply('✅ Status auto-view ENABLED');
                    } else if (action === 'off') {
                        userConfigData.AUTO_VIEW_STATUS = false;
                        await updateUserConfig(senderNumber, userConfigData);
                        await m.react('🔒');
                        await m.reply('🔒 Status auto-view DISABLED');
                    } else {
                        const status = userConfigData.AUTO_VIEW_STATUS ? '🟢 ENABLED' : '🔴 DISABLED';
                        await socket.sendMessage(from, {
                            text: `*👀 STATUS VIEW SETTINGS*\n\nCurrent Status: ${status}\n\nClick a button below to change:`,
                            buttons: [
                                { buttonId: `${currentPrefix}statusview on`, buttonText: { displayText: '👀 ENABLE' }, type: 1 },
                                { buttonId: `${currentPrefix}statusview off`, buttonText: { displayText: '🔒 DISABLE' }, type: 1 }
                            ]
                        }, { quoted: msg });
                    }
                    break;
                }
                
                // ==================== LAST SEEN COMMAND ====================
                case 'lastseen':
                case 'ls': {
                    const action = args[0]?.toLowerCase();
                    let userConfigData = await loadUserConfig(senderNumber);
                    const currentPrefix = userConfigData.PREFIX || config.PREFIX;
                    
                    if (action === 'on') {
                        userConfigData.SHOW_LAST_SEEN = true;
                        await updateUserConfig(senderNumber, userConfigData);
                        await m.react('📱');
                        await m.reply('✅ Last seen visibility ENABLED');
                    } else if (action === 'off') {
                        userConfigData.SHOW_LAST_SEEN = false;
                        await updateUserConfig(senderNumber, userConfigData);
                        await m.react('🔒');
                        await m.reply('🔒 Last seen visibility DISABLED');
                    } else {
                        const status = userConfigData.SHOW_LAST_SEEN ? '🟢 VISIBLE' : '🔴 HIDDEN';
                        await socket.sendMessage(from, {
                            text: `*📱 LAST SEEN SETTINGS*\n\nCurrent Status: ${status}\n\nClick a button below to change:`,
                            buttons: [
                                { buttonId: `${currentPrefix}lastseen on`, buttonText: { displayText: '🟢 SHOW LAST SEEN' }, type: 1 },
                                { buttonId: `${currentPrefix}lastseen off`, buttonText: { displayText: '🔴 HIDE LAST SEEN' }, type: 1 }
                            ]
                        }, { quoted: msg });
                    }
                    break;
                }
                
                // ==================== STATUS REACT COMMAND ====================
                case 'statusreact':
                case 'sr': {
                    const action = args[0]?.toLowerCase();
                    let userConfigData = await loadUserConfig(senderNumber);
                    const currentPrefix = userConfigData.PREFIX || config.PREFIX;
                    
                    if (action === 'on') {
                        userConfigData.AUTO_LIKE_STATUS = true;
                        await updateUserConfig(senderNumber, userConfigData);
                        await m.react('❤️');
                        await m.reply('✅ Status auto-react ENABLED');
                    } else if (action === 'off') {
                        userConfigData.AUTO_LIKE_STATUS = false;
                        await updateUserConfig(senderNumber, userConfigData);
                        await m.react('💔');
                        await m.reply('🔒 Status auto-react DISABLED');
                    } else {
                        const status = userConfigData.AUTO_LIKE_STATUS ? '🟢 ENABLED' : '🔴 DISABLED';
                        const emojis = userConfigData.AUTO_LIKE_EMOJI?.join(' ') || '🦚🛹🍹📱🍡🪇';
                        
                        await socket.sendMessage(from, {
                            text: `*❤️ STATUS REACT SETTINGS*\n\n` +
                                  `Current Status: ${status}\n` +
                                  `Reaction Emojis: ${emojis}\n\n` +
                                  `Click a button below to change:`,
                            buttons: [
                                { buttonId: `${currentPrefix}statusreact on`, buttonText: { displayText: '❤️ ENABLE' }, type: 1 },
                                { buttonId: `${currentPrefix}statusreact off`, buttonText: { displayText: '💔 DISABLE' }, type: 1 },
                                { buttonId: `${currentPrefix}set AUTO_LIKE_EMOJI 🦚🛹🍹📱🍡🪇`, buttonText: { displayText: '🦚 SET EMOJIS' }, type: 1 }
                            ]
                        }, { quoted: msg });
                    }
                    break;
                }
                
                // ==================== BUTTON TOGGLE COMMAND ====================
                case 'buttontoggle':
                case 'btoggle': {
                    let userConfigData = await loadUserConfig(senderNumber);
                    const currentMode = userConfigData.BUTTON_MODE || 'button';
                    const newMode = currentMode === 'button' ? 'text' : 'button';
                    
                    userConfigData.BUTTON_MODE = newMode;
                    await updateUserConfig(senderNumber, userConfigData);
                    
                    const modeText = newMode === 'button' ? '🟢 BUTTON MODE' : '🔴 TEXT MODE';
                    await m.react('🛹');
                    await m.reply(`🛹 Button mode changed to: ${modeText}`);
                    break;
                }
                
                // ==================== DOWNLOAD MENU ====================
                case 'download':
                case 'dl': {
                    const currentPrefix = userConfig.PREFIX || config.PREFIX;
                    
                    const downloadText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   📥 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 𝐌𝐄𝐍𝐔*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*🎵 𝐌𝐔𝐒𝐈𝐂 & 𝐕𝐈𝐃𝐄𝐎*
◈ *Song* : \`${currentPrefix}song <name>\`
◈ *YouTube* : \`${currentPrefix}ytvideo <link>\`

*📱 𝐒𝐎𝐂𝐈𝐀𝐋 𝐌𝐄𝐃𝐈𝐀*
◈ *Facebook* : \`${currentPrefix}fb <link>\`
◈ *TikTok* : \`${currentPrefix}tiktok <link>\`
◈ *Instagram* : \`${currentPrefix}ig <link>\`

*📁 𝐅𝐈𝐋𝐄𝐒*
◈ *Google Drive* : \`${currentPrefix}gdrive <link>\`
◈ *Mediafire* : \`${currentPrefix}mediafire <link>\`

*✨ 𝐎𝐓𝐇𝐄𝐑*
◈ *Fancy Text* : \`${currentPrefix}fancy <text>\`
◈ *View Once* : \`${currentPrefix}vv\` (reply to view once)

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: downloadText,
                        buttons: [
                            { buttonId: `${currentPrefix}song`, buttonText: { displayText: '🎵 SONG' }, type: 1 },
                            { buttonId: `${currentPrefix}fb`, buttonText: { displayText: '📘 FACEBOOK' }, type: 1 },
                            { buttonId: `${currentPrefix}tiktok`, buttonText: { displayText: '🎵 TIKTOK' }, type: 1 },
                            { buttonId: `${currentPrefix}ig`, buttonText: { displayText: '📸 INSTAGRAM' }, type: 1 },
                            { buttonId: `${currentPrefix}ytvideo`, buttonText: { displayText: '🎬 YOUTUBE' }, type: 1 },
                            { buttonId: `${currentPrefix}gdrive`, buttonText: { displayText: '📁 GOOGLE DRIVE' }, type: 1 },
                            { buttonId: `${currentPrefix}fancy`, buttonText: { displayText: '✨ FANCY TEXT' }, type: 1 },
                            { buttonId: `${currentPrefix}vv`, buttonText: { displayText: '👁️ VIEW ONCE' }, type: 1 },
                            { buttonId: `${currentPrefix}menu`, buttonText: { displayText: '🔙 BACK TO MENU' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== CHANNEL COMMAND ====================
                case 'channel':
                case 'ch': {
                    const channelText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   📢 𝐉𝐎𝐈𝐍 𝐎𝐔𝐑 𝐂𝐇𝐀𝐍𝐍𝐄𝐋*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓*

*📱 𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐂𝐇𝐀𝐍𝐍𝐄𝐋*
◈ *Get latest updates*
◈ *New features*
◈ *Commands & Tutorials*
◈ *Support & Help*

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: channelText,
                        buttons: [
                            { buttonId: `${userPrefix}joinchannel`, buttonText: { displayText: '📢 JOIN CHANNEL' }, type: 1 },
                            { buttonId: `${userPrefix}menu`, buttonText: { displayText: '🔙 BACK TO MENU' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== JOIN CHANNEL COMMAND ====================
                case 'joinchannel':
                case 'jc': {
                    const ownerNumber = config.OWNER_NUMBER.replace('+', '');
                    
                    const joinText = `*📢 𝐉𝐎𝐈𝐍 𝐎𝐔𝐑 𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐂𝐇𝐀𝐍𝐍𝐄𝐋*

*🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓*

Click the button below to contact owner and join our WhatsApp channel to get:

✅ Latest bot updates
✅ New commands
✅ Tutorials & guides
✅ Support & help
✅ Exclusive features

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: joinText,
                        buttons: [
                            { buttonId: `https://wa.me/${ownerNumber}?text=Hello%20${config.OWNER_NAME}%20I%20want%20to%20join%20SO%20X%20MINI%20Bot%20channel`, buttonText: { displayText: '📢 JOIN NOW' }, type: 1 },
                            { buttonId: `${userPrefix}channel`, buttonText: { displayText: '🔙 BACK' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== COPY BOT COMMAND ====================
                case 'copybot':
                case 'copy':
                case 'cb': {
                    const botNumber = socket.user.id.split(':')[0];
                    const botLink = `https://wa.me/${botNumber}?text=${encodeURIComponent('.menu')}`;
                    
                    const copyText = `*🤖 𝐂𝐎𝐏𝐘 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓*

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*📱 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍*
◈ *Bot Name* : ${config.BOT_NAME}
◈ *Developer* : ${config.DEV_NAME}
◈ *Version* : ${CURRENT_VERSION}
◈ *Active Sessions* : ${activeSockets.size}

*🔗 𝐁𝐎𝐓 𝐋𝐈𝐍𝐊*
Click the button below to chat with this bot

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: copyText,
                        buttons: [
                            { buttonId: botLink, buttonText: { displayText: '🤖 COPY BOT' }, type: 1 },
                            { buttonId: `${userPrefix}menu`, buttonText: { displayText: '🔙 BACK TO MENU' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== OWNER COMMAND ====================
                case 'owner': {
                    const ownerNumber = config.OWNER_NUMBER;
                    const ownerName = config.OWNER_NAME;
                    
                    const ownerText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   👑 𝐁𝐎𝐓 𝐎𝐖𝐍𝐄𝐑*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*👨‍💻 𝐎𝐖𝐍𝐄𝐑 𝐈𝐍𝐅𝐎*

◈ *Name* : ${ownerName}
◈ *Number* : ${ownerNumber}
◈ *Bot* : ${config.BOT_NAME}
◈ *Version* : ${CURRENT_VERSION}

*📱 𝐂𝐎𝐍𝐓𝐀𝐂𝐓 𝐎𝐖𝐍𝐄𝐑*
Click the button below to chat with owner

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;

                    await socket.sendMessage(from, {
                        text: ownerText,
                        buttons: [
                            { buttonId: `https://wa.me/${ownerNumber.replace('+', '')}?text=Hello%20${ownerName}%20I%20need%20help%20with%20SO%20X%20MINI%20Bot`, buttonText: { displayText: '📱 CONTACT OWNER' }, type: 1 },
                            { buttonId: `${userPrefix}menu`, buttonText: { displayText: '🔙 BACK TO MENU' }, type: 1 }
                        ],
                        viewOnce: false,
                        headerType: 1
                    }, { quoted: msg });
                    break;
                }
                
                // ==================== PING COMMAND ====================
                case 'ping': {
                    const start = Date.now();
                    const sentMsg = await socket.sendMessage(from, { text: "🏓 *Pinging...*" }, { quoted: msg });
                    const end = Date.now();
                    const ping = end - start;
                    
                    await socket.sendMessage(from, {
                        text: `🏓 *Pong!*\n⏱️ Latency: ${ping}ms\n\n${config.BOT_FOOTER}`,
                        edit: sentMsg.key
                    });
                    break;
                }
                
                // ==================== SYSTEM COMMAND ====================
                case 'system':
                case 'sys': {
                    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
                    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
                    const usedMem = (totalMem - freeMem).toFixed(2);
                    const cpuUsage = os.loadavg()[0].toFixed(2);
                    
                    const systemText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🖥️ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐈𝐍𝐅𝐎*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*📊 𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐈𝐒𝐓𝐈𝐂𝐒*

◈ 💾 *Total RAM* : ${totalMem} GB
◈ 📊 *Used RAM* : ${usedMem} GB
◈ 🆓 *Free RAM* : ${freeMem} GB
◈ 🔥 *CPU Load* : ${cpuUsage}%
◈ 🤖 *Active Bots* : ${activeSockets.size}
◈ ⏱️ *Uptime* : ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m

*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐁𝐘 ${config.DEV_NAME.toUpperCase()}*
*┗━━━━━━━━━━━━━━━━━━━━┛*

${config.BOT_FOOTER}`;
                    
                    await m.reply(systemText);
                    break;
                }
                
                // ==================== SIMPLE SONG COMMAND ====================
                case 'song': {
                    const q = args.join(" ");
                    if (!q) {
                        await m.reply('*🚫 Please enter YouTube song name or link.*\n\n📌 *Example:* `.song Believer - Imagine Dragons`');
                        break;
                    }

                    await m.react('🎧');
                    await m.reply('*⏳ Searching for song...*');

                    try {
                        let videoUrl = q;
                        
                        if (!q.includes("youtube.com") && !q.includes("youtu.be")) {
                            const searchUrl = `${config.API_BASE_URL}/search/youtube?q=${encodeURIComponent(q)}`;
                            const searchRes = await axios.get(searchUrl);
                            
                            if (!searchRes.data?.result?.[0]?.url) {
                                await m.reply('*🚩 No results found for your search.*');
                                break;
                            }
                            videoUrl = searchRes.data.result[0].url;
                        }

                        const audioApi = `${config.API_BASE_URL}/download/ytmp3?url=${encodeURIComponent(videoUrl)}`;
                        const data = await axios.get(audioApi);

                        if (!data.data?.result) {
                            await m.reply('*🚩 Failed to fetch song details.*');
                            break;
                        }

                        const { title, artist, duration, download } = data.data.result;

                        const caption = `*🎧 SO X MINI Song Downloader*\n\n` +
                                        `┏━━━━━━━━━━━━━━━━\n` +
                                        `◈ 🎵 *Title:* ${title || 'Unknown'}\n` +
                                        `◈ 👤 *Artist:* ${artist || 'Unknown'}\n` +
                                        `◈ ⏱️ *Duration:* ${duration || 'Unknown'}\n` +
                                        `┗━━━━━━━━━━━━━━━━\n\n${config.BOT_FOOTER}`;

                        await socket.sendMessage(from, {
                            audio: { url: download.url },
                            mimetype: 'audio/mpeg',
                            caption: caption
                        }, { quoted: msg });

                    } catch (err) {
                        console.error("Song Error:", err);
                        await m.reply('*❌ Failed to download song. Please try again later.*');
                    }
                    break;
                }
                
                // ==================== FACEBOOK COMMAND ====================
                case 'fb':
                case 'facebook': {
                    const q = args.join(" ");
                    if (!q || !q.startsWith('http')) {
                        await m.reply('*🚫 Please provide a valid Facebook video link.*\n\n📌 *Example:* `.fb https://fb.watch/abcd1234/`');
                        break;
                    }

                    await m.react('📘');
                    await m.reply('*⏳ Downloading Facebook video...*');

                    try {
                        const apiUrl = `${config.API_BASE_URL}/download/facebook?url=${encodeURIComponent(q)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data.result) {
                            await m.reply('*🚩 Failed to fetch Facebook video.*');
                            break;
                        }

                        const { title, duration, quality, download } = data.result;

                        const caption = `*📘 SO X MINI Facebook Downloader*\n\n` +
                                        `┏━━━━━━━━━━━━━━━━\n` +
                                        `◈ 📖 *Title:* ${title || 'Facebook Video'}\n` +
                                        `◈ ⏱️ *Duration:* ${duration || 'Unknown'}\n` +
                                        `◈ 🎯 *Quality:* ${quality || 'HD'}\n` +
                                        `┗━━━━━━━━━━━━━━━━\n\n${config.BOT_FOOTER}`;

                        await socket.sendMessage(from, {
                            video: { url: download.url },
                            caption: caption
                        }, { quoted: msg });

                    } catch (err) {
                        console.error("Facebook Error:", err);
                        await m.reply('*❌ Failed to download Facebook video.*');
                    }
                    break;
                }
                
                // ==================== TIKTOK COMMAND ====================
                case 'tiktok':
                case 'ttdl':
                case 'tt': {
                    const q = args.join(" ");
                    if (!q || !q.includes("tiktok.com")) {
                        await m.reply('*🚫 Please provide a valid TikTok video link.*\n\n📌 *Example:* `.tiktok https://www.tiktok.com/@user/video/xyz`');
                        break;
                    }

                    await m.react('🎵');
                    await m.reply('*⏳ Downloading TikTok video...*');

                    try {
                        const apiUrl = `${config.API_BASE_URL}/download/tiktok?url=${encodeURIComponent(q)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data.result) {
                            await m.reply('*🚩 Failed to fetch TikTok video.*');
                            break;
                        }

                        const { title, author, duration, download } = data.result;

                        const caption = `*🎵 SO X MINI TikTok Downloader*\n\n` +
                                        `┏━━━━━━━━━━━━━━━━\n` +
                                        `◈ 👤 *Author:* ${author || 'Unknown'}\n` +
                                        `◈ 📖 *Title:* ${title || 'No title'}\n` +
                                        `◈ ⏱️ *Duration:* ${duration || 'Unknown'}\n` +
                                        `┗━━━━━━━━━━━━━━━━\n\n${config.BOT_FOOTER}`;

                        await socket.sendMessage(from, {
                            video: { url: download.url },
                            caption: caption
                        }, { quoted: msg });

                    } catch (err) {
                        console.error("TikTok Error:", err);
                        await m.reply('*❌ Failed to download TikTok video.*');
                    }
                    break;
                }
                
                // ==================== INSTAGRAM COMMAND ====================
                case 'ig':
                case 'instagram': {
                    const q = args.join(" ");
                    if (!q || !q.includes("instagram.com")) {
                        await m.reply('*🚫 Please provide a valid Instagram video/reel link.*\n\n📌 *Example:* `.ig https://www.instagram.com/reel/xyz`');
                        break;
                    }

                    await m.react('📸');
                    await m.reply('*⏳ Downloading Instagram video...*');

                    try {
                        const apiUrl = `${config.API_BASE_URL}/download/instagram?url=${encodeURIComponent(q)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data.result) {
                            await m.reply('*🚩 Failed to fetch Instagram video.*');
                            break;
                        }

                        const { title, type, download } = data.result;

                        const caption = `*📸 SO X MINI Instagram Downloader*\n\n` +
                                        `┏━━━━━━━━━━━━━━━━\n` +
                                        `◈ 📖 *Type:* ${type || 'Video'}\n` +
                                        `┗━━━━━━━━━━━━━━━━\n\n${config.BOT_FOOTER}`;

                        if (type === 'video' || download.url.includes('.mp4')) {
                            await socket.sendMessage(from, {
                                video: { url: download.url },
                                caption: caption
                            }, { quoted: msg });
                        } else {
                            await socket.sendMessage(from, {
                                image: { url: download.url },
                                caption: caption
                            }, { quoted: msg });
                        }

                    } catch (err) {
                        console.error("Instagram Error:", err);
                        await m.reply('*❌ Failed to download Instagram video.*');
                    }
                    break;
                }
                
                // ==================== YOUTUBE VIDEO COMMAND ====================
                case 'ytvideo':
                case 'ytv': {
                    const q = args.join(" ");
                    if (!q) {
                        await m.reply('*🚫 Please provide a YouTube video link.*\n\n📌 *Example:* `.ytvideo https://youtu.be/xyz`');
                        break;
                    }

                    await m.react('🎬');
                    await m.reply('*⏳ Downloading YouTube video...*');

                    try {
                        const apiUrl = `${config.API_BASE_URL}/download/ytmp4?url=${encodeURIComponent(q)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data.result) {
                            await m.reply('*🚩 Failed to fetch YouTube video.*');
                            break;
                        }

                        const { title, duration, quality, download } = data.result;

                        const caption = `*🎬 SO X MINI YouTube Video*\n\n` +
                                        `┏━━━━━━━━━━━━━━━━\n` +
                                        `◈ 📹 *Title:* ${title}\n` +
                                        `◈ ⏱️ *Duration:* ${duration}\n` +
                                        `◈ 🎯 *Quality:* ${quality}\n` +
                                        `┗━━━━━━━━━━━━━━━━\n\n${config.BOT_FOOTER}`;

                        await socket.sendMessage(from, {
                            video: { url: download.url },
                            caption: caption
                        }, { quoted: msg });

                    } catch (err) {
                        console.error("YouTube Video Error:", err);
                        await m.reply('*❌ Failed to download YouTube video.*');
                    }
                    break;
                }
                
                // ==================== FANCY COMMAND ====================
                case 'fancy': {
                    const q = args.join(" ");
                    if (!q) {
                        await m.reply("❎ *Please provide text to convert into fancy fonts.*\n\n📌 *Example:* `.fancy SO X MINI`");
                        break;
                    }

                    try {
                        const apiUrl = `https://www.dark-yasiya-api.site/other/font?text=${encodeURIComponent(q)}`;
                        const response = await axios.get(apiUrl);

                        if (!response.data.status || !response.data.result) {
                            await m.reply("❌ *Error fetching fonts from API.*");
                            break;
                        }

                        const fontList = response.data.result
                            .slice(0, 10)
                            .map(font => `*${font.name}:*\n${font.result}`)
                            .join("\n\n");

                        const finalMessage = `*🎨 Fancy Fonts Converter*\n\n${fontList}\n\n${config.BOT_FOOTER}`;

                        await m.reply(finalMessage);

                    } catch (err) {
                        console.error("Fancy Font Error:", err);
                        await m.reply("⚠️ *An error occurred while converting to fancy fonts.*");
                    }
                    break;
                }
                
                // ==================== VV COMMAND (VIEW ONCE) ====================
                case 'vv':
                case 'viewonce':
                case 'vo': {
                    try {
                        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        
                        if (!quotedMsg) {
                            await m.reply('❌ *Reply to a view once message!*\n\n📌 *Usage:* Reply to a view once image/video/voice with `.vv`');
                            break;
                        }
                        
                        let mediaMessage = null;
                        let mediaType = null;
                        
                        if (quotedMsg.viewOnceMessageV2?.message) {
                            const v2Msg = quotedMsg.viewOnceMessageV2.message;
                            if (v2Msg.imageMessage) {
                                mediaMessage = v2Msg.imageMessage;
                                mediaType = 'image';
                            } else if (v2Msg.videoMessage) {
                                mediaMessage = v2Msg.videoMessage;
                                mediaType = 'video';
                            } else if (v2Msg.audioMessage) {
                                mediaMessage = v2Msg.audioMessage;
                                mediaType = 'audio';
                            }
                        } else if (quotedMsg.viewOnceMessage?.message) {
                            const v1Msg = quotedMsg.viewOnceMessage.message;
                            if (v1Msg.imageMessage) {
                                mediaMessage = v1Msg.imageMessage;
                                mediaType = 'image';
                            } else if (v1Msg.videoMessage) {
                                mediaMessage = v1Msg.videoMessage;
                                mediaType = 'video';
                            } else if (v1Msg.audioMessage) {
                                mediaMessage = v1Msg.audioMessage;
                                mediaType = 'audio';
                            }
                        }
                        
                        if (!mediaMessage || !mediaType) {
                            await m.reply('❌ *Not a valid view once message!*');
                            break;
                        }
                        
                        await m.react('📥');
                        
                        const stream = await downloadContentFromMessage(
                            mediaMessage,
                            mediaType === 'image' ? 'image' : (mediaType === 'video' ? 'video' : 'audio')
                        );
                        
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }
                        
                        if (mediaType === 'image') {
                            await socket.sendMessage(from, {
                                image: buffer,
                                caption: `✅ *View Once Image Retrieved*\n\n${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        } else if (mediaType === 'video') {
                            await socket.sendMessage(from, {
                                video: buffer,
                                caption: `✅ *View Once Video Retrieved*\n\n${config.BOT_FOOTER}`,
                                mimetype: mediaMessage.mimetype || 'video/mp4'
                            }, { quoted: msg });
                        } else if (mediaType === 'audio') {
                            await socket.sendMessage(from, {
                                audio: buffer,
                                mimetype: mediaMessage.mimetype || 'audio/mpeg',
                                ptt: true
                            }, { quoted: msg });
                        }
                        
                        await m.react('✅');
                        
                    } catch (err) {
                        console.error('VV Command Error:', err);
                        await m.reply('❌ *Failed to download view once media!*');
                    }
                    break;
                }
                
                // ==================== SET COMMAND ====================
                case 'set': {
                    if (args.length < 2) {
                        const currentPrefix = userConfig.PREFIX || config.PREFIX;
                        await socket.sendMessage(from, {
                            text: `*📱 SETTINGS USAGE*\n\n` +
                                  `*Format:* \`${currentPrefix}set <key> <value>\`\n\n` +
                                  `*Available Keys:*\n` +
                                  `▸ AUTO_VIEW_STATUS (true/false)\n` +
                                  `▸ AUTO_LIKE_STATUS (true/false)\n` +
                                  `▸ AUTO_LIKE_EMOJI (emojis)\n` +
                                  `▸ BUTTON_MODE (button/text)\n` +
                                  `▸ SHOW_LAST_SEEN (true/false)\n\n` +
                                  `*Quick Settings:*`,
                            buttons: [
                                { buttonId: `${currentPrefix}set AUTO_VIEW_STATUS true`, buttonText: { displayText: '👀 VIEW STATUS ON' }, type: 1 },
                                { buttonId: `${currentPrefix}set AUTO_VIEW_STATUS false`, buttonText: { displayText: '👀 VIEW STATUS OFF' }, type: 1 },
                                { buttonId: `${currentPrefix}set AUTO_LIKE_STATUS true`, buttonText: { displayText: '❤️ REACT ON' }, type: 1 },
                                { buttonId: `${currentPrefix}set AUTO_LIKE_STATUS false`, buttonText: { displayText: '❤️ REACT OFF' }, type: 1 },
                                { buttonId: `${currentPrefix}set BUTTON_MODE button`, buttonText: { displayText: '🛹 BUTTON MODE' }, type: 1 },
                                { buttonId: `${currentPrefix}set BUTTON_MODE text`, buttonText: { displayText: '📝 TEXT MODE' }, type: 1 }
                            ]
                        }, { quoted: msg });
                        break;
                    }
                    
                    const key = args[0].toUpperCase();
                    let value = args.slice(1).join(' ');
                    
                    if (key === 'AUTO_LIKE_EMOJI') {
                        const emojis = value.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
                        if (emojis.length === 0) {
                            await m.reply('❌ Please provide valid emojis.');
                            break;
                        }
                        value = emojis;
                    } else if (value === 'true') {
                        value = true;
                    } else if (value === 'false') {
                        value = false;
                    }

                    let userConfigData = await loadUserConfig(senderNumber);
                    userConfigData[key] = value;
                    await updateUserConfig(senderNumber, userConfigData);
                    
                    let displayValue = Array.isArray(value) ? value.join(' ') : value;
                    await m.react('✅');
                    await m.reply(`*✅ SETTING UPDATED*\n\n🔑 *Key:* ${key}\n📱 *Value:* ${displayValue}\n\n${config.BOT_FOOTER}`);
                    break;
                }
                
                // ==================== DEFAULT CASE ====================
                default: {
                    if (command) {
                        await m.reply(`❌ Unknown command: ${command}\n\nType *${userPrefix}menu* for available commands.`);
                    }
                    break;
                }
            }
            
        } catch (error) {
            console.error('Command handler error:', error);
            try {
                await socket.sendMessage(msg.key.remoteJid, { 
                    text: '❌ An error occurred while processing your command.' 
                }, { quoted: msg });
            } catch (e) {
                console.error('Failed to send error message:', e);
            }
        }
    });
}

// ==================== STATUS HANDLERS ====================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
        
        try {
            const statusOwner = message.key.participant.split('@')[0];
            const userConfig = await loadUserConfig(statusOwner);
            
            if (userConfig.AUTO_VIEW_STATUS === true) {
                await socket.readMessages([message.key]);
            }
            
            if (userConfig.AUTO_LIKE_STATUS === true) {
                const randomEmoji = userConfig.AUTO_LIKE_EMOJI?.[Math.floor(Math.random() * userConfig.AUTO_LIKE_EMOJI.length)] || '🦚';
                await socket.sendMessage(message.key.remoteJid, { 
                    react: { text: randomEmoji, key: message.key } 
                }, { statusJidList: [message.key.participant] });
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}

// ==================== GROUP & CONNECTION FUNCTIONS ====================
async function joinGroup(socket) {
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) return { status: 'failed', error: 'Invalid invite link' };
    try {
        const response = await socket.groupAcceptInvite(inviteCodeMatch[1]);
        return response?.gid ? { status: 'success', gid: response.gid } : { status: 'failed', error: 'No response' };
    } catch (error) {
        return { status: 'failed', error: error.message };
    }
}

async function sendAdminConnectMessage(socket, number) {
    const admins = loadAdmins();
    const caption = formatMessage('💥 CONNECTED', `📞 Number: ${number}\n🤖 Bot: ${config.BOT_NAME}`, config.BOT_NAME);
    for (const admin of admins) {
        try {
            await socket.sendMessage(`${admin}@s.whatsapp.net`, { image: { url: config.RCD_IMAGE_PATH }, caption });
        } catch (error) {}
    }
}

function setupAutoRestart(socket, number) {
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ ${number} Connected!`);
            reconnectAttempts.delete(number);
            
            // Send welcome message to owner when bot connects
            const ownerJid = `${config.OWNER_NUMBER.replace('+', '')}@s.whatsapp.net`;
            const welcomeText = `*┏━━━━━━━━━━━━━━━━━━━━┓*
*┃   🦚 𝐒𝐎 𝐗 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 🛹*
*┃   𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃*
*┗━━━━━━━━━━━━━━━━━━━━┛*

*📊 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎*
◈ *Bot Name* : ${config.BOT_NAME}
◈ *Number* : ${socket.user.id.split(':')[0]}
◈ *Version* : ${CURRENT_VERSION}
◈ *Developer* : ${config.DEV_NAME}

${config.BOT_FOOTER}`;

            await socket.sendMessage(ownerJid, {
                text: welcomeText,
                buttons: [
                    { buttonId: `.menu`, buttonText: { displayText: '📋 MENU' }, type: 1 },
                    { buttonId: `.settings`, buttonText: { displayText: '⚙️ SETTINGS' }, type: 1 }
                ]
            });
        }
        if (connection === 'close') {
            const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
            if (isLoggedOut) {
                console.log(`🚫 ${number} logged out. Deleting session...`);
                await deleteSessionFromMongoDB(number);
                activeSockets.delete(number);
                socketCreationTime.delete(number);
            } else {
                const attempts = (reconnectAttempts.get(number) || 0) + 1;
                if (attempts <= config.MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts.set(number, attempts);
                    console.log(`🔄 Reconnecting ${number} (${attempts}/${config.MAX_RECONNECT_ATTEMPTS})...`);
                    await delay(config.RECONNECT_INTERVAL);
                    const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                    await EmpirePair(number, mockRes);
                } else {
                    console.log(`❌ Max reconnection attempts for ${number}`);
                    reconnectAttempts.delete(number);
                }
            }
        }
    });
}

// ==================== MAIN PAIRING FUNCTION ====================
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
    await fs.ensureDir(sessionPath);

    const restoredCreds = await loadSessionFromMongoDB(sanitizedNumber);
    if (restoredCreds) {
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`✅ Session loaded from MongoDB for ${sanitizedNumber}`);
    }

const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
const logger = pino({ level: 'fatal' });

try {
    const socket = makeWASocket({
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, logger) 
        },
        printQRInTerminal: false,
        logger,
        browser: ['Mac OS', 'Safari', '10.15.7'], // ✅ FIXED
        markOnlineOnConnect: true,
    });

        socketCreationTime.set(sanitizedNumber, Date.now());
        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupAutoRestart(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let code;
            let retries = 3;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    if (retries === 0) {
                        if (!res.headersSent) res.status(500).send({ error: 'Failed to generate pairing code' });
                        return;
                    }
                    await delay(2000);
                }
            }
            if (!res.headersSent) res.send({ code });
        } else {
            if (!res.headersSent) res.send({ status: 'connected', message: 'Already registered' });
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            await saveSessionToMongoDB(sanitizedNumber, JSON.parse(fileContent));
        });

        socket.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                await delay(3000);
                await joinGroup(socket);
                activeSockets.set(sanitizedNumber, socket);
                await saveNumberToMongoDB(sanitizedNumber);
                
                await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: formatMessage(`💥 WELCOME TO ${config.BOT_NAME}`, `✅ Connected!\n🔢 Number: ${sanitizedNumber}`, config.BOT_NAME)
                }, { quoted: shonux });
                
                await sendAdminConnectMessage(socket, sanitizedNumber);
                console.log(`🎉 ${sanitizedNumber} is online!`);
            }
        });

        return socket;
    } catch (error) {
        console.error('Pairing error:', error);
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
}

// ==================== API ROUTES ====================
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).send({ error: 'Number parameter is required' });
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({ status: 'already_connected', message: 'Already connected' });
    }
    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys()),
        uptime: Object.fromEntries(Array.from(socketCreationTime.entries()).map(([num, time]) => [num, Math.floor((Date.now() - time) / 1000)]))
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: `✨ ${config.BOT_NAME} ✨ running | 👑 ${config.DEV_NAME}`,
        activeSessions: activeSockets.size,
        timestamp: getSriLankaTimestamp()
    });
});

router.get('/disconnect/:number', async (req, res) => {
    const sanitizedNumber = req.params.number.replace(/[^0-9]/g, '');
    try {
        if (activeSockets.has(sanitizedNumber)) {
            const socket = activeSockets.get(sanitizedNumber);
            await socket.logout();
            socket.ws.close();
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);
            await deleteSessionFromMongoDB(sanitizedNumber);
            res.status(200).send({ status: 'success', message: `Bot ${sanitizedNumber} disconnected` });
        } else {
            res.status(404).send({ error: 'Bot not found' });
        }
    } catch (error) {
        res.status(500).send({ error: 'Failed to disconnect bot' });
    }
});

// ==================== AUTO-RECONNECT ====================
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        try { socket.ws.close(); } catch (error) {}
        activeSockets.delete(number);
    });
});

process.on('uncaughtException', (err) => console.error('❌ Uncaught exception:', err));
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled rejection:', reason));

// Auto reconnect from MongoDB on startup
setTimeout(async () => {
    console.log('🔄 Checking for existing sessions in MongoDB...');
    const numbers = await getAllNumbersFromMongoDB();
    console.log(`📊 Found ${numbers.length} numbers to reconnect`);
    for (const number of numbers) {
        if (!activeSockets.has(number)) {
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
            await delay(2000);
        }
    }
}, 10000);

// Health check interval
setInterval(() => {
    const now = Date.now();
    activeSockets.forEach((socket, number) => {
        if (!socket.ws || socket.ws.readyState !== 1) {
            console.log(`⚠️ Socket ${number} disconnected, attempting reconnect...`);
            activeSockets.delete(number);
            socketCreationTime.delete(number);
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            EmpirePair(number, mockRes).catch(err => console.error(`Failed to reconnect ${number}:`, err.message));
        } else {
            try {
                socket.sendPresenceUpdate('available');
            } catch (e) {}
        }
    });
}, 60 * 1000);

module.exports = router;
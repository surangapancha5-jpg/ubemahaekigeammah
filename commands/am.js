const mongoose = require('mongoose');
const { updateBotSettings } = require('../lib/settingsHelper');

const MetaSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const BotMeta = mongoose.models.ZantaMeta || mongoose.model('ZantaMeta', MetaSchema, 'darkdinumetas');

function cleanNumber(value) {
  return String(value || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function getTarget(msg, args) {
  const context = msg.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = context.mentionedJid?.[0];
  const quoted = context.participant;
  const raw = mentioned || quoted || args[0];
  const number = cleanNumber(raw);
  return number.length >= 7 ? number : null;
}

async function saveFeature(botNumber, name, value) {
  const key = `features_${botNumber}`;
  const current = await BotMeta.findOne({ key }).lean();
  const features = current?.value && typeof current.value === 'object' ? current.value : {};
  features[name] = value;
  await BotMeta.findOneAndUpdate({ key }, { $set: { value: features } }, { upsert: true });
}

module.exports = {
  name: 'manage',
  alias: ['welcome', 'status', 'anti', 'ban', 'unban', 'unbab', 'block', 'unblock', 'autoreact', 'public', 'private', 'group', 'inbox'],
  desc: 'Manage bot features and chat access',
  category: 'owner',
  async execute(sock, msg, args, from, ctx) {
    const { reply, isOwner, isDev, currentBotNumber, settings } = ctx;
    if (!isOwner && !isDev) return reply('❌ Owner only command.');
    if (!currentBotNumber) return reply('❌ Bot number could not be detected.');

    const invoked = (ctx.body || '').trim().split(/\s+/)[0].replace(ctx.prefix || '.', '').toLowerCase();
    const action = (args[0] || '').toLowerCase();
    const state = (args[1] || '').toLowerCase();
    const enabled = state === 'on';
    const validState = state === 'on' || state === 'off';

    if (['public', 'private', 'group', 'inbox'].includes(invoked)) {
      const mode = invoked === 'group' ? 'groups' : invoked;
      await updateBotSettings(currentBotNumber, { workMode: mode });
      return reply(`✅ Work mode changed to *${mode.toUpperCase()}*.`);
    }

    if (invoked === 'welcome' || (invoked === 'manage' && action === 'welcome')) {
      const on = invoked === 'welcome' ? action : state;
      if (!['on', 'off'].includes(on)) return reply('Use: .welcome on/off');
      await saveFeature(currentBotNumber, 'welcome', on === 'on');
      return reply(`✅ Welcome message ${on === 'on' ? 'enabled' : 'disabled'}.`);
    }

    if (invoked === 'autoreact' || (invoked === 'manage' && action === 'autoreact')) {
      const on = invoked === 'autoreact' ? action : state;
      if (!['on', 'off'].includes(on)) return reply('Use: .autoreact on/off');
      await saveFeature(currentBotNumber, 'autoReact', on === 'on');
      return reply(`✅ Auto-react ${on === 'on' ? 'enabled' : 'disabled'}.`);
    }

    if (invoked === 'anti' || (invoked === 'manage' && action === 'anti')) {
      const feature = invoked === 'anti' ? action : state;
      const on = invoked === 'anti' ? state : args[2]?.toLowerCase();
      if (feature !== 'call' || !['on', 'off'].includes(on)) return reply('Use: .anti call on/off');
      await saveFeature(currentBotNumber, 'antiCall', on === 'on');
      return reply(`✅ Anti-call ${on === 'on' ? 'enabled' : 'disabled'}.`);
    }

    if (invoked === 'status' || (invoked === 'manage' && action === 'status')) {
      const kind = invoked === 'status' ? action : state;
      const on = invoked === 'status' ? state : args[2]?.toLowerCase();
      if (!['on', 'off'].includes(on)) return reply('Use: .status views on/off OR .status react on/off');
      if (kind === 'views') {
        await updateBotSettings(currentBotNumber, { statusSeen: on === 'on' });
        return reply(`✅ Status views ${on === 'on' ? 'enabled' : 'disabled'}.`);
      }
      if (kind === 'react') {
        await updateBotSettings(currentBotNumber, { statusReact: on === 'on' ? '💚' : 'off' });
        return reply(`✅ Status reaction ${on === 'on' ? 'enabled' : 'disabled'}.`);
      }
      return reply('Use: .status views on/off OR .status react on/off');
    }

    if (['ban', 'unban', 'unbab'].includes(invoked) || (invoked === 'manage' && ['ban', 'unban', 'unbab'].includes(action))) {
      const operation = invoked === 'manage' ? action : invoked;
      const target = getTarget(msg, invoked === 'manage' ? args.slice(1) : args);
      if (!target) return reply(`Tag or reply to a user. Usage: .${operation} @user`);
      const key = `banned_${currentBotNumber}`;
      const doc = await BotMeta.findOne({ key }).lean();
      let list = Array.isArray(doc?.value) ? doc.value : [];
      if (operation === 'ban') {
        if (target === currentBotNumber || target === cleanNumber(ctx.DEVELOPER_NUMBER)) return reply('❌ Cannot ban the bot owner/developer.');
        if (!list.includes(target)) list.push(target);
      } else {
        list = list.filter(item => cleanNumber(item) !== target);
      }
      await BotMeta.findOneAndUpdate({ key }, { $set: { value: list } }, { upsert: true });
      return reply(operation === 'ban' ? `🚫 +${target} is now banned from using the bot.` : `✅ +${target} can use the bot again.`);
    }

    if (invoked === 'block' || invoked === 'unblock' || (invoked === 'manage' && ['block', 'unblock'].includes(action))) {
      const operation = invoked === 'manage' ? action : invoked;
      const target = getTarget(msg, invoked === 'manage' ? args.slice(1) : args);
      if (!target) return reply(`Tag or reply to a user. Usage: .${operation} @user`);
      await sock.updateBlockStatus(`${target}@s.whatsapp.net`, operation);
      return reply(`✅ +${target} ${operation === 'block' ? 'blocked' : 'unblocked'}.`);
    }

    return reply('Commands: .welcome on/off, .status views on/off, .status react on/off, .anti call on/off, .ban, .unban, .block, .unblock, .autoreact on/off, .public, .private, .group, .inbox');
  }
};

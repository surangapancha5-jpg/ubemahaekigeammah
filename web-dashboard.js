// ════════════════ ZANTA-XMD DASHBOARD AUTH & API ════════════════════════
// MongoDB-backed accounts, persistent login sessions, profile settings and pairing API.
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

module.exports = function attachDashboard(app, options) {
  const { mongoose, requestPairCode, botName, botLogo, developerName, commandsDir } = options;
  const Schema = mongoose.Schema;

  // ════════════════ DATABASE MODELS ════════════════════════
  const User = mongoose.models.ZantaWebUser || mongoose.model('ZantaWebUser', new Schema({
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 24 },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    logoData: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }, { collection: 'zanta_web_users' }));

  const WebSession = mongoose.models.ZantaWebSession || mongoose.model('ZantaWebSession', new Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    createdAt: { type: Date, default: Date.now }
  }, { collection: 'zanta_web_sessions' }));

  // ════════════════ SECURITY HELPERS ════════════════════════
  const COOKIE = 'zanta_web_session';
  const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
  const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
  const safeUser = user => ({ username: user.username, initial: user.username.charAt(0).toUpperCase(), logo: user.logoData || '', createdAt: user.createdAt });
  const cookieOptions = (maxAge, req) => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${(process.env.NODE_ENV === 'production' || req?.headers?.['x-forwarded-proto'] === 'https') ? '; Secure' : ''}`;
  function readCookie(req, name) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const index = part.indexOf('=');
      if (index < 0) continue;
      if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
    }
    return '';
  }
  async function makePassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = await scrypt(password, salt, 64);
    return { salt, hash: key.toString('hex') };
  }
  async function checkPassword(password, user) {
    const key = await scrypt(password, user.passwordSalt, 64);
    const a = Buffer.from(user.passwordHash, 'hex');
    const b = Buffer.from(key.toString('hex'), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  async function createSession(res, user, req) {
    const token = crypto.randomBytes(32).toString('hex');
    await WebSession.create({ tokenHash: hashToken(token), userId: user._id, expiresAt: new Date(Date.now() + SESSION_MS) });
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; ${cookieOptions(SESSION_MS / 1000, req)}`);
  }
  async function getUser(req) {
    const token = readCookie(req, COOKIE);
    if (!token || token.length > 200) return null;
    const session = await WebSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) return null;
    return User.findById(session.userId);
  }
  const requireAuth = async (req, res, next) => {
    try {
      req.webUser = await getUser(req);
      if (!req.webUser) return res.status(401).json({ error: 'Please log in to continue.' });
      next();
    } catch (error) { console.error('[WEB AUTH]', error.message); res.status(503).json({ error: 'Database temporarily unavailable.' }); }
  };
  const validUsername = value => /^[a-zA-Z0-9_]{3,24}$/.test(String(value || ''));
  const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 128;

  // ════════════════ PUBLIC WEBSITE & LIVE STATISTICS ════════════════
  app.get('/', (req, res) => res.sendFile(require('path').join(__dirname, 'public', 'index.html')));
  app.get('/api/stats', async (req, res) => {
    try {
      const [botCount, commandCount] = await Promise.all([
        mongoose.connection.db ? mongoose.connection.db.collection('darkdinusessions').countDocuments({}) : 0,
        Promise.resolve(require('fs').existsSync(commandsDir) ? require('fs').readdirSync(commandsDir).filter(file => file.endsWith('.js')).length : 0)
      ]);
      res.set('Cache-Control', 'no-store').json({ botCount, commandCount, status: mongoose.connection.readyState === 1 ? 'online' : 'connecting' });
    } catch (error) { res.status(503).json({ botCount: 0, commandCount: 0, status: 'offline' }); }
  });

  // ════════════════ REGISTRATION & LOGIN ════════════════════════
  app.get('/api/auth/me', async (req, res) => {
    try { const user = await getUser(req); const hasAccounts = (await User.estimatedDocumentCount()) > 0; res.set('Cache-Control', 'no-store').json({ authenticated: !!user, hasAccounts, user: user ? safeUser(user) : null }); }
    catch { res.status(503).json({ error: 'Database temporarily unavailable.' }); }
  });
  app.post('/api/auth/register', async (req, res) => {
    try {
      const username = String(req.body.username || '').trim();
      const password = req.body.password;
      if (!validUsername(username)) return res.status(400).json({ error: 'Username must be 3–24 characters (letters, numbers or underscore).' });
      if (!validPassword(password)) return res.status(400).json({ error: 'Password must be 8–128 characters.' });
      if (await User.exists({ username: username.toLowerCase() })) return res.status(409).json({ error: 'That username is already taken.' });
      const credentials = await makePassword(password);
      const user = await User.create({ username: username.toLowerCase(), passwordHash: credentials.hash, passwordSalt: credentials.salt });
      await createSession(res, user, req);
      res.status(201).json({ success: true, user: safeUser(user) });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: 'That username is already taken.' });
      console.error('[REGISTER]', error.message); res.status(500).json({ error: 'Could not create account. Please try again.' });
    }
  });
  app.post('/api/auth/login', async (req, res) => {
    try {
      const username = String(req.body.username || '').trim().toLowerCase();
      const password = req.body.password;
      if (!username || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Enter a valid username and password.' });
      const user = await User.findOne({ username });
      if (!user || !(await checkPassword(password, user))) return res.status(401).json({ error: 'Incorrect username or password.' });
      await createSession(res, user, req);
      res.json({ success: true, user: safeUser(user) });
    } catch (error) { console.error('[LOGIN]', error.message); res.status(500).json({ error: 'Login failed. Please try again.' }); }
  });
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const token = readCookie(req, COOKIE);
      if (token) await WebSession.deleteOne({ tokenHash: hashToken(token) });
      res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieOptions(0, req)}`);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Could not log out.' }); }
  });

  // ════════════════ PROFILE, PASSWORD & LOGO SETTINGS ════════════════
  app.patch('/api/profile', requireAuth, async (req, res) => {
    try {
      const { username, currentPassword, newPassword } = req.body;
      if (username !== undefined) {
        const clean = String(username).trim();
        if (!validUsername(clean)) return res.status(400).json({ error: 'Username must be 3–24 characters (letters, numbers or underscore).' });
        const exists = await User.exists({ username: clean.toLowerCase(), _id: { $ne: req.webUser._id } });
        if (exists) return res.status(409).json({ error: 'That username is already taken.' });
        req.webUser.username = clean.toLowerCase();
      }
      if (newPassword !== undefined && newPassword !== '') {
        if (!await checkPassword(String(currentPassword || ''), req.webUser)) return res.status(401).json({ error: 'Current password is incorrect.' });
        if (!validPassword(newPassword)) return res.status(400).json({ error: 'New password must be 8–128 characters.' });
        const credentials = await makePassword(newPassword);
        req.webUser.passwordHash = credentials.hash;
        req.webUser.passwordSalt = credentials.salt;
      }
      await req.webUser.save();
      res.json({ success: true, user: safeUser(req.webUser) });
    } catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'That username is already taken.' }); res.status(500).json({ error: 'Could not update profile.' }); }
  });
  app.post('/api/profile/logo', requireAuth, async (req, res) => {
    try {
      const data = String(req.body.data || '');
      const match = data.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return res.status(400).json({ error: 'Choose a PNG, JPG, WEBP or GIF image.' });
      if (Buffer.from(match[2], 'base64').length > 1024 * 1024) return res.status(413).json({ error: 'Logo must be smaller than 1 MB.' });
      req.webUser.logoData = data;
      await req.webUser.save();
      res.json({ success: true, user: safeUser(req.webUser) });
    } catch { res.status(500).json({ error: 'Could not save logo.' }); }
  });

  // ════════════════ AUTHENTICATED WHATSAPP PAIRING ════════════════
  let pairingInProgress = false;
  app.post('/api/pair', requireAuth, async (req, res) => {
    if (pairingInProgress) return res.status(429).json({ error: 'Another pairing is in progress. Please wait a moment.' });
    let number = String(req.body.number || '').replace(/[^0-9]/g, '');
    if (number.startsWith('0')) number = '94' + number.slice(1);
    if (!/^94[0-9]{9}$/.test(number)) return res.status(400).json({ error: 'Enter a valid Sri Lankan number (07XXXXXXXX).' });
    pairingInProgress = true;
    try {
      const result = await requestPairCode(number);
      res.json({ success: true, code: result.code });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to generate pairing code.' }); }
    finally { pairingInProgress = false; }
  });
};

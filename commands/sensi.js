// ZANTA-XMD - Universal Free Fire Sensitivity Command
// Usage: .sensi Samsung Galaxy S24 Ultra
// Node.js 18+ recommended (uses global fetch)

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CACHE_FILE = path.join(DATA_DIR, "devices-cache.json");
const DEVICE_DB_URL =
  "https://raw.githubusercontent.com/bsthen/device-models/main/devices.json";

let deviceCache = null;
let lastFetch = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function loadLocalCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.error("[SENSI] Cache read error:", e.message);
  }
  return {};
}

async function getDeviceDatabase() {
  if (deviceCache && Date.now() - lastFetch < CACHE_TTL) return deviceCache;

  let cached = loadLocalCache();

  try {
    const response = await fetch(DEVICE_DB_URL, {
      headers: { "User-Agent": "ZANTA-XMD-Sensi/1.0" },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) throw new Error("Device database HTTP " + response.status);

    const fresh = await response.json();
    if (!fresh || typeof fresh !== "object") throw new Error("Invalid device database");

    deviceCache = fresh;
    lastFetch = Date.now();

    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(fresh));
    } catch (e) {
      console.error("[SENSI] Cache write error:", e.message);
    }
    return deviceCache;
  } catch (error) {
    console.error("[SENSI] Online database unavailable:", error.message);
    deviceCache = cached;
    lastFetch = Date.now();
    return deviceCache;
  }
}

function findDevice(db, query) {
  const wanted = normalize(query);
  if (!wanted) return null;

  let best = null;
  let bestScore = 0;

  for (const [code, item] of Object.entries(db)) {
    const brand = item?.brand || "";
    const marketingName = item?.name || item?.marketName || "";
    const fullName = normalize(`${brand} ${marketingName}`);
    const codeName = normalize(code);

    if (fullName === wanted || codeName === wanted) {
      return { code, brand, name: marketingName || code };
    }

    if (fullName.includes(wanted) || wanted.includes(fullName)) {
      const score = Math.min(wanted.length, fullName.length);
      if (score > bestScore) {
        bestScore = score;
        best = { code, brand, name: marketingName || code };
      }
    } else {
      const qWords = wanted.split(" ");
      const dWords = fullName.split(" ");
      const matched = qWords.filter(word => dWords.includes(word)).length;
      const score = matched / Math.max(qWords.length, dWords.length);
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        best = { code, brand, name: marketingName || code };
      }
    }
  }
  return best;
}

// Balanced starting preset. These are NOT experimentally verified per-device values.
function makePreset() {
  return {
    general: 190,
    redDot: 185,
    scope2x: 180,
    scope4x: 170,
    sniper: 90,
    freeLook: 140,
    fireButton: 48
  };
}

module.exports = {
  name: "sensi",
  alias: ["ffsensi", "freefiresensi"],
  desc: "Get a Free Fire sensitivity starting preset for a phone model",
  category: "gaming",
  use: ".sensi <phone model>",

  async execute(sock, msg, args, from, { reply }) {
    const query = (args || []).join(" ").replace(/\bsensi\b/i, "").trim();

    if (!query) {
      return reply(
        "📱 භාවිතය: .sensi <Phone Model>\n\nඋදාහරණ:\n" +
        ".sensi Samsung Galaxy S24 Ultra\n" +
        ".sensi Redmi Note 13 Pro\n" +
        ".sensi Google Pixel 6a\n" +
        ".sensi Infinix Hot 40"
      );
    }

    const db = await getDeviceDatabase();
    const total = Object.keys(db).length;

    if (!total) {
      return reply(
        "❌ Device database එක ලබාගන්න බැරි වුණා.\n" +
        "Internet connection එක පරීක්ෂා කරලා නැවත උත්සාහ කරන්න."
      );
    }

    const device = findDevice(db, query);
    if (!device) {
      return reply(
        `❌ "${query}" Database එකෙන් හමු වුණේ නැහැ.\n\n` +
        `Database එකේ device entries ${total.toLocaleString()}ක් තියෙනවා.\n` +
        "Phone එකේ marketing name එක හෝ model code එක භාවිත කරන්න."
      );
    }

    const s = makePreset();
    const text =
      "╭━━〔 🔥 ZANTA-XMD SENSI 〕━━╮\n" +
      `┃ 📱 Device: ${device.brand} ${device.name}\n` +
      `┃ 🆔 Model: ${device.code}\n` +
      "┃ 🎮 Game: Free Fire Normal\n" +
      "┃\n" +
      `┃ 🎯 General: ${s.general}\n` +
      `┃ 🔴 Red Dot: ${s.redDot}\n` +
      `┃ 🔭 2X Scope: ${s.scope2x}\n` +
      `┃ 🔭 4X Scope: ${s.scope4x}\n` +
      `┃ 🎯 Sniper: ${s.sniper}\n` +
      `┃ 👁 Free Look: ${s.freeLook}\n` +
      "┃\n" +
      `┃ 🔘 Fire Button: ${s.fireButton}%\n` +
      "╰━━━━━━━━━━━━━━━━━━━━╯\n\n" +
      "ℹ️ මේවා ආරම්භක preset අගයන් පමණයි. සියලුම phone වලට පරීක්ෂා කළ නිශ්චිත අගයන් නොවේ. " +
      "ඔබගේ game sensitivity slider සීමාව අනුව අගයන් සකස් කරන්න.";

    return reply(text);
  }
};
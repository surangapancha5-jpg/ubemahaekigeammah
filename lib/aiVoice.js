const axios = require("axios");
const AI = require("./aiConfig");

// ════════════════ TEXT TO SPEECH AUDIO EXTRACTOR ════════════════════════
function extractAudioPayload(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [data.audio, data.audioBuffer, data.audio_base64, data.base64,
    data.data?.audio, data.data?.audio_base64, data.data?.base64,
    data.result?.audio, data.result?.audio_base64];
  for (const item of candidates) {
    if (typeof item !== "string" || !item.trim()) continue;
    const value = item.trim();
    if (/^https?:\/\//i.test(value)) return { url: value };
    const cleaned = value.replace(/^data:audio\/[^;]+;base64,/i, "");
    const buffer = Buffer.from(cleaned, "base64");
    if (buffer.length) return { buffer };
  }
  const urls = [data.url, data.audioUrl, data.audio_url, data.downloadUrl,
    data.data?.url, data.data?.audioUrl, data.data?.audio_url,
    data.result?.url, data.result?.audioUrl];
  const url = urls.find(value => typeof value === "string" && /^https?:\/\//i.test(value));
  return url ? { url } : null;
}

// ════════════════ SUPUN TEXT TO SPEECH GENERATOR ════════════════════════
async function generateVoice(text, options = {}) {
  const input = String(text || "").trim();
  if (!input) throw new Error("TTS සඳහා text එකක් නැහැ.");
  const apiKey = AI.SUPUN_AI_API_KEY;
  if (!apiKey || apiKey === "YOUR_SUPUN_KEY") {
    throw new Error("lib/aiConfig.js තුළ YOUR_SUPUN_KEY වෙනුවට Supun API key එක දාන්න.");
  }

  const response = await axios.get(AI.AI_VOICE_API_URL, {
    params: { text: input.slice(0, 3500), lang: options.lang || AI.AI_VOICE_LANG,
      voiceId: options.voiceId || AI.AI_VOICE_ID, apikey: apiKey },
    responseType: "arraybuffer",
    timeout: 90000,
    maxContentLength: 25 * 1024 * 1024,
    maxBodyLength: 25 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "audio/*,application/json,*/*" }
  });

  const raw = Buffer.from(response.data || []);
  if (!raw.length) throw new Error("TTS API එකෙන් හිස් audio එකක් ලැබුණා.");
  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("json") || contentType.includes("text/")) {
    let json;
    try { json = JSON.parse(raw.toString("utf8")); }
    catch (_) { throw new Error("TTS API එකෙන් audio වෙනුවට text response එකක් ලැබුණා."); }
    if (json.success === false || json.error) throw new Error(json.message || json.error || "TTS API error");
    const payload = extractAudioPayload(json);
    if (!payload) throw new Error("TTS response එකේ audio URL/base64 එකක් හමු වුණේ නැහැ.");
    if (payload.buffer) return payload.buffer;
    const audioResponse = await axios.get(payload.url, { responseType: "arraybuffer", timeout: 90000, maxContentLength: 25 * 1024 * 1024 });
    const audio = Buffer.from(audioResponse.data || []);
    if (!audio.length) throw new Error("TTS audio URL එකෙන් හිස් file එකක් ලැබුණා.");
    return audio;
  }
  return raw;
}

module.exports = { generateVoice };

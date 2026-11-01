const axios = require("axios");
const FormData = require("form-data");
const AI = require("./aiConfig");

// ════════════════ VOICE TO TEXT (OPENAI WHISPER) ════════════════════════
// WhatsApp OGG/Opus voice is converted to MP3 by index.js before reaching here.
async function transcribeVoice(audioBuffer, filename = "zanta-voice.mp3") {
  const apiKey = AI.OPENAI_API_KEY;
  if (!apiKey || apiKey === "YOUR_OPENAI_KEY") {
    throw new Error("lib/aiConfig.js තුළ YOUR_OPENAI_KEY වෙනුවට OpenAI API key එක දාන්න.");
  }
  if (!Buffer.isBuffer(audioBuffer) || !audioBuffer.length) {
    throw new Error("Voice audio buffer එක හිස්.");
  }

  const form = new FormData();
  form.append("file", audioBuffer, { filename, contentType: "audio/mpeg" });
  form.append("model", AI.OPENAI_TRANSCRIBE_MODEL);
  form.append("response_format", "json");

  const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
    timeout: 120000,
    maxBodyLength: 30 * 1024 * 1024,
    maxContentLength: 2 * 1024 * 1024
  });
  const transcript = String(response.data?.text || "").trim();
  if (!transcript) throw new Error("Voice එකේ කතාව හඳුනාගන්න බැරි වුණා.");
  return transcript;
}

// ════════════════ SUPUN AI CHAT RESPONSE ════════════════════════
async function generateAIReply(userText, pushName = "User") {
  const apiKey = AI.SUPUN_AI_API_KEY;
  if (!apiKey || apiKey === "YOUR_SUPUN_KEY") {
    throw new Error("lib/aiConfig.js තුළ YOUR_SUPUN_KEY වෙනුවට Supun API key එක දාන්න.");
  }
  const prompt = [
    "You are ZANTA-XMD, a friendly WhatsApp assistant.",
    "Reply naturally and briefly in the same language as the user.",
    "Understand Sinhala, Singlish and English. Use natural Sinhala for Sinhala/Singlish.",
    `User name: ${String(pushName || "User").slice(0, 60)}`,
    `User message: ${String(userText || "").slice(0, 4000)}`
  ].join("\n");

  const response = await axios.get(AI.AI_CHAT_API_URL, {
    params: { q: prompt, apikey: apiKey },
    timeout: 90000,
    maxContentLength: 2 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json,text/plain,*/*" }
  });

  const data = response.data;
  const candidates = [
    data, data?.result, data?.response, data?.answer, data?.message, data?.reply, data?.text,
    data?.data, data?.data?.result, data?.data?.response, data?.data?.answer,
    data?.data?.message, data?.data?.reply, data?.data?.text
  ];
  const answer = candidates.find(value => typeof value === "string" && value.trim());
  if (!answer) {
    console.error("[SUPUN AI RESPONSE]", JSON.stringify(data).slice(0, 1500));
    throw new Error("Supun AI API එකෙන් හඳුනාගත හැකි text reply එකක් ලැබුණේ නැහැ.");
  }
  return String(answer).trim().slice(0, 3500);
}

module.exports = { transcribeVoice, generateAIReply };

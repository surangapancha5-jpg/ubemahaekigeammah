const axios = require("axios");
const FormData = require("form-data");

// ════════════════ SUPUN AI VOICE TO TEXT ════════════════
// Supun STT endpoint is configurable because the supplied Chat/TTS URLs
// do not define a Speech-to-Text route or its exact response schema.

function findTranscript(data) {
  if (typeof data === "string") return data.trim();
  const candidates = [
    data?.text,
    data?.transcript,
    data?.transcription,
    data?.result,
    data?.message,
    data?.data?.text,
    data?.data?.transcript,
    data?.data?.transcription,
    data?.data?.result,
    data?.output?.text
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function transcribeWithSupun(audioBuffer, mimetype = "audio/ogg") {
  const endpoint = String(process.env.SUPUN_STT_API_URL || "").trim();
  const apiKey = String(process.env.SUPUN_AI_API_KEY || "").trim();
  if (!endpoint) {
    const error = new Error("SUPUN_STT_API_URL is not configured. Supun Chat/TTS URLs are not Voice-to-Text endpoints.");
    error.code = "SUPUN_STT_NOT_CONFIGURED";
    throw error;
  }
  if (!apiKey) throw new Error("SUPUN_AI_API_KEY is not configured.");
  if (!Buffer.isBuffer(audioBuffer) || !audioBuffer.length) throw new Error("Voice message audio is empty.");

  const form = new FormData();
  const field = process.env.SUPUN_STT_FILE_FIELD || "file";
  const ext = /mpeg|mp3/i.test(mimetype) ? "mp3" : /wav/i.test(mimetype) ? "wav" : "ogg";
  form.append(field, audioBuffer, {
    filename: `zanta-voice.${ext}`,
    contentType: mimetype || "audio/ogg"
  });
  form.append("lang", process.env.SUPUN_STT_LANG || "si");

  const keyParam = process.env.SUPUN_STT_KEY_PARAM || "apikey";
  const response = await axios.post(endpoint, form, {
    params: { [keyParam]: apiKey },
    headers: form.getHeaders(),
    timeout: Number(process.env.SUPUN_STT_TIMEOUT || 90000),
    maxBodyLength: 25 * 1024 * 1024,
    maxContentLength: 25 * 1024 * 1024,
    validateStatus: status => status >= 200 && status < 300
  });

  const transcript = findTranscript(response.data);
  if (!transcript) {
    const error = new Error("Supun STT returned no transcript. Check its response format and file field name.");
    error.responseData = response.data;
    throw error;
  }
  return transcript;
}

module.exports = { transcribeWithSupun };

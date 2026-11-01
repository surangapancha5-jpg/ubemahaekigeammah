// ════════════════ ZANTA-XMD AI API CONFIGURATION ════════════════════════
// Replace the placeholder values below with your own API keys.
// Environment variables (Heroku Config Vars) override these values.

module.exports = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "supun_f3be1dda5f1fbd062eacdeca72c0a9c1",
  SUPUN_AI_API_KEY: process.env.SUPUN_AI_API_KEY || "supun_f3be1dda5f1fbd062eacdeca72c0a9c1",
  AI_VOICE_API_URL: process.env.AI_VOICE_API_URL || "https://supunofc.site/api/ai/ai-voice",
  AI_CHAT_API_URL: process.env.AI_CHAT_API_URL || "https://supunofc.site/api/ai/ai/openai",
  AI_VOICE_LANG: process.env.AI_VOICE_LANG || "si",
  AI_VOICE_ID: process.env.AI_VOICE_ID || "F1",
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1"
};

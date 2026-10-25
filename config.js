require("dotenv").config();

const BOT_LOGO = "https://files.catbox.moe/lmir51.jpg";

module.exports = {
  // 🤖 Bot identity
  BOT_NAME: "ZANTA-XMD",

  // 👑 Owner / Developer
  OWNER_NAME: "ZANTA",
  OWNER_NUMBER: "94778630850",
  OWNER_LID: process.env.OWNER_LID || "90865200582869@lid",

  // 🗄️ MongoDB (set in .env)
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI || "",

  // 🔑 API keys (set in .env)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  CHAMA_API_KEY: process.env.CHAMA_API_KEY || "",
  AI_MODEL: process.env.AI_MODEL || "deepseek/deepseek-chat:free",

  // 🎨 Logo
  BOT_LOGO,
  BOT_LOGOS: [BOT_LOGO],
  getRandomLogo() {
    return BOT_LOGO;
  }
};

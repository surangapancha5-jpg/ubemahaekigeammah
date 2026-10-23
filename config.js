require("dotenv").config();

module.exports = {
  MONGODB_URI:
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    "",

  OPENROUTER_API_KEY:
    process.env.OPENROUTER_API_KEY || "",

  AI_MODEL:
    process.env.AI_MODEL || "deepseek/deepseek-chat:free",

  BOT_NAME: "ZANTA-XMD",

  BOT_LOGOS: [
    "https://files.catbox.moe/3fxa4u.jpeg",
    "https://files.catbox.moe/koh9j8.jpeg",
    "https://files.catbox.moe/jz25of.jpeg"
  ],

  _currentIndex: 0,

  getRandomLogo() {
    if (!this.BOT_LOGOS?.length) return null;
    const logo = this.BOT_LOGOS[this._currentIndex];
    this._currentIndex =
      (this._currentIndex + 1) % this.BOT_LOGOS.length;
    return logo;
  }
};

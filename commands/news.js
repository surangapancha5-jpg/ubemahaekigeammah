const axios = require("axios");

const API_URL =
    "https://api.chamindu.site/api/v1/media/hirunews?limit=48&api_key=chama_api_7b9669a740e0cde09142ee6169e8b575";

const INTERVAL = 5 * 60 * 1000;

// Store enabled chats and already sent news
if (!global.autoNewsChats) {
    global.autoNewsChats = new Map();
}

if (!global.autoNewsTimers) {
    global.autoNewsTimers = new Map();
}

module.exports = {
    name: "autonews",
    alias: ["newsauto"],
    desc: "Automatically send latest Hiru News",
    category: "news",
    use: ".autonews",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // Toggle OFF if already enabled
            if (global.autoNewsChats.has(from)) {
                global.autoNewsChats.delete(from);

                const timer = global.autoNewsTimers.get(from);

                if (timer) clearInterval(timer);

                global.autoNewsTimers.delete(from);

                return await reply(
                    "╭━━〔 📰 AUTO NEWS 〕━━╮\n\n" +
                    "🔴 Status: OFF\n" +
                    "📡 Automatic news stopped.\n\n" +
                    "Use .autonews to enable again.\n" +
                    "╰━━━━━━━━━━━━━━━━╯"
                );
            }

            await reply("⏳ Connecting to Hiru News API...");

            // Verify API response before enabling
            const news = await fetchNews();

            if (!news.length) {
                return await reply(
                    "❌ API එකෙන් News ලබාගන්න බැහැ.\n" +
                    "API response එක පරීක්ෂා කරන්න."
                );
            }

            global.autoNewsChats.set(from, {
                lastIds: new Set(),
                startedAt: Date.now()
            });

            // Send latest news immediately
            await sendNews(sock, from, news);

            // Automatically check for new articles
            const timer = setInterval(async () => {
                try {
                    if (!global.autoNewsChats.has(from)) {
                        clearInterval(timer);
                        return;
                    }

                    const latestNews = await fetchNews();

                    if (latestNews.length) {
                        await sendNews(sock, from, latestNews);
                    }
                } catch (error) {
                    console.error(
                        "[AUTO NEWS POLL ERROR]",
                        error.message
                    );
                }
            }, INTERVAL);

            global.autoNewsTimers.set(from, timer);

        } catch (error) {
            console.error("[AUTO NEWS ERROR]", error.message);

            await reply(
                "❌ Auto News ආරම්භ කරන්න බැහැ.\n\n" +
                "Error: " + error.message
            );
        }
    }
};

async function fetchNews() {
    const response = await axios.get(API_URL, {
        timeout: 20000,
        headers: {
            Accept: "application/json",
            "User-Agent": "ZANTA-XMD-MINI"
        }
    });

    const data = response.data;

    // Support common API response structures
    let articles = [];

    if (Array.isArray(data)) {
        articles = data;
    } else if (data && Array.isArray(data.data)) {
        articles = data.data;
    } else if (data && Array.isArray(data.result)) {
        articles = data.result;
    } else if (data && Array.isArray(data.results)) {
        articles = data.results;
    } else if (data && Array.isArray(data.news)) {
        articles = data.news;
    }

    return articles;
}

async function sendNews(sock, from, articles) {
    const session = global.autoNewsChats.get(from);

    if (!session) return;

    // API is expected to return newest articles first
    for (const article of articles) {
        const title =
            article.title ||
            article.headline ||
            article.name ||
            article.news_title ||
            "";

        const url =
            article.url ||
            article.link ||
            article.news_url ||
            article.source_url ||
            "";

        const description =
            article.description ||
            article.summary ||
            article.content ||
            "";

        const image =
            article.image ||
            article.thumbnail ||
            article.image_url ||
            article.img ||
            "";

        if (!title) continue;

        const id = String(
            article.id ||
            article.news_id ||
            article.guid ||
            url ||
            title
        );

        // Skip previously sent articles
        if (session.lastIds.has(id)) continue;

        const message =
            "╭━━〔 📰 HIRU NEWS 〕━━╮\n\n" +
            "🔥 *" + title + "*\n\n" +
            (description
                ? description.substring(0, 700) + "\n\n"
                : "") +
            (url ? "🔗 Read more:\n" + url + "\n\n" : "") +
            "╰━━━━━━━━━━━━━━━━╯\n" +
            "_ZANTA-XMD MINI • Auto News_";

        try {
            if (image && /^https?:\/\//i.test(image)) {
                await sock.sendMessage(from, {
                    image: { url: image },
                    caption: message
                });
            } else {
                await sock.sendMessage(from, {
                    text: message
                });
            }

            session.lastIds.add(id);

            // Keep memory usage limited
            if (session.lastIds.size > 500) {
                const oldest = session.lastIds.values().next().value;
                session.lastIds.delete(oldest);
            }

            // Small delay between news messages
            await new Promise(resolve => setTimeout(resolve, 1200));

        } catch (error) {
            console.error(
                "[NEWS SEND ERROR]",
                title,
                error.message
            );
        }
    }
}
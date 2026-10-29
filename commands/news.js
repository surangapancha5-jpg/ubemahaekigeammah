const axios = require("axios");

const API_URL =
    "https://api.chamindu.site/api/v1/media/hirunews?limit=48&api_key=chama_api_7b9669a740e0cde09142ee6169e8b575";

// Check every 25 minutes
const INTERVAL = 25 * 60 * 1000;

if (!global.autoNewsChats) {
    global.autoNewsChats = new Map();
}

if (!global.autoNewsTimers) {
    global.autoNewsTimers = new Map();
}

module.exports = {
    name: "autonews",
    alias: ["newsauto"],
    desc: "Automatically send only new Hiru News",
    category: "news",
    use: ".autonews",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // Stop auto news
            if (global.autoNewsChats.has(from)) {
                global.autoNewsChats.delete(from);

                const timer = global.autoNewsTimers.get(from);

                if (timer) {
                    clearInterval(timer);
                }

                global.autoNewsTimers.delete(from);

                return await reply(
                    "╭━━〔 📰 AUTO NEWS 〕━━╮\n\n" +
                    "🔴 Status: OFF\n" +
                    "📡 Auto News නවතා ඇත.\n\n" +
                    "නැවත ආරම්භ කිරීමට .autonews භාවිතා කරන්න.\n" +
                    "╰━━━━━━━━━━━━━━━━╯"
                );
            }

            await reply(
                "⏳ Hiru News API පරීක්ෂා කරමින් පවතී..."
            );

            // Fetch current news
            const articles = await fetchNews();

            if (!articles.length) {
                return await reply(
                    "❌ News ලබාගැනීමට නොහැකි වුණා.\n" +
                    "API response එක පරීක්ෂා කරන්න."
                );
            }

            /*
             * IMPORTANT:
             * Mark all existing articles as already seen.
             * This prevents old news from being sent when enabled.
             */
            const seenIds = new Set();

            for (const article of articles) {
                const id = getArticleId(article);

                if (id) {
                    seenIds.add(id);
                }
            }

            global.autoNewsChats.set(from, {
                seenIds,
                startedAt: Date.now(),
                checking: false
            });

            // Start polling without sending old articles
            const timer = setInterval(async () => {
                const session = global.autoNewsChats.get(from);

                if (!session || session.checking) {
                    return;
                }

                session.checking = true;

                try {
                    const latestArticles = await fetchNews();

                    // Find articles not seen before
                    const newArticles = [];

                    for (const article of latestArticles) {
                        const id = getArticleId(article);

                        if (!id || session.seenIds.has(id)) {
                            continue;
                        }

                        // Mark as seen before sending to avoid duplicates
                        session.seenIds.add(id);
                        newArticles.push(article);
                    }

                    // Keep only recent IDs in memory
                    if (session.seenIds.size > 1000) {
                        const recentIds = Array.from(
                            session.seenIds
                        ).slice(-500);

                        session.seenIds = new Set(recentIds);
                    }

                    if (!newArticles.length) {
                        console.log(
                            "[AUTO NEWS] No new articles:",
                            from
                        );

                        return;
                    }

                    /*
                     * If API returns newest first, reverse the list
                     * so older new articles are sent before newer ones.
                     */
                    for (const article of newArticles.reverse()) {
                        // Check if user has stopped auto news
                        if (!global.autoNewsChats.has(from)) {
                            break;
                        }

                        await sendArticle(sock, from, article);

                        // Delay between messages
                        await sleep(1500);
                    }

                } catch (error) {
                    console.error(
                        "[AUTO NEWS CHECK ERROR]",
                        error.message
                    );
                } finally {
                    session.checking = false;
                }
            }, INTERVAL);

            global.autoNewsTimers.set(from, timer);

            await reply(
                "╭━━〔 📰 HIRU AUTO NEWS 〕━━╮\n\n" +
                "🟢 Status: ON\n" +
                "✅ අලුත් News විතරයි එවන්නේ.\n" +
                "⛔ පරණ News එවන්නේ නැහැ.\n" +
                "⏱️ Check Interval: විනාඩි 25යි.\n" +
                "📡 අලුත් News තිබුණොත් පමණක් එවයි.\n\n" +
                "🔴 OFF කිරීමට: .autonews\n\n" +
                "╰━━━━━━━━━━━━━━━━╯"
            );

        } catch (error) {
            console.error(
                "[AUTO NEWS ERROR]",
                error.message
            );

            await reply(
                "❌ Auto News ආරම්භ කරන්න බැහැ.\n" +
                "Error: " + error.message
            );
        }
    }
};


// Fetch news from API
async function fetchNews() {
    const response = await axios.get(API_URL, {
        timeout: 20000,
        headers: {
            Accept: "application/json",
            "User-Agent": "ZANTA-XMD-MINI"
        }
    });

    const data = response.data;

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
    } else if (data && data.data && Array.isArray(data.data.news)) {
        articles = data.data.news;
    }

    return articles;
}


// Get a unique ID for each news article
function getArticleId(article) {
    const id =
        article.id ||
        article.news_id ||
        article.guid ||
        article.url ||
        article.link ||
        article.news_url ||
        article.source_url;

    if (id) {
        return String(id).trim();
    }

    const title =
        article.title ||
        article.headline ||
        article.name ||
        article.news_title;

    return title ? String(title).trim() : null;
}


// Send a single news article
async function sendArticle(sock, from, article) {
    const title =
        article.title ||
        article.headline ||
        article.name ||
        article.news_title ||
        "Hiru News";

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

    const caption =
        "╭━━〔 📰 HIRU NEWS 〕━━╮\n\n" +
        "🔥 *" + title + "*\n\n" +
        (description
            ? String(description).substring(0, 700) + "\n\n"
            : "") +
        (url ? "🔗 Read more:\n" + url + "\n\n" : "") +
        "╰━━━━━━━━━━━━━━━━╯\n" +
        "_ZANTA-XMD MINI • Auto News_";

    try {
        if (image && /^https?:\/\//i.test(image)) {
            await sock.sendMessage(from, {
                image: { url: image },
                caption
            });
        } else {
            await sock.sendMessage(from, {
                text: caption
            });
        }

        console.log("[AUTO NEWS SENT]", title);

    } catch (error) {
        console.error(
            "[NEWS SEND ERROR]",
            title,
            error.message
        );
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
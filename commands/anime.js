const axios = require("axios");

// ════════════════════════════════════════════════════════
//          ANIME API CONFIGURATION
//          GoGoAnime API එක සම්බන්ධ කරයි.
// ════════════════════════════════════════════════════════

const API_URL = "https://api.chamindu.site/api/v1/anime/gogoanime/search";
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575"

// ════════════════════════════════════════════════════════
//          ZANTA-XMD ROYAL LUXURY BOX
//          ඔයාගේ Custom ⛩️ Box Design එක.
// ════════════════════════════════════════════════════════

function zantaBox(title, lines = []) {
    return (
        `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n` +
        `┃◈╭─────────────·๏\n` +
        `┃◈┃⛩️ ${title}\n` +
        `┃◈┃\n` +
        lines.map(line => `┃◈┃⛩️ ${line}\n`).join("") +
        `┃◈└───────────┈⊷\n` +
        `╰──────────────┈⊷\n` +
        `> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
    );
}

// ════════════════════════════════════════════════════════
//          ANIME SEARCH REQUEST
//          Anime නම API එකට යවයි.
// ════════════════════════════════════════════════════════

async function searchAnime(query) {

    if (!API_KEY) {
        throw new Error("CHAMINDU_API_KEY missing");
    }

    const response = await axios.get(API_URL, {
        params: {
            q: query,
            api_key: API_KEY
        },
        timeout: 30000
    });

    return response.data;
}

// ════════════════════════════════════════════════════════
//          RESULT EXTRACTOR
//          API Response එකෙන් Anime Results ලබාගනී.
// ════════════════════════════════════════════════════════

function extractResults(data) {

    const possibleResults = [
        data?.results,
        data?.result,
        data?.data,
        data?.anime,
        data?.data?.results,
        data?.data?.result,
        data?.data?.anime
    ];

    for (const item of possibleResults) {
        if (Array.isArray(item)) return item;
    }

    if (Array.isArray(data)) return data;

    if (
        data?.id ||
        data?.title ||
        data?.name
    ) {
        return [data];
    }

    return [];
}

// ════════════════════════════════════════════════════════
//          SAFE TEXT EXTRACTOR
//          Anime තොරතුරු ලබාගනී.
// ════════════════════════════════════════════════════════

function getText(object, keys) {

    for (const key of keys) {

        const value = key.split(".").reduce(
            (obj, part) => obj?.[part],
            object
        );

        if (
            typeof value === "string" ||
            typeof value === "number"
        ) {
            return String(value);
        }
    }

    return "Not available";
}

// ════════════════════════════════════════════════════════
//          MAIN ANIME COMMAND
//          WhatsApp Anime Search Command.
// ════════════════════════════════════════════════════════

module.exports = {

    name: "anime",
    alias: ["gogoanime", "animsearch"],

    desc: "Search Anime",
    category: "anime",
    use: ".anime <anime name>",

    async execute(sock, msg, args, from, { reply }) {

        try {

            // ════════════════════════════════════════════════
            //          INPUT VALIDATION
            //          Anime නම පරීක්ෂා කරයි.
            // ════════════════════════════════════════════════

            const query = args.join(" ").trim();

            if (!query) {
                return reply(zantaBox("⛩️ ANIME SEARCH", [
                    "◈ Usage: .anime <anime name>",
                    "",
                    "◈ Examples:",
                    "◈ .anime Solo Leveling",
                    "◈ .anime Naruto",
                    "◈ .anime One Piece",
                    "◈ .anime Demon Slayer",
                    "",
                    "◈ Search powered by GoGoAnime API."
                ]));
            }

            if (query.length > 100) {
                return reply(zantaBox("❌ INVALID SEARCH", [
                    "◈ Anime name is too long."
                ]));
            }

            // ════════════════════════════════════════════════
            //          LOADING MESSAGE
            //          Search එක සිදු කරන බව පෙන්වයි.
            // ════════════════════════════════════════════════

            await reply(zantaBox("⛩️ ANIME SEARCHING", [
                `◈ Search: ${query}`,
                "◈ Connecting to GoGoAnime API...",
                "◈ Please wait..."
            ]));

            // ════════════════════════════════════════════════
            //          API REQUEST
            //          Anime API එකෙන් Results ලබාගනී.
            // ════════════════════════════════════════════════

            const apiData = await searchAnime(query);

            console.log(
                "[ZANTA ANIME RESPONSE]",
                JSON.stringify(apiData).slice(0, 2500)
            );

            if (
                apiData?.success === false ||
                apiData?.status === "error"
            ) {
                throw new Error("Anime API request failed");
            }

            const results = extractResults(apiData);

            // ════════════════════════════════════════════════
            //          NO RESULTS HANDLER
            //          Results නැතිනම් පෙන්වයි.
            // ════════════════════════════════════════════════

            if (!results.length) {
                return reply(zantaBox("❌ NO ANIME FOUND", [
                    `◈ Search: ${query}`,
                    "◈ No matching anime found.",
                    "◈ Try another anime name."
                ]));
            }

            // ════════════════════════════════════════════════
            //          RESULT FORMATTING
            //          Anime Results සකස් කරයි.
            // ════════════════════════════════════════════════

            const selected = results.slice(0, 8);

            const lines = [
                `🔎 Search: ${query}`,
                `📊 Results: ${results.length}`,
                ""
            ];

            selected.forEach((anime, index) => {

                const title = getText(anime, [
                    "title",
                    "name",
                    "animeTitle",
                    "englishTitle"
                ]);

                const id = getText(anime, [
                    "id",
                    "animeId",
                    "slug"
                ]);

                const release = getText(anime, [
                    "releaseDate",
                    "release",
                    "year"
                ]);

                const subOrDub = getText(anime, [
                    "subOrDub",
                    "type"
                ]);

                lines.push(
                    `『 ${index + 1} 』 ${title}`,
                    `◈ ID: ${id}`,
                    `◈ Release: ${release}`,
                    `◈ Type: ${subOrDub}`,
                    ""
                );
            });

            lines.push(
                "◈ Search completed successfully.",
                "◈ Results provided by the API."
            );

            // ════════════════════════════════════════════════
            //          SEND RESULTS
            //          Royal Box එකෙන් Results යවයි.
            // ════════════════════════════════════════════════

            return reply(zantaBox("⛩️ ANIME SEARCH RESULTS", lines));

        } catch (error) {

            // ════════════════════════════════════════════════
            //          ERROR HANDLER
            //          API Error එක පෙන්වයි.
            // ════════════════════════════════════════════════

            console.error(
                "[ZANTA ANIME ERROR]",
                error.response?.data || error.message
            );

            let message = "Anime search failed.";

            if (!API_KEY) {
                message = "CHAMINDU_API_KEY is missing.";
            } else if (error.response?.status === 401) {
                message = "Invalid API Key.";
            } else if (error.response?.status === 429) {
                message = "API request limit exceeded.";
            } else if (error.code === "ECONNABORTED") {
                message = "API connection timeout.";
            }

            return reply(zantaBox("❌ ANIME SEARCH ERROR", [
                `◈ ${message}`,
                "◈ Please try again later."
            ]));
        }
    }
};
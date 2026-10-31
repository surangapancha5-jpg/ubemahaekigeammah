const axios = require("axios");

// ════════════════════════════════════════════════════════
//          DEEPSEEK AI CONFIGURATION
//          DeepSeek API සම්බන්ධ කිරීම.
// ════════════════════════════════════════════════════════

const API_URL = "https://api.chamindu.site/api/v1/ai/deepseek";
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575"

// ════════════════════════════════════════════════════════
//          ZANTA-XMD ROYAL LUXURY BOX
//          සියලුම Messages සඳහා Custom Box එක.
// ════════════════════════════════════════════════════════

function zantaBox(title, lines = []) {
    return (
        `╭━━〔 *𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃* 〕━━┈⊷\n` +
        `┃◈╭─────────────·๏\n` +
        `┃◈┃  ${title}\n` +
        `┃◈┃\n` +
        lines.map(line => `┃◈┃  ${line}\n`).join("") +
        `┃◈└───────────┈⊷\n` +
        `╰──────────────┈⊷\n` +
        `> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃 𝐎𝐅𝐂`
    );
}

// ════════════════════════════════════════════════════════
//          DEEPSEEK API REQUEST
//          Userගේ ප්‍රශ්නය API එකට යවයි.
// ════════════════════════════════════════════════════════

async function askDeepSeek(question) {

    if (!API_KEY) {
        throw new Error("CHAMINDU_API_KEY is missing");
    }

    const response = await axios.get(API_URL, {
        params: {
            q: question,
            api_key: API_KEY
        },
        timeout: 120000
    });

    return response.data;
}

// ════════════════════════════════════════════════════════
//          AI RESPONSE EXTRACTOR
//          API Response එකෙන් පිළිතුර ලබාගනී.
// ════════════════════════════════════════════════════════

function extractAnswer(data) {

    if (typeof data === "string") {
        return data;
    }

    const possibleAnswers = [
        data?.answer,
        data?.response,
        data?.result,
        data?.message,
        data?.data?.answer,
        data?.data?.response,
        data?.data?.result,
        data?.data?.message,
        data?.choices?.[0]?.message?.content
    ];

    for (const answer of possibleAnswers) {
        if (typeof answer === "string" && answer.trim()) {
            return answer.trim();
        }
    }

    return null;
}

// ════════════════════════════════════════════════════════
//          TEXT CHUNK FUNCTION
//          දිගු පිළිතුරු කොටස්වලට වෙන් කරයි.
// ════════════════════════════════════════════════════════

function splitText(text, maxLength = 3000) {

    const chunks = [];
    const lines = text.split("\n");

    let current = "";

    for (const line of lines) {

        if ((current + line).length > maxLength && current) {
            chunks.push(current.trim());
            current = "";
        }

        current += line + "\n";
    }

    if (current.trim()) {
        chunks.push(current.trim());
    }

    return chunks;
}

// ════════════════════════════════════════════════════════
//          MAIN AI COMMAND
//          WhatsApp DeepSeek AI Assistant.
// ════════════════════════════════════════════════════════

module.exports = {

    name: "ai",
    alias: ["deepseek", "ask"],

    desc: "ZANTA-XMD DeepSeek AI Assistant",
    category: "ai",
    use: ".ai <question>",

    async execute(sock, msg, args, from, { reply, prefix }) {

        try {

            // ════════════════════════════════════════════════
            //          INPUT VALIDATION
            //          Userගේ ප්‍රශ්නය පරීක්ෂා කරයි.
            // ════════════════════════════════════════════════

            const question = args.join(" ").trim();

            if (!question) {

                return reply(zantaBox("🤖 DEEPSEEK AI ASSISTANT", [
                    "◈ Welcome to ZANTA AI.",
                    "",
                    "◈ Usage: .ai <question>",
                    "",
                    "◈ Examples:",
                    "◈ .ai Hello",
                    "◈ .ai ලංකාවේ ඉතිහාසය කියන්න",
                    "◈ .ai Explain Artificial Intelligence",
                    "◈ .ai Create JavaScript code",
                    "",
                    "◈ Powered by DeepSeek AI"
                ]));
            }

            // ════════════════════════════════════════════════
            //          LOADING MESSAGE
            //          AI Processing Message එක යවයි.
            // ════════════════════════════════════════════════

            await reply(zantaBox("🤖 DEEPSEEK AI PROCESSING", [
                "◈ Your question received.",
                "◈ AI is thinking...",
                "◈ Please wait..."
            ]));

            // ════════════════════════════════════════════════
            //          API CONNECTION
            //          DeepSeek API එකෙන් පිළිතුර ලබාගනී.
            // ════════════════════════════════════════════════

            const apiData = await askDeepSeek(question);

            console.log(
                "[ZANTA AI RESPONSE]",
                JSON.stringify(apiData).slice(0, 2000)
            );

            const answer = extractAnswer(apiData);

            if (!answer) {
                throw new Error("AI answer not found in API response");
            }

            // ════════════════════════════════════════════════
            //          RESPONSE FORMATTING
            //          AI පිළිතුර කොටස්වලට සකස් කරයි.
            // ════════════════════════════════════════════════

            const chunks = splitText(answer);

            // ════════════════════════════════════════════════
            //          SEND AI RESPONSE
            //          Royal Box එකෙන් පිළිතුර යවයි.
            // ════════════════════════════════════════════════

            for (let i = 0; i < chunks.length; i++) {

                const title = chunks.length > 1
                    ? `🤖 DEEPSEEK AI (${i + 1}/${chunks.length})`
                    : "🤖 DEEPSEEK AI RESPONSE";

                const responseLines = [
                    `❓ Question: ${question}`,
                    "",
                    "◈ AI Answer:",
                    ...chunks[i].split("\n")
                ];

                await reply(zantaBox(title, responseLines));
            }

        } catch (error) {

            // ════════════════════════════════════════════════
            //          ERROR HANDLER
            //          API Error එක හඳුනාගෙන පෙන්වයි.
            // ════════════════════════════════════════════════

            console.error(
                "[ZANTA AI ERROR]",
                error.response?.data || error.message
            );

            let errorMessage = "AI එකෙන් පිළිතුර ලබාගැනීමට නොහැකි වුණා.";

            if (!API_KEY) {
                errorMessage = "CHAMINDU_API_KEY Heroku Config Vars වල නැහැ.";
            } else if (error.code === "ECONNABORTED") {
                errorMessage = "API Timeout. නැවත උත්සාහ කරන්න.";
            } else if (error.response?.status === 401) {
                errorMessage = "API Key එක වැරදියි හෝ අවලංගුයි.";
            } else if (error.response?.status === 429) {
                errorMessage = "API Request Limit එක ඉක්මවා ඇත.";
            }

            return reply(zantaBox("❌ DEEPSEEK AI ERROR", [
                `◈ ${errorMessage}`,
                "",
                "◈ Please try again later.",
                "◈ Check API configuration."
            ]));
        }
    }
};
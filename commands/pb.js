const axios = require("axios");

// ════════════════════════════════════════════════════════
//          PHONE LOOKUP API CONFIGURATION
//          Phone Lookup API එක සම්බන්ධ කරයි.
// ════════════════════════════════════════════════════════

const API_URL = "https://api.chamindu.site/api/v1/media/phone/lookup";
const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575"

// ════════════════════════════════════════════════════════
//          ZANTA-XMD ROYAL BOX
//          ඔයාගේ ඉල්ලූ ⛩️ Box Design එක.
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
//          PHONE NUMBER VALIDATION
//          අංකයේ ආකෘතිය පරීක්ෂා කරයි.
// ════════════════════════════════════════════════════════

function validatePhone(number) {
    const cleaned = number.replace(/[\s\-()]/g, "");

    if (!/^\+?\d{7,15}$/.test(cleaned)) {
        return null;
    }

    return cleaned;
}

// ════════════════════════════════════════════════════════
//          PHONE LOOKUP API REQUEST
//          API එකෙන් සාමාන්‍ය අංක තොරතුරු ලබාගනී.
// ════════════════════════════════════════════════════════

async function lookupPhone(number) {
    if (!API_KEY) {
        throw new Error("CHAMINDU_API_KEY missing");
    }

    const response = await axios.get(API_URL, {
        params: {
            q: number,
            api_key: API_KEY
        },
        timeout: 30000
    });

    return response.data;
}

// ════════════════════════════════════════════════════════
//          RESPONSE EXTRACTOR
//          API Response එකෙන් දත්ත ලබාගනී.
// ════════════════════════════════════════════════════════

function extractData(response) {
    if (!response || typeof response !== "object") {
        return {};
    }

    return (
        response.data ||
        response.result ||
        response.phone ||
        response
    );
}

// ════════════════════════════════════════════════════════
//          SAFE FIELD EXTRACTOR
//          අවශ්‍ය තොරතුරු පමණක් ලබාගනී.
// ════════════════════════════════════════════════════════

function getField(data, keys) {
    for (const key of keys) {
        const value = key.split(".").reduce(
            (obj, part) => obj?.[part],
            data
        );

        if (
            value !== undefined &&
            value !== null &&
            typeof value !== "object" &&
            String(value).trim() !== ""
        ) {
            return String(value);
        }
    }

    return "Not available";
}

// ════════════════════════════════════════════════════════
//          MAIN PHONE COMMAND
//          WhatsApp Phone Lookup Command.
// ════════════════════════════════════════════════════════

module.exports = {
    name: "phone",
    alias: ["phonelookup", "numberinfo"],

    desc: "Phone Number Information Lookup",
    category: "tools",
    use: ".phone <number>",

    async execute(sock, msg, args, from, { reply }) {

        try {

            // ════════════════════════════════════════════════
            //          INPUT VALIDATION
            //          User ලබාදුන් අංකය පරීක්ෂා කරයි.
            // ════════════════════════════════════════════════

            const input = args.join(" ").trim();

            if (!input) {
                return reply(zantaBox("📱 PHONE LOOKUP", [
                    "◈ Usage: .phone <number>",
                    "",
                    "◈ Example:",
                    "◈ .phone 947XXXXXXXX",
                    "",
                    "◈ Enter international phone number."
                ]));
            }

            const number = validatePhone(input);

            if (!number) {
                return reply(zantaBox("❌ INVALID NUMBER", [
                    "◈ Phone number format is invalid.",
                    "◈ Use 7-15 digits.",
                    "◈ Include country code."
                ]));
            }

            // ════════════════════════════════════════════════
            //          LOADING MESSAGE
            //          Lookup ක්‍රියාවලිය පෙන්වයි.
            // ════════════════════════════════════════════════

            await reply(zantaBox("📡 PHONE LOOKUP", [
                "◈ Number received successfully.",
                "◈ Connecting to API...",
                "◈ Please wait..."
            ]));

            // ════════════════════════════════════════════════
            //          API REQUEST
            //          Phone API එකෙන් දත්ත ලබාගනී.
            // ════════════════════════════════════════════════

            const response = await lookupPhone(number);

            console.log(
                "[ZANTA PHONE RESPONSE]",
                JSON.stringify(response).slice(0, 2000)
            );

            if (
                response?.success === false ||
                response?.status === "error"
            ) {
                throw new Error("Phone lookup failed");
            }

            const data = extractData(response);

            // ════════════════════════════════════════════════
            //          INFORMATION EXTRACTION
            //          API දත්ත වෙන් කරගනී.
            // ════════════════════════════════════════════════

            const country = getField(data, [
                "country",
                "country_name",
                "countryName",
                "location.country"
            ]);

            const countryCode = getField(data, [
                "country_code",
                "countryCode",
                "dial_code",
                "dialCode"
            ]);

            const international = getField(data, [
                "international_format",
                "internationalFormat",
                "international"
            ]);

            const national = getField(data, [
                "national_format",
                "nationalFormat",
                "national"
            ]);

            const numberType = getField(data, [
                "type",
                "number_type",
                "numberType"
            ]);

            const iso = getField(data, [
                "country_iso",
                "countryISO",
                "country_iso_code",
                "iso"
            ]);

            const valid = getField(data, [
                "valid",
                "is_valid",
                "isValid"
            ]);

            // ════════════════════════════════════════════════
            //          SUCCESS RESULT
            //          සියලු තොරතුරු Box එකෙන් පෙන්වයි.
            // ════════════════════════════════════════════════

            return reply(zantaBox("📱 PHONE INFORMATION", [
                `Number: ${number}`,
                "",
                "🌍 COUNTRY DETAILS",
                `Country: ${country}`,
                `Country Code: ${countryCode}`,
                `Country ISO: ${iso}`,
                "",
                "📞 NUMBER DETAILS",
                `International: ${international}`,
                `National: ${national}`,
                `Number Type: ${numberType}`,
                `Validity: ${valid}`,
                "",
                "🔎 LOOKUP STATUS",
                "Completed Successfully",
                "",
                "⚠️ Public numbering information only."
            ]));

        } catch (error) {

            // ════════════════════════════════════════════════
            //          ERROR HANDLER
            //          API Error පෙන්වයි.
            // ════════════════════════════════════════════════

            console.error(
                "[ZANTA PHONE ERROR]",
                error.response?.data || error.message
            );

            let errorMessage = "Phone lookup failed.";

            if (!API_KEY) {
                errorMessage = "CHAMINDU_API_KEY is missing.";
            } else if (error.response?.status === 401) {
                errorMessage = "Invalid API Key.";
            } else if (error.response?.status === 429) {
                errorMessage = "API request limit exceeded.";
            } else if (error.code === "ECONNABORTED") {
                errorMessage = "API connection timeout.";
            }

            return reply(zantaBox("❌ PHONE LOOKUP ERROR", [
                errorMessage,
                "",
                "Please try again later."
            ]));
        }
    }
};
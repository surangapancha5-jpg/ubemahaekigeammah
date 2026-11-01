// ════════════════ IMPORTS ═════════════════════════════════

const axios = require("axios");

// ════════════════ HTML COMMAND ════════════════════════════

module.exports = {
    name: "html",
    alias: ["source", "gethtml"],
    desc: "Get Website HTML Source",
    category: "tools",
    use: ".html <link>",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // ════════════════ GET WEBSITE URL ═══════════════

            const url = args.join(" ").trim();

            if (!url) {
                return reply(
`╭━━〔 🌐 HTML SOURCE 〕━━╮
┃
┃ Usage:
┃ .html <link>
┃
┃ Example:
┃ .html https://example.com
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            // ════════════════ URL VALIDATION ════════════════

            let website;

            try {
                website = new URL(url);
            } catch {
                return reply("❌ නිවැරදි Website link එකක් ලබා දෙන්න.");
            }

            if (!["http:", "https:"].includes(website.protocol)) {
                return reply("❌ HTTP හෝ HTTPS link එකක් පමණක් ලබා දෙන්න.");
            }

            // ════════════════ FETCH HTML ════════════════════

            await reply("⏳ Website HTML එක ලබාගනිමින් පවතී...");

            const response = await axios.get(website.href, {
                timeout: 15000,
                maxRedirects: 3,
                maxContentLength: 2 * 1024 * 1024,
                responseType: "text",
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; ZANTA-XMD/1.0)",
                    "Accept": "text/html,application/xhtml+xml"
                },
                validateStatus: status => status >= 200 && status < 400
            });

            const contentType = String(
                response.headers["content-type"] || ""
            ).toLowerCase();

            if (
                !contentType.includes("text/html") &&
                !contentType.includes("application/xhtml+xml")
            ) {
                return reply("❌ මේ link එකෙන් HTML page එකක් ලැබුණේ නැහැ.");
            }

            const html = typeof response.data === "string"
                ? response.data
                : String(response.data);

            if (!html.trim()) {
                return reply("❌ Website එකෙන් හිස් HTML එකක් ලැබුණා.");
            }

            // ════════════════ SEND HTML DOCUMENT ════════════

            const fileName = `ZANTA_HTML_${Date.now()}.html`;

            await sock.sendMessage(from, {
                document: Buffer.from(html, "utf8"),
                mimetype: "text/html",
                fileName,
                caption:
`╭━━〔 🌐 HTML SOURCE 〕━━╮
┃
┃ ✅ HTML ලබාගත්තා!
┃
┃ ◈ Website : ${website.hostname}
┃ ◈ Size : ${(Buffer.byteLength(html, "utf8") / 1024).toFixed(2)} KB
┃ ◈ File : ${fileName}
┃
╰━━━━━━━━━━━━━━━━━━━━╯

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃`
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("[HTML COMMAND ERROR]", error);

            return reply(
`╭━━〔 ❌ HTML ERROR 〕━━╮
┃
┃ Website HTML ලබාගන්න බැරි වුණා.
┃
┃ Error: ${error.message}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
            );
        }
    }
};
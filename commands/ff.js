const axios = require("axios");

const API_KEY = "chama_api_7b9669a740e0cde09142ee6169e8b575";

module.exports = {
    name: "ffstalk",
    alias: ["ff", "freefire", "ffinfo"],
    desc: "Free Fire Player Information",
    category: "games",
    use: ".ffstalk <UID>",

    async execute(sock, msg, args, from, { reply }) {
        let loading;

        try {
            const uid = args[0];

            if (!uid) {
                return reply(
                    "╭━━〔 🔥 FREE FIRE STALK 〕━━╮\n┃\n┃ Please provide Player UID!\n┃\n┃ Example:\n┃ .ffstalk 12345678\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
                );
            }

            if (!/^\d{6,15}$/.test(uid)) {
                return reply("❌ Invalid Free Fire UID!");
            }

            loading = await sock.sendMessage(from, {
                text: "╭━━〔 ⏳ FREE FIRE STALK 〕━━╮\n┃\n┃ 🔍 Searching Player...\n┃ 🌍 Connecting to API...\n┃ Please wait...\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            }, { quoted: msg });

            const apiUrl =
                "https://api.chamindu.site/api/v1/freefire/stalk";

            const response = await axios.get(apiUrl, {
                params: {
                    uid: uid,
                    api_key: API_KEY
                },
                timeout: 60000,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });

            const data = response.data;

            console.log("FREE FIRE API RESPONSE:");
            console.dir(data, { depth: null });

            if (!data || data.success === false || data.status === false) {
                throw new Error(
                    data?.message || "Player information not found"
                );
            }

            // Find player information
            function findValue(obj, keys) {
                if (!obj || typeof obj !== "object") return null;

                for (const key of keys) {
                    if (obj[key] !== undefined && obj[key] !== null) {
                        return obj[key];
                    }
                }

                for (const value of Object.values(obj)) {
                    if (value && typeof value === "object") {
                        const result = findValue(value, keys);
                        if (result !== null) return result;
                    }
                }

                return null;
            }

            const name = findValue(data, [
                "name",
                "nickname",
                "player_name",
                "playerName"
            ]) || "Unknown";

            const level = findValue(data, [
                "level",
                "player_level",
                "playerLevel"
            ]) || "Unknown";

            const likes = findValue(data, [
                "likes",
                "like",
                "liked"
            ]) || "Unknown";

            const region = findValue(data, [
                "region",
                "country",
                "server"
            ]) || "Unknown";

            const exp = findValue(data, [
                "exp",
                "experience"
            ]) || "Unknown";

            const accountId = findValue(data, [
                "uid",
                "user_id",
                "userId",
                "account_id"
            ]) || uid;

            const message = `
╭━━〔 🔥 FREE FIRE STALK 〕━━╮
┃
┃ 👤 PLAYER INFORMATION
┃
┃ 🆔 UID       : ${accountId}
┃ 👑 NAME      : ${name}
┃ ⭐ LEVEL     : ${level}
┃ ❤️ LIKES     : ${likes}
┃ 🌍 REGION    : ${region}
┃ ⚡ EXP       : ${exp}
┃
╰━━━━━━━━━━━━━━━━━━━━

> 🔥 POWERED BY ZANTA-XMD 💫
`;

            await sock.sendMessage(from, {
                text: message
            }, { quoted: msg });

        } catch (error) {
            console.error(
                "FREE FIRE STALK ERROR:",
                error.response?.data || error.message
            );

            await reply(
                "╭━━〔 ❌ FREE FIRE ERROR 〕━━╮\n┃\n┃ Player search failed!\n┃\n┃ Error: " +
                (error.message || "Unknown error") +
                "\n┃\n╰━━━━━━━━━━━━━━━━━━━━"
            );

        } finally {
            if (loading?.key) {
                try {
                    await sock.sendMessage(from, {
                        delete: loading.key
                    });
                } catch (e) {
                    console.log("Loading delete error:", e.message);
                }
            }
        }
    }
};
const { createCanvas } = require("@napi-rs/canvas");

module.exports = {
    name: "ping2",
    alias: ["status2", "p2"],
    desc: "Luxury Image Status Card",

    async execute(sock, msg, args, from, context) {
        try {
            const start = Date.now();

            const {
                sender,
                settings,
                DEVELOPER_NAME
            } = context;

            const botName = "ZANTA-XMD MINI";
            const userName = sender
                ? sender.split("@")[0]
                : "User";

            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            const uptimeText =
                `${days}d ${hours}h ${minutes}m ${seconds}s`;

            const ramUsed = (
                process.memoryUsage().heapUsed /
                1024 /
                1024
            ).toFixed(2);

            const version = "3.2.0";

            // Create status card
            const width = 900;
            const height = 1500;

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext("2d");

            // Background
            const bg = ctx.createLinearGradient(
                0, 0, width, height
            );

            bg.addColorStop(0, "#063f31");
            bg.addColorStop(0.5, "#075744");
            bg.addColorStop(1, "#032c24");

            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);

            // Rounded card
            function roundedRect(x, y, w, h, r, color) {
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, r);
                ctx.fillStyle = color;
                ctx.fill();
            }

            // Outer card
            roundedRect(
                55, 45, 790, 1410, 55,
                "rgba(255,255,255,0.07)"
            );

            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.roundRect(55, 45, 790, 1410, 55);
            ctx.stroke();

            // Header icon
            ctx.textAlign = "center";
            ctx.fillStyle = "#ff493d";
            ctx.font = "bold 115px sans-serif";
            ctx.fillText("🏓", 450, 220);

            // Bot name
            ctx.fillStyle = "#a99bff";
            ctx.font = "bold 53px sans-serif";
            ctx.fillText(botName, 450, 320);

            // Live badge
            roundedRect(
                335, 350, 230, 58, 29,
                "rgba(95,160,255,0.20)"
            );

            ctx.fillStyle = "#8bd7ff";
            ctx.font = "bold 26px sans-serif";
            ctx.fillText("⚡ LIVE SYSTEM", 450, 388);

            // Status boxes
            const boxColor = "rgba(255,255,255,0.065)";

            roundedRect(105, 455, 330, 245, 35, boxColor);
            roundedRect(465, 455, 330, 245, 35, boxColor);

            // Latency
            ctx.fillStyle = "#b9d4cb";
            ctx.font = "26px sans-serif";
            ctx.fillText("📡 LATENCY", 270, 510);

            const latency = Date.now() - start;

            ctx.fillStyle = "#55ff9a";
            ctx.font = "bold 55px sans-serif";
            ctx.fillText(`${latency}ms`, 270, 590);

            ctx.fillStyle = "#a6c8bb";
            ctx.font = "24px sans-serif";
            ctx.fillText("🚀 Response Speed", 270, 645);

            // Uptime
            ctx.fillStyle = "#b9d4cb";
            ctx.font = "26px sans-serif";
            ctx.fillText("⏱️ UPTIME", 630, 510);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 34px sans-serif";
            ctx.fillText(`${days}d ${hours}h`, 630, 575);
            ctx.fillText(`${minutes}m ${seconds}s`, 630, 625);

            ctx.fillStyle = "#a6c8bb";
            ctx.font = "23px sans-serif";
            ctx.fillText("☀️ Running smoothly", 630, 665);

            // RAM box
            roundedRect(
                105, 730, 690, 190, 35, boxColor
            );

            ctx.fillStyle = "#b9d4cb";
            ctx.font = "27px sans-serif";
            ctx.fillText("💾 MEMORY USAGE", 450, 785);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 55px sans-serif";
            ctx.fillText(`${ramUsed} MB`, 450, 855);

            ctx.fillStyle = "#a6c8bb";
            ctx.font = "24px sans-serif";
            ctx.fillText("Heap Memory Used", 450, 895);

            // Performance
            roundedRect(
                105, 950, 690, 175, 35, boxColor
            );

            ctx.fillStyle = "#b9d4cb";
            ctx.font = "27px sans-serif";
            ctx.fillText("📊 PERFORMANCE", 450, 1005);

            // Performance bar
            roundedRect(
                145, 1035, 610, 18, 9,
                "rgba(255,255,255,0.12)"
            );

            const performance = Math.max(
                0.05,
                Math.min(1, 1 - latency / 1000)
            );

            roundedRect(
                145, 1035, 610 * performance, 18, 9,
                "#52ffa0"
            );

            ctx.textAlign = "left";
            ctx.fillStyle = "#a6c8bb";
            ctx.font = "22px sans-serif";
            ctx.fillText("Slow", 145, 1090);

            ctx.textAlign = "right";
            ctx.fillText("Fast", 755, 1090);

            // Connection
            roundedRect(
                105, 1155, 690, 85, 25, boxColor
            );

            ctx.textAlign = "left";
            ctx.fillStyle = "#e1f4eb";
            ctx.font = "27px sans-serif";
            ctx.fillText("🔌 Connection", 140, 1208);

            ctx.textAlign = "right";
            ctx.fillStyle = "#55ff9a";
            ctx.fillText("● Connected", 755, 1208);

            // User
            roundedRect(
                105, 1255, 690, 85, 25, boxColor
            );

            ctx.textAlign = "left";
            ctx.fillStyle = "#e1f4eb";
            ctx.font = "27px sans-serif";
            ctx.fillText("👤 User", 140, 1308);

            ctx.textAlign = "right";
            ctx.fillStyle = "#ffffff";
            ctx.font = "25px sans-serif";
            ctx.fillText(userName, 755, 1308);

            // Footer
            ctx.textAlign = "center";
            ctx.fillStyle = "#a6c8bb";
            ctx.font = "24px sans-serif";
            ctx.fillText(
                "⚡ ZANTA-XMD MINI",
                450, 1380
            );

            ctx.font = "21px sans-serif";
            ctx.fillText(
                `Version ${version} • Powered by ${DEVELOPER_NAME || "ZANTA-XMD"}`,
                450, 1415
            );

            // Export image
            const imageBuffer = await canvas.encode("png");

            // Send image to WhatsApp
            await sock.sendMessage(
                from,
                {
                    image: imageBuffer,
                    caption:
                        `👑 *${botName}*\n\n` +
                        `⚡ *Ping:* ${latency}ms\n` +
                        `⏱️ *Uptime:* ${uptimeText}\n` +
                        `💾 *RAM:* ${ramUsed} MB\n` +
                        `🟢 *Status:* Connected`
                },
                { quoted: msg }
            );

        } catch (error) {
            console.error("PING2 ERROR:", error);

            await sock.sendMessage(
                from,
                {
                    text: "❌ Ping2 card එක හදන්න බැරි වුණා. Console එකේ error එක බලන්න."
                },
                { quoted: msg }
            );
        }
    }
};
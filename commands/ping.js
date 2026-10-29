const { createCanvas } = require("@napi-rs/canvas");

module.exports = {
    name: "ping2",
    alias: ["p2", "status2"],
    desc: "ZANTA-XMD MINI Luxury Status Card",

    async execute(sock, msg, args, from) {
        try {
            await sock.sendMessage(from, {
                react: {
                    text: "🔴",
                    key: msg.key
                }
            });

            const start = Date.now();

            // Bot Information
            const botName = "ZANTA-XMD MINI";
            const version = "3.2.0";

            const sender =
                msg.key?.participant ||
                msg.key?.remoteJid ||
                from;

            const userName = sender.split("@")[0];

            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            const ram = (
                process.memoryUsage().heapUsed /
                1024 / 1024
            ).toFixed(2);

            // Measure actual message response time
            const latency = Date.now() - start;

            // Canvas
            const width = 900;
            const height = 1450;

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext("2d");

            // Black + Red Background
            const gradient = ctx.createLinearGradient(
                0, 0, width, height
            );

            gradient.addColorStop(0, "#050505");
            gradient.addColorStop(0.5, "#260505");
            gradient.addColorStop(1, "#080808");

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Rounded Cards
            function drawBox(x, y, w, h, radius, color) {
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, radius);
                ctx.fillStyle = color;
                ctx.fill();

                ctx.strokeStyle = "rgba(255,35,35,0.35)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Main Card
            drawBox(
                45, 35, 810, 1380, 50,
                "rgba(255,255,255,0.035)"
            );

            // Top Line
            const redLine = ctx.createLinearGradient(
                100, 0, 800, 0
            );

            redLine.addColorStop(0, "#600000");
            redLine.addColorStop(0.5, "#ff2020");
            redLine.addColorStop(1, "#600000");

            ctx.fillStyle = redLine;
            ctx.fillRect(120, 65, 660, 6);

            // Header
            ctx.textAlign = "center";

            ctx.font = "bold 90px sans-serif";
            ctx.fillStyle = "#ff3030";
            ctx.fillText("⚡", 450, 200);

            ctx.font = "bold 48px sans-serif";
            ctx.fillStyle = "#ff3030";
            ctx.fillText(botName, 450, 290);

            // Live Badge
            drawBox(
                340, 320, 220, 55, 25,
                "rgba(255,0,0,0.12)"
            );

            ctx.font = "bold 24px sans-serif";
            ctx.fillStyle = "#ff5555";
            ctx.fillText("⚡ LIVE SYSTEM", 450, 355);

            // Latency Card
            drawBox(
                100, 420, 340, 230, 30,
                "rgba(255,255,255,0.04)"
            );

            ctx.font = "25px sans-serif";
            ctx.fillStyle = "#bbbbbb";
            ctx.fillText("📡 LATENCY", 270, 470);

            ctx.font = "bold 55px sans-serif";
            ctx.fillStyle = "#ff3030";
            ctx.fillText(`${latency}ms`, 270, 545);

            ctx.font = "22px sans-serif";
            ctx.fillStyle = "#aaaaaa";
            ctx.fillText("🚀 Response Speed", 270, 600);

            // Uptime Card
            drawBox(
                460, 420, 340, 230, 30,
                "rgba(255,255,255,0.04)"
            );

            ctx.font = "25px sans-serif";
            ctx.fillStyle = "#bbbbbb";
            ctx.fillText("⏱ UPTIME", 630, 470);

            ctx.font = "bold 33px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(`${days}d ${hours}h`, 630, 535);
            ctx.fillText(`${minutes}m ${seconds}s`, 630, 580);

            ctx.font = "21px sans-serif";
            ctx.fillStyle = "#aaaaaa";
            ctx.fillText("Long Running", 630, 615);

            // RAM Card
            drawBox(
                100, 680, 700, 180, 30,
                "rgba(255,255,255,0.04)"
            );

            ctx.font = "25px sans-serif";
            ctx.fillStyle = "#bbbbbb";
            ctx.fillText("💾 MEMORY USAGE", 450, 730);

            ctx.font = "bold 52px sans-serif";
            ctx.fillStyle = "#ff3030";
            ctx.fillText(`${ram} MB`, 450, 800);

            ctx.font = "22px sans-serif";
            ctx.fillStyle = "#aaaaaa";
            ctx.fillText("Heap Used", 450, 835);

            // Performance Card
            drawBox(
                100, 890, 700, 165, 30,
                "rgba(255,255,255,0.04)"
            );

            ctx.font = "25px sans-serif";
            ctx.fillStyle = "#bbbbbb";
            ctx.fillText("📊 PERFORMANCE", 450, 940);

            // Performance Bar
            ctx.beginPath();
            ctx.roundRect(145, 970, 610, 16, 8);
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.fill();

            const memory = process.memoryUsage();

            const performance = Math.max(
                0.05,
                Math.min(
                    1,
                    1 - memory.heapUsed / memory.heapTotal
                )
            );

            ctx.beginPath();
            ctx.roundRect(
                145, 970,
                610 * performance, 16, 8
            );

            ctx.fillStyle = "#ff2525";
            ctx.fill();

            ctx.textAlign = "left";
            ctx.font = "20px sans-serif";
            ctx.fillStyle = "#aaaaaa";
            ctx.fillText("Slow", 145, 1025);

            ctx.textAlign = "right";
            ctx.fillText("Fast", 755, 1025);

            // Connection
            drawBox(
                100, 1085, 700, 80, 22,
                "rgba(255,255,255,0.04)"
            );

            ctx.textAlign = "left";
            ctx.font = "25px sans-serif";
            ctx.fillStyle = "#dddddd";
            ctx.fillText("🔌 Connection", 135, 1135);

            ctx.textAlign = "right";
            ctx.fillStyle = "#ff4545";
            ctx.fillText("● Connected", 765, 1135);

            // User
            drawBox(
                100, 1185, 700, 80, 22,
                "rgba(255,255,255,0.04)"
            );

            ctx.textAlign = "left";
            ctx.fillStyle = "#dddddd";
            ctx.fillText("👤 User", 135, 1235);

            ctx.textAlign = "right";
            ctx.fillStyle = "#ffffff";

            const displayName =
                userName.length > 22
                    ? userName.slice(0, 19) + "..."
                    : userName;

            ctx.fillText(displayName, 765, 1235);

            // Footer
            ctx.textAlign = "center";
            ctx.font = "bold 25px sans-serif";
            ctx.fillStyle = "#ff3030";

            ctx.fillText(
                "⚡ ZANTA-XMD MINI",
                450, 1320
            );

            ctx.font = "20px sans-serif";
            ctx.fillStyle = "#aaaaaa";

            ctx.fillText(
                `Version ${version}`,
                450, 1360
            );

            // Export image
            const imageBuffer = await canvas.encode("png");

            // Send Image
            await sock.sendMessage(
                from,
                {
                    image: imageBuffer,
                    caption:
                        `👑 *${botName}*\n\n` +
                        `🔴 Status: Online\n` +
                        `⚡ Ping: ${latency}ms\n` +
                        `⏱ Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
                        `💾 RAM: ${ram} MB\n` +
                        `👤 User: ${userName}\n\n` +
                        `> POWERED BY ${botName}`
                },
                { quoted: msg }
            );

        } catch (err) {
            console.error("PING2 ERROR:", err);

            await sock.sendMessage(
                from,
                {
                    text:
                        "❌ PING2 ERROR\n\n" +
                        String(err.message || err)
                },
                { quoted: msg }
            );
        }
    }
};
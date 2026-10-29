const { createCanvas } = require("@napi-rs/canvas");

module.exports = {
name: "ping2",
alias: ["p2", "status2"],
desc: "Black and Red Luxury Status Card",

async execute(sock, msg, args, from, context) {
    try {
        const start = Date.now();

        const {
            sender,
            DEVELOPER_NAME
        } = context;

        const botName = "ZANTA-XMD MINI";
        const version = "3.2.0";

        const userName = sender
            ? sender.split("@")[0]
            : "User";

        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const ram = (
            process.memoryUsage().heapUsed /
            1024 / 1024
        ).toFixed(2);

        const width = 900;
        const height = 1500;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // BLACK + RED BACKGROUND
        const bg = ctx.createLinearGradient(
            0, 0, width, height
        );

        bg.addColorStop(0, "#080808");
        bg.addColorStop(0.5, "#240606");
        bg.addColorStop(1, "#080808");

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Rounded rectangle
        function box(x, y, w, h, radius, color, stroke) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radius);

            ctx.fillStyle = color;
            ctx.fill();

            if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // MAIN CARD
        box(
            45, 35, 810, 1430, 55,
            "rgba(255,255,255,0.035)",
            "rgba(255,35,35,0.55)"
        );

        // TOP RED LINE
        const line = ctx.createLinearGradient(80, 0, 820, 0);
        line.addColorStop(0, "#650000");
        line.addColorStop(0.5, "#ff2020");
        line.addColorStop(1, "#650000");

        box(120, 70, 660, 7, 4, line);

        // HEADER ICON
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff2525";
        ctx.font = "bold 100px sans-serif";
        ctx.fillText("⚡", 450, 220);

        // BOT NAME
        ctx.fillStyle = "#ff3030";
        ctx.font = "bold 49px sans-serif";
        ctx.fillText(botName, 450, 315);

        // LIVE BADGE
        box(
            345, 350, 210, 52, 26,
            "rgba(255,0,0,0.13)",
            "rgba(255,40,40,0.6)"
        );

        ctx.fillStyle = "#ff5555";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("⚡ LIVE SYSTEM", 450, 383);

        // INFO BOXES
        const cardColor = "rgba(255,255,255,0.045)";
        const cardBorder = "rgba(255,45,45,0.25)";

        box(100, 445, 340, 245, 30, cardColor, cardBorder);
        box(460, 445, 340, 245, 30, cardColor, cardBorder);

        // LATENCY
        ctx.fillStyle = "#bbbbbb";
        ctx.font = "26px sans-serif";
        ctx.fillText("📡 LATENCY", 270, 500);

        const latency = Date.now() - start;

        ctx.fillStyle = "#ff3030";
        ctx.font = "bold 56px sans-serif";
        ctx.fillText(`${latency}ms`, 270, 580);

        ctx.fillStyle = "#999999";
        ctx.font = "23px sans-serif";
        ctx.fillText("🚀 Response Speed", 270, 635);

        // UPTIME
        ctx.fillStyle = "#bbbbbb";
        ctx.font = "26px sans-serif";
        ctx.fillText("⏱ UPTIME", 630, 500);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 34px sans-serif";
        ctx.fillText(`${days}d ${hours}h`, 630, 565);
        ctx.fillText(`${minutes}m ${seconds}s`, 630, 610);

        ctx.fillStyle = "#999999";
        ctx.font = "22px sans-serif";
        ctx.fillText("Running smoothly", 630, 655);

        // RAM CARD
        box(100, 720, 700, 185, 30, cardColor, cardBorder);

        ctx.fillStyle = "#bbbbbb";
        ctx.font = "27px sans-serif";
        ctx.fillText("MEMORY USAGE", 450, 775);

        ctx.fillStyle = "#ff3030";
        ctx.font = "bold 54px sans-serif";
        ctx.fillText(`${ram} MB`, 450, 845);

        ctx.fillStyle = "#999999";
        ctx.font = "23px sans-serif";
        ctx.fillText("Heap Memory Used", 450, 885);

        // PERFORMANCE CARD
        box(100, 935, 700, 175, 30, cardColor, cardBorder);

        ctx.fillStyle = "#bbbbbb";
        ctx.font = "27px sans-serif";
        ctx.fillText("📊 PERFORMANCE", 450, 990);

        box(
            145, 1025, 610, 17, 9,
            "rgba(255,255,255,0.12)"
        );

        const usage = process.memoryUsage().heapUsed /
            process.memoryUsage().heapTotal;

        const performance = Math.max(
            0.05,
            Math.min(1, 1 - usage)
        );

        box(
            145, 1025, 610 * performance, 17, 9,
            "#ff2525"
        );

        ctx.textAlign = "left";
        ctx.fillStyle = "#999999";
        ctx.font = "22px sans-serif";
        ctx.fillText("Slow", 145, 1075);

        ctx.textAlign = "right";
        ctx.fillText("Fast", 755, 1075);

        // CONNECTION CARD
        box(100, 1140, 700, 85, 22, cardColor, cardBorder);

        ctx.textAlign = "left";
        ctx.fillStyle = "#dddddd";
        ctx.font = "26px sans-serif";
        ctx.fillText("🔌 Connection", 135, 1193);

        ctx.textAlign = "right";
        ctx.fillStyle = "#ff4545";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("● Connected", 765, 1193);

        // USER CARD
        box(100, 1240, 700, 85, 22, cardColor, cardBorder);

        ctx.textAlign = "left";
        ctx.fillStyle = "#dddddd";
        ctx.font = "26px sans-serif";
        ctx.fillText("👤 User", 135, 1293);

        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "24px sans-serif";

        let displayUser = userName;

        if (displayUser.length > 22) {
            displayUser = displayUser.slice(0, 19) + "...";
        }

        ctx.fillText(displayUser, 765, 1293);

        // FOOTER
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff3030";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText("⚡ ZANTA-XMD MINI", 450, 1380);

        ctx.fillStyle = "#888888";
        ctx.font = "21px sans-serif";
        ctx.fillText(
            `Version ${version} | ${DEVELOPER_NAME || "ZANTA-XMD"}`,
            450, 1420
        );

        // EXPORT IMAGE
        const imageBuffer = await canvas.encode("png");

        // SEND STATUS CARD
        await sock.sendMessage(
            from,
            {
                image: imageBuffer,
                caption:
                    `👑 *${botName}*\n\n` +
                    `🔴 *Status:* Online\n` +
                    `⚡ *Ping:* ${latency}ms\n` +
                    `⏱ *Uptime:* ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
                    `💾 *RAM:* ${ram} MB\n` +
                    `👤 *User:* ${userName}\n\n` +
                    `> ⚡ POWERED BY ${botName}`
            },
            { quoted: msg }
        );

    } catch (error) {
        console.error("PING2 ERROR:", error);

        await sock.sendMessage(
            from,
            {
                text: `❌ PING2 ERROR\n\n${error.message}`
            },
            { quoted: msg }
        );
    }
}

};
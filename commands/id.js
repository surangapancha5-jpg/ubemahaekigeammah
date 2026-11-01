// ════════════════ IMPORTS ═════════════════════════════════

const moment = require("moment-timezone");

// ════════════════ NIC DETAILS EXTRACTOR ═══════════════════

function getNICDetails(nic) {
    nic = String(nic).toUpperCase().trim();

    let year;
    let dayOfYear;

    // ════════════════ OLD NIC FORMAT ═══════════════════════
    // උදා: 991234567V

    if (/^\d{9}[VX]$/.test(nic)) {
        year = 1900 + Number(nic.substring(0, 2));
        dayOfYear = Number(nic.substring(2, 5));
    }

    // ════════════════ NEW NIC FORMAT ═══════════════════════
    // උදා: 199912345678

    else if (/^\d{12}$/.test(nic)) {
        year = Number(nic.substring(0, 4));
        dayOfYear = Number(nic.substring(4, 7));
    }

    else {
        return null;
    }

    // ════════════════ BIRTH DATE VALIDATION ════════════════

    const isFemale = dayOfYear > 500;

    if (isFemale) {
        dayOfYear -= 500;
    }

    const maxDays = moment([year]).isLeapYear() ? 366 : 365;

    if (dayOfYear < 1 || dayOfYear > maxDays) {
        return null;
    }

    const birthDate = moment.utc(`${year}-01-01`).add(dayOfYear - 1, "days");

    if (!birthDate.isValid() || birthDate.isAfter(moment.utc(), "day")) {
        return null;
    }

    return {
        birthDate,
        gender: isFemale ? "Female" : "Male"
    };
}

// ════════════════ ID COMMAND ══════════════════════════════

module.exports = {
    name: "id",
    alias: ["nic", "idcheck"],
    desc: "NIC Date Calculator",
    category: "utility",
    use: ".id <NIC Number>",

    async execute(sock, msg, args, from, { reply }) {
        try {
            const nic = args[0];

            if (!nic) {
                return reply(
`╭━━〔 🪪 NIC DATE CHECKER 〕━━╮
┃
┃ භාවිතය:
┃ .id <NIC Number>
┃
┃ උදාහරණ:
┃ .id 991234567V
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            const details = getNICDetails(nic);

            if (!details) {
                return reply(
`╭━━〔 ❌ INVALID NIC 〕━━╮
┃
┃ ලබාදුන් NIC අංකය වලංගු
┃ ආකෘතියකින් නැහැ.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            // ════════════════ AGE CALCULATION ═══════════════

            const today = moment.tz("Asia/Colombo").startOf("day");
            const birth = details.birthDate.clone().startOf("day");

            const age = today.diff(birth, "years");
            const livedDays = today.diff(birth, "days");

            const nextBirthday = birth.clone().year(today.year());

            if (nextBirthday.isBefore(today, "day")) {
                nextBirthday.add(1, "year");
            }

            const remainingDays = nextBirthday.diff(today, "days");

            // ════════════════ RESULT MESSAGE ════════════════

            return reply(
`╭━━〔 🪪 NIC DATE DETAILS 〕━━╮
┃
┃ ◈ NIC Format : ${nic.toUpperCase()}
┃ ◈ Birth Date : ${birth.format("YYYY-MM-DD")}
┃ ◈ Gender : ${details.gender}
┃
┃ 🎂 Age : ${age} Years
┃ 📅 Lived Days : ${livedDays.toLocaleString("en-US")} Days
┃ ⏳ Next Birthday : ${remainingDays} Days
┃
╰━━━━━━━━━━━━━━━━━━━━╯

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃`
            );

        } catch (error) {
            console.error("[ID COMMAND ERROR]", error);
            return reply("❌ NIC details calculate කරන්න බැරි වුණා.");
        }
    }
};
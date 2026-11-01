// ════════════════ DATE HELPERS ════════════════════════════

function getSriLankaToday() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const values = {};
    for (const part of parts) {
        values[part.type] = part.value;
    }

    return new Date(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day)
    );
}

function formatDate(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function daysBetween(start, end) {
    const a = Date.UTC(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
    );

    const b = Date.UTC(
        end.getFullYear(),
        end.getMonth(),
        end.getDate()
    );

    return Math.floor((b - a) / 86400000);
}

// ════════════════ NIC DETAILS ══════════════════════════════

function getNICDetails(input) {
    const nic = String(input || "")
        .toUpperCase()
        .replace(/[\s-]/g, "");

    let year;
    let dayNumber;

    // Old NIC: 9 digits + V/X
    if (/^\d{9}[VX]$/.test(nic)) {
        const shortYear = Number(nic.slice(0, 2));

        // NIC century convention
        year = shortYear >= 0 && shortYear <= 26
            ? 2000 + shortYear
            : 1900 + shortYear;

        dayNumber = Number(nic.slice(2, 5));
    }

    // New NIC: 12 digits
    else if (/^\d{12}$/.test(nic)) {
        year = Number(nic.slice(0, 4));
        dayNumber = Number(nic.slice(4, 7));
    } else {
        return null;
    }

    const gender = dayNumber > 500 ? "Female" : "Male";

    if (dayNumber > 500) {
        dayNumber -= 500;
    }

    const leapYear =
        year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

    const maxDays = leapYear ? 366 : 365;

    if (dayNumber < 1 || dayNumber > maxDays) {
        return null;
    }

    const birthDate = new Date(year, 0, dayNumber);

    if (
        birthDate.getFullYear() !== year ||
        birthDate.getMonth() < 0 ||
        birthDate.getTime() > getSriLankaToday().getTime()
    ) {
        return null;
    }

    return { birthDate, gender, nic };
}

// ════════════════ ID COMMAND ═══════════════════════════════

module.exports = {
    name: "id",
    alias: ["nic", "idcheck"],
    desc: "NIC Birth Date and Age Calculator",
    category: "utility",
    use: ".id <NIC Number>",

    async execute(sock, msg, args, from, { reply }) {
        try {
            // Read complete argument and remove spaces
            const nic = args.join("").trim();

            if (!nic) {
                return reply(
`╭━━〔 🪪 NIC CHECKER 〕━━╮
┃
┃ Usage:
┃ .id <NIC Number>
┃
┃ Example:
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
┃ NIC අංකය පරීක්ෂා කරන්න.
┃ පැරණි ආකෘතිය: 9 digits + V/X
┃ නව ආකෘතිය: 12 digits
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            const today = getSriLankaToday();
            const birth = details.birthDate;

            let age = today.getFullYear() - birth.getFullYear();

            const birthdayThisYear = new Date(
                today.getFullYear(),
                birth.getMonth(),
                birth.getDate()
            );

            if (today < birthdayThisYear) {
                age--;
            }

            const livedDays = daysBetween(birth, today);

            let nextBirthday = birthdayThisYear;

            if (nextBirthday < today) {
                nextBirthday = new Date(
                    today.getFullYear() + 1,
                    birth.getMonth(),
                    birth.getDate()
                );
            }

            const daysToBirthday = daysBetween(today, nextBirthday);

            return reply(
`╭━━〔 🪪 NIC DATE DETAILS 〕━━╮
┃
┃ ◈ NIC : ${details.nic}
┃ ◈ Birth Date : ${formatDate(birth)}
┃ ◈ Gender Code : ${details.gender}
┃
┃ 🎂 Age : ${age} Years
┃ 📅 Lived Days : ${livedDays.toLocaleString("en-US")}
┃ 🎉 Next Birthday : ${daysToBirthday} Days
┃
╰━━━━━━━━━━━━━━━━━━━━╯

> 𝐙𝐀𝐍𝐓𝐀-𝐗𝐌𝐃`
            );

        } catch (error) {
            console.error("[ID COMMAND ERROR]", error);
            return reply(`❌ ID Error: ${error.message}`);
        }
    }
};
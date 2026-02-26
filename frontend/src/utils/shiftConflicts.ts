/* ------------------------------------------------ */
/* SHIFT CONFLICT INDICATORS                        */
/* ------------------------------------------------ */

import { Schedule } from "../store/shiftStore";
import { shiftTypes } from "../store/shiftStore";

// Thresholds
const MAX_NIGHT_SHIFTS_MONTH = 5;
const MAX_WEEKEND_SHIFTS_MONTH = 4; // e.g. 2 full weekends
const MAX_CONSECUTIVE_DAYS = 7;

export interface Conflict {
    type: "night" | "weekend" | "consecutive";
    message: string;
    severity: "warning" | "error";
}

export function checkEmployeeConflicts(
    employeeName: string,
    year: number,
    plans: Record<string, Schedule> // Map<MonthLabel, Schedule>
): Conflict[] {
    const conflicts: Conflict[] = [];

    // Flatten valid shifts for the whole year
    // We need a continuous timeline.
    const timeline: { date: Date; code: string }[] = [];

    // Iterate months 1..12
    // We assume plans keys are localized formatting, which is hard to sort/parse without specific order.
    // However, the caller usually passes a map.
    // Let's rely on standard month iteration.

    const months = [
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember"
    ];

    let currentConsecutive = 0;

    months.forEach((mName, mIdx) => {
        const monthLabel = `${mName} ${year}`; // approximate
        // Try to find the key in plans that matches this month (ignoring subtle formatting diffs if possible, but exact match preferred)
        // Plans keys are likely "Januar 2027", etc.

        // Find matching key
        const planKey = Object.keys(plans).find(k => k.startsWith(mName) && k.includes(String(year)));
        const schedule = planKey ? plans[planKey] : null;

        let nightCountMonth = 0;
        let weekendCountMonth = 0;

        const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, mIdx, d);
            const dayOfWeek = date.getDay();
            const row = schedule ? schedule[employeeName] : null;
            const code = row ? row[d] : null; // null/undefined treated as free/gap?

            const isWorking = code && code !== "FS" && code !== "ABW";

            if (isWorking) {
                currentConsecutive++;
                if (code === "N") nightCountMonth++;
                if (dayOfWeek === 0 || dayOfWeek === 6) weekendCountMonth++;
            } else {
                // Reset consecutive if OFF (FS, ABW, or empty?)
                // Usually empty means not planned -> effectively off? Or unknown?
                // Step 1: "Default plan ... E1 weekdays, Off weekends".
                // If code is missing, treat as Off for conflict check safety? Or ignore?
                // Let's treat missing as Off for consecutive purposes to avoid false positives.
                currentConsecutive = 0;
            }

            if (currentConsecutive > MAX_CONSECUTIVE_DAYS) {
                // Avoid spamming conflict for every day above threshold. Just once per streak?
                // Or just push if not already pushed for this streak?
                // Simplified: Push unique conflict.
                if (currentConsecutive === MAX_CONSECUTIVE_DAYS + 1) {
                    conflicts.push({
                        type: "consecutive",
                        message: `> ${MAX_CONSECUTIVE_DAYS} Tage am Stück`,
                        severity: "warning"
                    });
                }
            }
        }

        if (nightCountMonth > MAX_NIGHT_SHIFTS_MONTH) {
            conflicts.push({
                type: "night",
                message: `${nightCountMonth} Nachtschichten im ${mName}`,
                severity: "warning"
            });
        }
        if (weekendCountMonth > MAX_WEEKEND_SHIFTS_MONTH) {
            conflicts.push({
                type: "weekend",
                message: `${weekendCountMonth} Wochenendschichten im ${mName}`,
                severity: "warning"
            });
        }
    });

    return conflicts;
}

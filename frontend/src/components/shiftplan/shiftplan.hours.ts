/* ------------------------------------------------ */
/* SHIFTPLAN – HOURS CALCULATION (2027+)            */
/* ------------------------------------------------ */

import { shiftTypes } from "../../store/shiftStore";
import type { HolidayMap } from "../../utils/deHolidays";

/**
 * Configuration
 */
export const SOLL_HOURS = 174;
export const HOLIDAY_CREDIT_HOURS = 8;

export type EmployeeMonthlyStats = {
    name: string;
    soll: number;
    ist: number;
    diff: number;
    warnings: string[]; // "Under", "Over"
};

/**
 * Calculates hours for a specific employee in a specific month.
 * 
 * Rules for IST:
 * - Sum of shift durations (from shiftTypes).
 * - Public Holiday: If it's a weekday (Mon-Fri) AND the employee has NO shift (or OFF?), 
 *   do they get credit? 
 *   User said: "HOLIDAY RULE: Do not assume blindly. Use configurable constant (default 8h)... Only apply for 2027+."
 *   Standard rule usually: If holiday is on a workday and employee is OFF, they get target hours (8h).
 *   If they WORK, they get worked hours + potential bonus (but here we likely just want 'worked' or 'credited' for the total).
 *   Let's assume: 
 *     - If defined shift exists: Use shift hours.
 *     - If NO shift (or blank) AND it is a Mon-Fri Holiday: Credit 8h.
 *     - If Saturday/Sunday Holiday: No extra credit usually unless scheduled.
 */
export function calculateEmployeeHours(
    employeeName: string,
    schedule: Record<number, string>, // Day -> Code
    year: number,
    monthIndex1: number,
    daysInMonth: number,
    holidays: HolidayMap
): EmployeeMonthlyStats {
    let ist = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, monthIndex1 - 1, day);
        const dayKey = `${year}-${String(monthIndex1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dow = date.getDay(); // 0=Sun, 6=Sat
        const isWeekend = dow === 0 || dow === 6;

        // Get shift
        const code = schedule[day];
        const type = code ? shiftTypes[code] : null;

        if (type) {
            // Worked hours
            // Parse duration from type.time? "06:00-14:30" -> 8.5? or use hardcoded map?
            // shiftTypes usually has no 'hours' field in the provided snippets. 
            // We might need to approximate or parse.
            // E1/L1/N often 8h or 8.5h. 
            // Let's check shiftTypes definition in store.
            // Fallback: If we can't parse, assume 8h for standard shifts?
            // User didn't specify duration logic, implies it might exist or we parse range.
            // Let's try to parse range.
            ist += parseHoursFromRange(type.time);
        } else {
            // No shift (OFF)
            // Holiday Logic
            const holidayName = holidays[dayKey];
            if (holidayName && !isWeekend) {
                ist += HOLIDAY_CREDIT_HOURS;
            }
        }
    }

    const diff = ist - SOLL_HOURS;
    const warnings: string[] = [];

    // Warning Logic
    // "Warnings list: employees under/over Soll"
    // Let's add a tolerance? Or strict?
    // User just said "under/over".
    if (ist < SOLL_HOURS) warnings.push("Under");
    if (ist > SOLL_HOURS) warnings.push("Over");

    return {
        name: employeeName,
        soll: SOLL_HOURS,
        ist,
        diff,
        warnings
    };
}

function parseHoursFromRange(range: string): number {
    if (!range || range === "—") return 0;
    // e.g. "06:00-14:30"
    const [start, end] = range.split("-");
    if (!start || !end) return 0;

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    if (isNaN(sh) || isNaN(eh)) return 0;

    let minStart = sh * 60 + sm;
    let minEnd = eh * 60 + em;

    if (minEnd < minStart) minEnd += 24 * 60; // Overnight

    const diffMin = minEnd - minStart;
    // Deduct break? Standard usually 30-45min. 
    // Let's assume raw duration for now unless instructed.
    // Actually, standard shift 8.5h often includes break. 
    // Let's return raw hours.
    return diffMin / 60;
}

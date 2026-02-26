import { useMemo } from "react";
import { Schedule } from "../store/shiftStore";
import { useHiddenEmployees } from "./useHiddenEmployees";
import { checkEmployeeConflicts, Conflict } from "../utils/shiftConflicts";

export interface EmployeeStats {
    name: string;
    nightCount: number;
    weekendCount: number;
    conflicts: Conflict[];
}

// ... useMonthlyStats (unchanged or similar update if needed, but request focused on 2027 Year View) ...

export function useMonthlyStats(
    schedule: Schedule | undefined,
    year: number,
    monthIndex: number // 0-11
) {
    const { isHidden } = useHiddenEmployees();

    return useMemo<EmployeeStats[]>(() => {
        if (!schedule) return [];

        const result: EmployeeStats[] = [];

        Object.entries(schedule).forEach(([name, plan]) => {
            if (isHidden(name)) return;

            let nightCount = 0;
            let weekendCount = 0;

            Object.entries(plan).forEach(([dayStr, code]) => {
                const day = Number(dayStr);
                if (!code) return;

                if (code === "N") nightCount++;

                if (code !== "FS" && code !== "ABW") {
                    const date = new Date(year, monthIndex, day);
                    const d = date.getDay();
                    if (d === 0 || d === 6) {
                        weekendCount++;
                    }
                }
            });

            // Monthly conflicts? we could reuse the utility but it expects a full year map. 
            // For now, leave monthly conflicts empty or minimal.
            result.push({ name, nightCount, weekendCount, conflicts: [] });
        });

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [schedule, year, monthIndex, isHidden]);
}

/**
 * Calculates stats for the entire year based on multiple schedules.
 */
export function useYearlyStats(
    schedulesByMonth: Record<string, Schedule> | undefined,
    monthLabels: string[],
    year: number
) {
    const { isHidden } = useHiddenEmployees();

    return useMemo<EmployeeStats[]>(() => {
        if (!schedulesByMonth) return [];

        // Aggregate by name
        const totals: Record<string, { night: number; weekend: number }> = {};
        const allNames = new Set<string>();

        // Iterate over all 12 months
        monthLabels.forEach((label, monthIndex) => {
            const schedule = schedulesByMonth[label];
            if (!schedule) return;

            Object.entries(schedule).forEach(([name, plan]) => {
                if (isHidden(name)) return;
                allNames.add(name);

                if (!totals[name]) totals[name] = { night: 0, weekend: 0 };

                Object.entries(plan).forEach(([dayStr, code]) => {
                    const day = Number(dayStr);
                    if (!code) return;
                    if (code === "N") totals[name].night++;
                    if (code !== "FS" && code !== "ABW") {
                        const date = new Date(year, monthIndex, day);
                        const d = date.getDay();
                        if (d === 0 || d === 6) {
                            totals[name].weekend++;
                        }
                    }
                });
            });
        });

        // Calculate conflicts per employee
        return Array.from(allNames).map(name => {
            const conflicts = checkEmployeeConflicts(name, year, schedulesByMonth);
            return {
                name,
                nightCount: totals[name]?.night || 0,
                weekendCount: totals[name]?.weekend || 0,
                conflicts
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

    }, [schedulesByMonth, monthLabels, year, isHidden]);
}

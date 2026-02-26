
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { shiftTypes } from "../../store/shiftStore";
import { useEffect, useState } from 'react';
import { fetchSchedule } from "./shiftplan.api";
import { formatMonthLabel } from "../../utils/dateFormat";
import { getGermanFederalHolidays, isGermanFederalHoliday } from "../../utils/deHolidays";

interface StatsProps {
    employeeName: string;
    year: number;
    // Optional: Pre-loaded data (for Year View)
    preloadedPlans?: Record<string, Record<string, Record<number, string>>>;
}

export function EmployeeYearlyStats({ employeeName, year, preloadedPlans }: StatsProps) {
    const [counts, setCounts] = useState<Record<string, number> | null>(null);
    const [holidayCount, setHolidayCount] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            const c: Record<string, number> = {};
            let hCount = 0;
            const holidays = getGermanFederalHolidays(year);

            const add = (code: string, day: number, monthIdx: number) => {
                let s = apiCode(code);
                if (!s) return;

                // GROUPING
                if (s === "E1" || s === "E2") s = "EARLY";
                if (s === "L1" || s === "L2") s = "LATE";
                c[s] = (c[s] || 0) + 1;

                // HOLIDAY CHECK
                // We need date. MonthIdx is 0-11. Day is 1-31.
                if (s !== "FS" && s !== "ABW") {
                    const date = new Date(year, monthIdx, day);
                    if (isGermanFederalHoliday(date, holidays)) {
                        hCount++;
                    }
                }
            };

            if (preloadedPlans) {
                // Preloaded is Record<string (MonthLabel), Record<string (Emp), Record<number, string>>>
                // We need to map MonthLabel back to index... formatMonthLabel is locale dependent.
                // Simplified: iterate months, parse label or rely on order?
                // Actually preloadedPlans keys are month labels.

                Object.entries(preloadedPlans).forEach(([mLabel, monthSchedule]) => {
                    const monthIdx = parseMonthIndex(mLabel); // need helper
                    if (monthIdx === -1) return;

                    const empRow = monthSchedule[employeeName];
                    if (!empRow) return;
                    Object.entries(empRow).forEach(([d, code]) => add(code, Number(d), monthIdx));
                });
                setCounts(c);
                setHolidayCount(hCount);
                return;
            }

            // Fetch from backend
            setLoading(true);
            try {
                // We have to fetch 12 months
                const requests = Array.from({ length: 12 }).map((_, i) =>
                    fetchSchedule(formatMonthLabel(year, i + 1, "de-DE"))
                );
                const results = await Promise.all(requests);

                results.forEach((res, i) => {
                    const sched = res?.schedule;
                    if (!sched) return;
                    const empRow = sched[employeeName];
                    if (!empRow) return;
                    Object.entries(empRow).forEach(([d, code]) => add(code as string, Number(d), i));
                });
                setCounts(c);
                setHolidayCount(hCount);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [employeeName, year, preloadedPlans]);

    if (loading) return <div className="p-4 text-xs text-muted-foreground">Lade Diagramm...</div>;
    if (!counts) return null;

    // Prepare for Recharts
    const data = Object.entries(counts).map(([code, value]) => {
        let name = code;
        // let colorCode = code; // colorCode is not needed as matchColor handles grouped codes directly

        // Manual overrides for groups
        if (code === "EARLY") {
            name = "Frühschicht";
            // colorCode = "E1"; // borrow color
        } else if (code === "LATE") {
            name = "Spätschicht";
            // colorCode = "L1"; // borrow color
        } else {
            const meta = shiftTypes[code];
            if (meta) name = meta.name;
        }

        return {
            name,
            code,
            value,
            color: getTwColorHex(matchColor(code))
        };
    }).filter(x => x.value > 0);

    return (
        <div className="h-64 w-full flex items-center justify-center p-4 bg-muted/20 rounded-lg">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ backgroundColor: "#1e1e1e", border: "none", borderRadius: "8px" }}
                        itemStyle={{ color: "#fff" }}
                    />
                    <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
            </ResponsiveContainer>
            <div className="ml-8 text-sm">
                <div className="font-bold mb-2">Gesamt: {data.reduce((a, b) => a + b.value, 0)}</div>
                {holidayCount > 0 && (
                    <div className="mt-2 text-xs flex items-center gap-2 text-red-400">
                        <span>Feiertagsarbeit (Bundesweit):</span>
                        <span className="font-bold">{holidayCount}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function apiCode(c: string) {
    return String(c).trim();
}

function matchColor(code: string) {
    if (code === "EARLY") return "#f97316"; // orange-500
    if (code === "LATE") return "#eab308"; // yellow-500

    // Map shift code to tailwind class, then we need HEX for Recharts :/
    const map: Record<string, string> = {
        E1: "#f97316", // orange-500
        E2: "#ea580c", // orange-600
        L1: "#eab308", // yellow-500
        L2: "#ca8a04", // yellow-600
        N: "#2563eb",  // blue-600
        SEMINAR: "#9333ea", // purple-600
        FS: "#06b6d4", // cyan-500
        ABW: "#6b7280", // gray-500
        DBS: "#c026d3" // fuchsia-600
    };
    return map[code] || "#888888";
}

function getTwColorHex(c: string) {
    return c;
}

function parseMonthIndex(label: string) {
    const parts = label.trim().split(" ");
    const map: any = {
        Januar: 0, February: 1, März: 2, Mai: 4, Juni: 5, Juli: 6,
        Oktober: 9, Dezember: 11
        // ... simplistic. better:
    };
    // German Locale
    const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    return months.findIndex(m => label.startsWith(m));
}

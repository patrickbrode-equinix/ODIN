import { api, asObject } from "./api";

export interface ShiftplanPreferences {
    searchTerm?: string;
    showNightOnly?: boolean;
    showWeekendOnly?: boolean;
    showWarningsOnly?: boolean;
    showUnderstaffedOnly?: boolean;
    showRamadanOverlay?: boolean;
    showSunTimesHints?: boolean;
}

export interface EligibleColleague {
    name: string;
    hasLoggedIn: boolean;
    lastLogin: string | null;
}

function normalizeEligibleColleagues(value: unknown): EligibleColleague[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((entry) => {
            if (typeof entry === "string") {
                const name = entry.trim();
                return name ? { name, hasLoggedIn: false, lastLogin: null } : null;
            }

            if (!entry || typeof entry !== "object") return null;

            const name = String((entry as { name?: unknown }).name || "").trim();
            if (!name) return null;

            return {
                name,
                hasLoggedIn: (entry as { hasLoggedIn?: unknown }).hasLoggedIn === true,
                lastLogin: typeof (entry as { lastLogin?: unknown }).lastLogin === "string"
                    ? (entry as { lastLogin: string }).lastLogin
                    : null,
            };
        })
        .filter((entry): entry is EligibleColleague => entry !== null);
}

export async function getShiftplanPreferences(): Promise<ShiftplanPreferences> {
    const res = await api.get("/user/preferences/shiftplan");
    return asObject(res.data, "getShiftplanPreferences") as ShiftplanPreferences;
}

export async function updateShiftplanPreferences(prefs: ShiftplanPreferences): Promise<ShiftplanPreferences> {
    const res = await api.put("/user/preferences/shiftplan", prefs);
    return asObject(res.data, "updateShiftplanPreferences") as ShiftplanPreferences;
}

/* ------------------------------------------------ */
/* PREFERRED COLLEAGUES (Wunschkollegen)            */
/* ------------------------------------------------ */

export async function getPreferredColleagues(): Promise<string[]> {
    const res = await api.get("/user/preferred-colleagues");
    return Array.isArray(res.data) ? res.data : [];
}

export async function updatePreferredColleagues(names: string[]): Promise<string[]> {
    const res = await api.put("/user/preferred-colleagues", { names });
    return Array.isArray(res.data) ? res.data : [];
}

export async function getEligibleColleagues(): Promise<EligibleColleague[]> {
    const res = await api.get("/user/eligible-colleagues");
    return normalizeEligibleColleagues(res.data);
}

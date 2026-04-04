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

export async function getEligibleColleagues(): Promise<string[]> {
    const res = await api.get("/user/eligible-colleagues");
    return Array.isArray(res.data) ? res.data : [];
}

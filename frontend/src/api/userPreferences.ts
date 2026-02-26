import { api } from "./api";

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
    return res.data;
}

export async function updateShiftplanPreferences(prefs: ShiftplanPreferences): Promise<ShiftplanPreferences> {
    const res = await api.put("/user/preferences/shiftplan", prefs);
    return res.data;
}

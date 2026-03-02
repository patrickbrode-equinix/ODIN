import { api, asArray, asObject } from "./api";

export interface RamadanMeta {
    year: number;
    site_name: string;
    tz: string;
    ramadan_start: string;
    ramadan_end: string;
    eid_fitr_date?: string;
    eid_adha_date?: string;
}

export interface SunTime {
    date: string;
    sunrise: string;
    sunset: string;
    fajr?: string;
    maghrib?: string;
}

export async function fetchRamadanMeta(year: number): Promise<RamadanMeta | null> {
    try {
        const res = await api.get(`/shiftplan/ramadan/meta?year=${year}`);
        const data = asObject(res.data, "fetchRamadanMeta");
        return Object.keys(data).length > 0 ? (data as RamadanMeta) : null;
    } catch (e) {
        console.error("Fetch Ramadan Meta Failed", e);
        return null;
    }
}

export async function fetchSunTimes(start: string, end: string): Promise<SunTime[]> {
    try {
        const res = await api.get(`/shiftplan/ramadan/suntimes?start=${start}&end=${end}`);
        return asArray(res.data, "fetchSunTimes");
    } catch (e) {
        console.error("Fetch Sun Times Failed", e);
        return [];
    }
}

export async function fetchSiteConfig() {
    try {
        const res = await api.get("/shiftplan/site-config");
        return asObject(res.data, "fetchSiteConfig");
    } catch (e) {
        return null;
    }
}

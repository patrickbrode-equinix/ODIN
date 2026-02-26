import { api } from "./api";

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
        return res.data;
    } catch (e) {
        console.error("Fetch Ramadan Meta Failed", e);
        return null;
    }
}

export async function fetchSunTimes(start: string, end: string): Promise<SunTime[]> {
    try {
        const res = await api.get(`/shiftplan/ramadan/suntimes?start=${start}&end=${end}`);
        return res.data;
    } catch (e) {
        console.error("Fetch Sun Times Failed", e);
        return [];
    }
}

export async function fetchSiteConfig() {
    try {
        const res = await api.get("/shiftplan/site-config");
        return res.data;
    } catch (e) {
        return null;
    }
}

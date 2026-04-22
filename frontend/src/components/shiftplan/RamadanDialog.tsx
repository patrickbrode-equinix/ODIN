import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { RamadanMeta, SunTime } from "../../api/ramadan";
import { getLanguageLocale, useLanguage, type LanguageCode } from "../../context/LanguageContext";
import { MoonStar, Sunrise, Sunset, Loader2 } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
    data: RamadanMeta | null;
    timings: SunTime[];
    loading?: boolean;
}

const RAMADAN_DIALOG_COPY: Record<LanguageCode, {
    dataTitle: string;
    dataUnavailable: string;
    moonHint: string;
    eidFitr: string;
    eidAdha: string;
    prayerTimes: string;
    date: string;
    fajr: string;
    sunrise: string;
    sunset: string;
    maghrib: string;
    loadingData: string;
    noDetails: string;
}> = {
    de: {
        dataTitle: "Ramadan-Daten",
        dataUnavailable: "Keine Ramadan-Daten verfügbar",
        moonHint: "Daten können je nach Mondsichtung variieren.",
        eidFitr: "Eid al-Fitr (Zuckerfest)",
        eidAdha: "Eid al-Adha (Opferfest)",
        prayerTimes: "Gebets- & Fastenzeiten",
        date: "Datum",
        fajr: "Fajr (Beginn)",
        sunrise: "Sonnenaufgang",
        sunset: "Sonnenuntergang",
        maghrib: "Maghrib (Fastenbrechen)",
        loadingData: "Daten werden geladen...",
        noDetails: "Keine Detaildaten verfügbar.",
    },
    en: {
        dataTitle: "Ramadan data",
        dataUnavailable: "Ramadan data unavailable",
        moonHint: "Dates may vary depending on moon sighting.",
        eidFitr: "Eid al-Fitr (Sugar Feast)",
        eidAdha: "Eid al-Adha (Festival of Sacrifice)",
        prayerTimes: "Prayer and fasting times",
        date: "Date",
        fajr: "Fajr (start)",
        sunrise: "Sunrise",
        sunset: "Sunset",
        maghrib: "Maghrib (breaking fast)",
        loadingData: "Loading data...",
        noDetails: "No detailed data available.",
    },
};

export function RamadanDialog({ open, onClose, data, timings, loading }: Props) {
    const { language } = useLanguage();
    const locale = getLanguageLocale(language);
    const copy = RAMADAN_DIALOG_COPY[language] || RAMADAN_DIALOG_COPY.en;
    const formatDate = (dStr: string) => {
        try {
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return dStr;
            return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'long' });
        } catch (e) {
            return dStr;
        }
    };

    const today = new Date().toISOString().split('T')[0];

    if (!data) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{copy.dataTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="p-8 text-center text-muted-foreground">
                        {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : copy.dataUnavailable}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <MoonStar className="w-6 h-6 text-purple-600" />
                        Ramadan {data.year}
                    </DialogTitle>
                    <DialogDescription>
                        {formatDate(data.ramadan_start)} – {formatDate(data.ramadan_end)} <br />
                        <span className="text-xs text-muted-foreground italic">* {copy.moonHint}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto pr-2 space-y-6 min-h-[300px]">

                    {/* EID SECTIONS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                            <h3 className="font-semibold text-purple-900 mb-1">{copy.eidFitr}</h3>
                            <p className="text-sm">{data.eid_fitr_date ? `${formatDate(data.eid_fitr_date)}` : 'TBA'}</p>
                        </div>
                        {data.eid_adha_date && (
                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                                <h3 className="font-semibold text-blue-900 mb-1">{copy.eidAdha}</h3>
                                <p className="text-sm">{formatDate(data.eid_adha_date)}</p>
                            </div>
                        )}
                    </div>

                    {/* TIMINGS TABLE */}
                    {loading && timings.length === 0 ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : timings.length > 0 ? (
                        <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <Sunrise className="w-4 h-4" /> {copy.prayerTimes}
                            </h3>
                            <div className="border rounded-md overflow-hidden text-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="p-2 font-medium">{copy.date}</th>
                                            <th className="p-2 font-medium">{copy.fajr}</th>
                                            <th className="p-2 font-medium">{copy.sunrise}</th>
                                            <th className="p-2 font-medium">{copy.sunset}</th>
                                            <th className="p-2 font-medium">{copy.maghrib}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timings.map((day, i) => {
                                            const isToday = day.date.startsWith(today);
                                            return (
                                                <tr key={i} className={`border-t ${isToday ? 'bg-purple-100 font-medium' : 'hover:bg-muted/50'}`}>
                                                    <td className="p-2">{formatDate(day.date)}</td>
                                                    <td className="p-2">{day.fajr || "—"}</td>
                                                    <td className="p-2 text-muted-foreground">{day.sunrise || "—"}</td>
                                                    <td className="p-2 text-muted-foreground">{day.sunset || "—"}</td>
                                                    <td className="p-2 font-semibold text-purple-700">{day.maghrib || "—"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-8 text-muted-foreground">
                            {loading ? copy.loadingData : copy.noDetails}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

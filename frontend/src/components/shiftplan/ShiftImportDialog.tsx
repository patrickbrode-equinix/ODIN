
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { parseShiftplanExcel } from "../../utils/shiftplanExcelImporter";
import { normalizePlansByMonth } from "./shiftplan.months";
import { api } from "../../api/api";

// Using axios directly or use a generated API function. 
// Since we didn't add the API function to `shiftplan.api.ts` yet, I'll inline the fetch 
// or I'll update `shiftplan.api.ts` separately. Inlining for now or adding to api file is better.
// Let's use axios for now to keep it self-contained or update api file.
// I will expect an `importScheduleMerge` function passed as prop or I call endpoints.

interface Props {
    onImportSuccess?: () => void;
}

export function ShiftImportDialog({ onImportSuccess }: Props) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Confirmed data to be uploaded
    const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
    const [monthsFound, setMonthsFound] = useState<string[]>([]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);

        // Auto-analyze
        setAnalyzing(true);
        try {
            // We assume 2026 for now or try to extract from filename?
            // Requirement: "3-month update plans ... We have a complete schedule for 2026 already."
            // We probably should detect year from filename OR rely on content.
            let year = 2026;
            const yearMatch = f.name.match(/(20\d{2})/);
            if (yearMatch) year = Number(yearMatch[1]);

            const rawPlans = await parseShiftplanExcel(f);
            const normalized = normalizePlansByMonth(rawPlans, year);

            // Transform normalized list into { "Month Label": { Emp: { Day: Code } } }
            const schedules: Record<string, any> = {};
            const months: string[] = [];

            for (const { label, plan } of normalized) {
                months.push(label);

                const monthSchedule: Record<string, any> = {};
                for (const emp of plan.employees || []) {
                    const dayMap: Record<number, string> = {};
                    for (const [dayKey, shiftCode] of Object.entries(emp.shifts)) {
                        const d = Number(dayKey);
                        if (shiftCode) dayMap[d] = String(shiftCode).trim();
                    }
                    if (Object.keys(dayMap).length > 0) {
                        monthSchedule[emp.name] = dayMap;
                    }
                }
                schedules[label] = monthSchedule;
            }

            setParsedData(schedules);
            setMonthsFound(months);
        } catch (err) {
            console.error("Analysis Error", err);
            alert("Fehler beim Analysieren der Datei.");
            setFile(null);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleConfirm = async () => {
        if (!parsedData) return;
        setUploading(true);
        try {
            await api.post("/schedules/import/merge", { schedules: parsedData });
            setOpen(false);
            setFile(null);
            setParsedData(null);
            onImportSuccess?.();
            alert("Import erfolgreich!");
        } catch (err: any) {
            console.error("Upload Error", err);
            alert("Import fehlgeschlagen: " + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
                setFile(null);
                setParsedData(null);
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Update Import
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update-Import (Teil-Überschreibung)</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!parsedData ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">
                                Laden Sie eine Excel-Datei hoch.
                                Enthaltene Monate werden im System überschrieben.
                                Andere Monate bleiben unberührt.
                            </p>
                            <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} disabled={analyzing} />
                            {analyzing && <p className="text-sm">Analysiere Datei...</p>}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                                <p className="font-semibold text-yellow-600 mb-1">Achtung: Daten-Überschreibung</p>
                                <p className="text-sm text-muted-foreground">
                                    Folgende Monate wurden in der Datei gefunden und werden im System
                                    <strong> komplett überschrieben</strong>:
                                </p>
                                <ul className="list-disc list-inside mt-2 text-sm font-medium">
                                    {monthsFound.map(m => (
                                        <li key={m}>{m}</li>
                                    ))}
                                </ul>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Alle anderen Monate von 2026 bleiben erhalten.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)}>Abbrechen</Button>
                    {parsedData && (
                        <Button onClick={handleConfirm} disabled={uploading}>
                            {uploading ? "Importiere..." : "Jetzt überschreiben"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

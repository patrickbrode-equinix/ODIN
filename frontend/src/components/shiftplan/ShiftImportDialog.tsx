
import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { parseShiftplanExcel } from "../../utils/shiftplanExcelImporter";
import { normalizePlansByMonth } from "./shiftplan.months";
import { api } from "../../api/api";

interface MonthSummary {
  label: string;
  employees: number;
  shifts: number;
}

interface Props {
  onImportSuccess?: () => void;
}

export function ShiftImportDialog({ onImportSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
  const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([]);
  const [skippedSheets, setSkippedSheets] = useState<{ sheet: string; reason: string }[]>([]);
  const [importResult, setImportResult] = useState<{ months: number; employees: number; changes: number } | null>(null);

  const analyzeFile = async (f: File) => {
    setFile(f);
    setAnalyzing(true);
    try {
      let year = new Date().getFullYear();
      const yearMatch = f.name.match(/(20\d{2})/);
      if (yearMatch) year = Number(yearMatch[1]);

      const { data: rawPlans, skippedSheets: skipped } = await parseShiftplanExcel(f);
      const normalized = normalizePlansByMonth(rawPlans, year);

      const schedules: Record<string, any> = {};
      const summaries: MonthSummary[] = [];

      for (const { label, plan } of normalized) {
        const monthSchedule: Record<string, any> = {};
        let shiftCount = 0;
        for (const emp of plan.employees || []) {
          const dayMap: Record<number, string> = {};
          for (const [dayKey, shiftCode] of Object.entries(emp.shifts)) {
            const d = Number(dayKey);
            if (shiftCode) { dayMap[d] = String(shiftCode).trim(); shiftCount++; }
          }
          if (Object.keys(dayMap).length > 0) monthSchedule[emp.name] = dayMap;
        }
        schedules[label] = monthSchedule;
        summaries.push({ label, employees: Object.keys(monthSchedule).length, shifts: shiftCount });
      }

      setParsedData(schedules);
      setMonthSummaries(summaries);
      setSkippedSheets(skipped);
    } catch (err) {
      console.error("Analysis Error", err);
      alert("Fehler beim Analysieren der Datei.");
      reset();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) analyzeFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".xlsm"))) analyzeFile(f);
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    setUploading(true);
    try {
      const res = await api.post("/schedules/import/merge", { schedules: parsedData });
      const d = res.data || {};
      setImportResult({
        months: d.months_count ?? monthSummaries.length,
        employees: d.employees_count ?? monthSummaries.reduce((s, m) => Math.max(s, m.employees), 0),
        changes: d.changes_count ?? monthSummaries.reduce((s, m) => s + m.shifts, 0),
      });
      onImportSuccess?.();
    } catch (err: any) {
      console.error("Upload Error", err);
      alert("Import fehlgeschlagen: " + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsedData(null);
    setMonthSummaries([]);
    setSkippedSheets([]);
    setImportResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm">
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Update Import
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-2xl bg-[#080c1c] border border-blue-500/15 shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
        <DialogHeader>
          <DialogTitle className="text-base font-black tracking-wider uppercase text-white/90">
            Shiftplan Import
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SUCCESS */}
          {importResult ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
              <p className="text-lg font-bold text-green-300">Import erfolgreich!</p>
              <div className="grid grid-cols-3 gap-3 w-full mt-2">
                {[
                  { label: "Monate", value: importResult.months },
                  { label: "Mitarbeiter", value: importResult.employees },
                  { label: "Einträge", value: importResult.changes },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-xl py-3 px-2 text-center border border-white/10">
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <Button onClick={() => setOpen(false)} className="mt-2 bg-green-600/80 hover:bg-green-600 text-white">Schließen</Button>
            </div>
          ) : !parsedData ? (
            /* DROPZONE */
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${dragOver ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 hover:border-white/25 bg-white/[0.02]"}`}
            >
              <input ref={fileInputRef} type="file" accept=".xls,.xlsx,.xlsm" onChange={handleFileChange} className="hidden" disabled={analyzing} />
              {analyzing ? (
                <>
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                  <p className="text-sm text-muted-foreground">Analysiere Datei…</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-10 h-10 text-indigo-400/70" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/80">Excel-Datei hierher ziehen</p>
                    <p className="text-xs text-muted-foreground mt-1">oder klicken zum Auswählen (.xls, .xlsx, .xlsm)</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* SUMMARY */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/80">
                  <FileSpreadsheet className="w-4 h-4 inline mr-1.5 text-indigo-400" />
                  {file?.name}
                </p>
                <button onClick={reset} className="text-muted-foreground hover:text-foreground p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">Folgende Monate werden überschrieben</p>
                </div>
                <div className="space-y-1.5">
                  {monthSummaries.map(s => (
                    <div key={s.label} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-white/5 border border-white/5">
                      <span className="font-semibold text-white/90">{s.label}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{s.employees} Mitarbeiter</span>
                        <span>{s.shifts} Einträge</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {skippedSheets.length > 0 && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                    <p className="text-xs font-bold text-orange-300 uppercase tracking-wide">
                      {skippedSheets.length} Sheet{skippedSheets.length > 1 ? "s" : ""} übersprungen
                    </p>
                  </div>
                  <div className="space-y-1">
                    {skippedSheets.map(s => (
                      <div key={s.sheet} className="flex items-start justify-between text-xs px-2 py-1 rounded bg-white/5 border border-white/5 gap-2">
                        <span className="font-semibold text-white/80 shrink-0">{s.sheet}</span>
                        <span className="text-orange-300/80 text-right">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Alle anderen Monate bleiben unberührt.</p>
            </div>
          )}
        </div>

        {!importResult && (
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">Abbrechen</Button>
            {parsedData && (
              <Button onClick={handleConfirm} disabled={uploading}
                className="bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold">
                {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Importiere…</> : "Jetzt überschreiben"}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

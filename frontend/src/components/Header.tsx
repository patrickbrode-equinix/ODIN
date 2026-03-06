/* ---------------------------------------------------- */
/* HEADER                                              */
/* ---------------------------------------------------- */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Sun, Moon, Menu, ChevronDown, Activity, Clock, Info, Zap, X, Link2, Upload, Camera, Trash2 } from "lucide-react";

import { api } from "../api/api";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useHealthStatus } from "../hooks/useHealthStatus";
import { getUserDisplayName } from "../utils/userDisplay";
import { WeatherDisplay } from "./WeatherDisplay";
import { DashboardInfoBar } from "./dashboard/DashboardInfoBar";
import { DashboardToggles } from "./dashboard/DashboardToggles";
import { getFeatureToggles } from "../api/dashboard";
import { ProjectsPanel } from "./dashboard/ProjectsPanel";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

/* ---------------------------------------------------- */
/* QUICK LINKS CONFIG                                   */
/* Add / remove links here to extend the menu.         */
/* ---------------------------------------------------- */

const QUICK_LINKS = [
  { label: "ESH", url: "https://esh.equinix.com", description: "Employee Self Help" },
  { label: "Power BI", url: "https://app.powerbi.com", description: "Analytics & Reports" },
  { label: "ServiceNow", url: "https://equinix.service-now.com", description: "IT Service Management" },
  { label: "Concur", url: "https://www.concursolutions.com", description: "Travel & Expenses" },
  { label: "Global Label Printer", url: "https://labelprint.equinix.com", description: "Label Printing" },
];

/* ---------------------------------------------------- */
/* DATA                                                */
/* ---------------------------------------------------- */

const slideshowMessages = [
  "Update: Shiftplan hochgeladen",
  "Reminder: TFM Meeting 11:30",
  "Neue Prozesse ab Montag",
  "System Update erfolgreich abgeschlossen",
  "Wartungsfenster: Sonntag 02:00-04:00",
];

/* ---------------------------------------------------- */
/* TYPES                                               */
/* ---------------------------------------------------- */

interface HeaderProps {
  onToggleSidebar: () => void;
}

type MetricsResponse = {
  uptimeSec?: number;
  process?: {
    rssMB?: number;
    heapUsedMB?: number;
    heapTotalMB?: number;
  };
  system?: {
    cpuUsagePct?: number | null;
    memUsedPct?: number;
    loadavg?: {
      load1?: number;
      load5?: number;
      load15?: number;
    };
  };
  node?: string;
  timestamp?: string;
};

/* ---------------------------------------------------- */
/* HELPERS                                             */
/* ---------------------------------------------------- */

function formatUptime(sec?: number) {
  if (!Number.isFinite(sec)) return "-";
  const s = Math.floor(sec!);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}:${String(r).padStart(2, "0")}`;
}

function fmt1(n?: number | null) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return Number(n).toFixed(1);
}

/* ---------------------------------------------------- */
/* CLOCK COMPONENT                                     */
/* ---------------------------------------------------- */

/* ---------------------------------------------------- */
/* CLOCK COMPONENT                                     */
/* ---------------------------------------------------- */

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "London (GMT)", value: "Europe/London" },
  { label: "Berlin (CET)", value: "Europe/Berlin" },
  { label: "Moscow (MSK)", value: "Europe/Moscow" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "India (IST)", value: "Asia/Kolkata" },
  { label: "Bangkok (ICT)", value: "Asia/Bangkok" },
  { label: "Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEDT)", value: "Australia/Sydney" },
  { label: "Los Angeles (PST)", value: "America/Los_Angeles" },
  { label: "Denver (MST)", value: "America/Denver" },
  { label: "Chicago (CST)", value: "America/Chicago" },
  { label: "New York (EST)", value: "America/New_York" },
  { label: "Sao Paulo (BRT)", value: "America/Sao_Paulo" },
];

function ClockDisplay() {
  const [now, setNow] = useState(new Date());
  const [tz, setTz] = useState(() => localStorage.getItem("app-timezone") || "Europe/Berlin");

  useEffect(() => {
    localStorage.setItem("app-timezone", tz);
  }, [tz]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000); // Tick every second
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date, timezone: string) => {
    try {
      // Format: "Mo, 16.02.2026 01:48"
      const formatter = new Intl.DateTimeFormat("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      });
      return formatter.format(date);
    } catch (e) {
      return "Invalid TZ";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="px-3 py-1.5 hover:bg-white/5 rounded-lg text-[13px] font-medium tabular-nums flex items-center gap-2 border border-transparent hover:border-white/10 transition-all text-slate-200">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>{formatTime(now, tz)}</span>
          <span className="text-slate-500 text-[11px] hidden xl:inline">
            ({tz})
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        {TIMEZONES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTz(t.value)}
            className="flex justify-between gap-4"
          >
            <span>{t.label}</span>
            {tz === t.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------- */
/* EVENTS PANEL (upload + manage event photos)          */
/* ---------------------------------------------------- */

function EventsPanel() {
  const [images, setImages] = useState<Array<{
    id: number;
    url_path: string;
    original_name?: string;
    filename: string;
    created_at: string;
  }>>([]);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await api.get("/events/images");
      setImages(Array.isArray(res.data) ? res.data : []);
      setLoadError(null);
    } catch {
      setLoadError("Bilder konnten nicht geladen werden.");
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("images", f);
      await api.post("/events/images", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await load();
    } catch {
      alert("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bild löschen?")) return;
    try {
      await api.delete(`/events/images/${id}`);
      setImages(prev => prev.filter(i => i.id !== id));
    } catch {
      alert("Löschen fehlgeschlagen.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload trigger */}
      <div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-semibold transition disabled:opacity-60"
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Wird hochgeladen..." : "Bilder hochladen"}
        </button>
        <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG, WebP, GIF · max. 20 MB pro Datei</p>
      </div>

      {loadError && <p className="text-red-400 text-sm">{loadError}</p>}

      {/* Image list */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Camera className="w-12 h-12 opacity-20" />
          <p className="text-sm">Keine Event-Bilder vorhanden</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map(img => (
            <div
              key={img.id}
              className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 group"
            >
              <img
                src={img.url_path}
                alt={img.original_name ?? img.filename}
                className="w-full h-28 object-cover"
                loading="lazy"
              />
              <div className="flex items-center justify-between px-2 py-1.5 gap-1">
                <span className="text-[11px] text-slate-400 truncate">
                  {img.original_name ?? img.filename}
                </span>
                <button
                  onClick={() => handleDelete(img.id)}
                  className="shrink-0 p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition"
                  title="Löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------- */
/* INFOS MODAL                                         */
/* ---------------------------------------------------- */

function InfosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"instructions" | "projects" | "events">("instructions");

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[9999] bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl w-[96vw] max-w-[96vw] h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-none">
          {/* MODE SWITCHER */}
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-amber-400" />
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setMode("instructions")}
                className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                  mode === "instructions"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Anweisungen
              </button>
              <button
                onClick={() => setMode("projects")}
                className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                  mode === "projects"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Projekte
              </button>
              <button
                onClick={() => setMode("events")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                  mode === "events"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Camera className="w-3 h-3" />
                Events
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {mode === "instructions" ? (
            <DashboardInfoBar />
          ) : mode === "projects" ? (
            <ProjectsPanel />
          ) : (
            <EventsPanel />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- */
/* AUTOMATIONEN MODAL                                  */
/* ---------------------------------------------------- */

function AutomationenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[9999] bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl w-[90vw] max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-none">
          <div className="flex items-center gap-2 font-semibold">
            <Zap className="w-4 h-4 text-green-400" />
            Einstellungen & Automationen
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          <DashboardToggles noHeader />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- */
/* QUICK LINKS MENU                                    */
/* ---------------------------------------------------- */

function QuickLinksMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
          title="Quick Links"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Links</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[#0f172a] border border-white/10 text-slate-200">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Quick Links
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        {QUICK_LINKS.map((link) => (
          <DropdownMenuItem
            key={link.label}
            asChild
            className="focus:bg-white/10 focus:text-white cursor-pointer"
          >
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-0.5 px-3 py-2"
            >
              <span className="font-semibold text-[13px] text-slate-200">{link.label}</span>
              <span className="text-[11px] text-slate-500">{link.description}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------- */
/* COMPONENT                                           */
/* ---------------------------------------------------- */

export function Header({ onToggleSidebar }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { status, error } = useHealthStatus();

  const [language, setLanguage] = useState("de");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  /* Infos / Automationen modals */
  const [infosOpen, setInfosOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);

  /* Automationen badge state: green if any toggle active */
  const [anyAutomationActive, setAnyAutomationActive] = useState(false);

  /* Last shiftplan upload */
  const [lastShiftplanUpload, setLastShiftplanUpload] = useState<string | null>(null);

  useEffect(() => {
    const fetchToggles = () => {
      getFeatureToggles().then(t => {
        setAnyAutomationActive(Object.values(t).some(v => !!v));
      }).catch(() => { });
    };
    fetchToggles();
    const interval = setInterval(fetchToggles, 30000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------- */
  /* SLIDESHOW                                          */
  /* -------------------------------------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((p) => (p + 1) % slideshowMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------- */
  /* CRAWLER META POLL                                  */
  /* -------------------------------------------------- */
  const [crawlerMeta, setCrawlerMeta] = useState<{
    lastUpdate: string | null;
    count: number;
    breakdown: { sh: number; tt: number; cc: number };
  } | null>(null);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await api.get("/commit/meta");
        setCrawlerMeta(res.data);
      } catch (e) {
        console.error("Failed to fetch crawler meta", e);
      }
    };

    fetchMeta();
    const interval = setInterval(fetchMeta, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------- */
  /* LAST SHIFTPLAN UPLOAD POLL                         */
  /* -------------------------------------------------- */
  useEffect(() => {
    const fetchLastUpload = async () => {
      try {
        const res = await api.get("/schedules/last-upload");
        setLastShiftplanUpload(res.data?.uploaded_at ?? null);
      } catch { /* non-fatal */ }
    };
    fetchLastUpload();
    const interval = setInterval(fetchLastUpload, 60000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------- */
  /* METRICS POLL                                       */
  /* -------------------------------------------------- */
  useEffect(() => {
    let alive = true;

    const fetchMetrics = async () => {
      try {
        const res = await api.get("/metrics");
        if (!alive) return;
        setMetrics(res.data);
        setMetricsError(null);
      } catch (e: any) {
        if (!alive) return;
        setMetricsError(e?.response?.data?.message ?? "Metrics error");
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  /* -------------------------------------------------- */
  /* LOGOUT                                             */
  /* -------------------------------------------------- */
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const systemOk =
    status?.backend === "ok" &&
    status?.database === "ok" &&
    !error;

  const metricsOk = !!metrics && !metricsError;
  const cpuPct = metrics?.system?.cpuUsagePct ?? null;
  const memPct = metrics?.system?.memUsedPct ?? null;

  const displayName = getUserDisplayName(user);

  // Format last update time
  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* MODALS (rendered outside header flow) */}
      <InfosModal open={infosOpen} onClose={() => setInfosOpen(false)} />
      <AutomationenModal open={automationOpen} onClose={() => setAutomationOpen(false)} />

      <header className="sticky top-0 z-40 w-full px-4 md:px-6 pt-4 pb-2 flex items-center justify-between gap-4 bg-transparent pointer-events-none">
        {/* LEFT */}
        <div className="flex items-center gap-3 bg-[rgba(8,12,28,0.72)] backdrop-blur-[20px] border border-blue-500/15 rounded-2xl p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] pointer-events-auto transition-all hover:border-blue-500/30">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-blue-500/10 text-slate-300 hover:text-blue-400 rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* CENTER: CRAWLER INFO */}
        <div className="flex-1 flex justify-center pointer-events-none hidden md:flex">
          <div className="bg-[rgba(8,12,28,0.72)] backdrop-blur-[20px] border border-blue-500/15 rounded-2xl px-5 py-2 flex items-center gap-6 text-[13px] shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:border-blue-500/30 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Last Update:</span>
              <span className="font-bold text-slate-200">
                {formatTime(crawlerMeta?.lastUpdate ?? null)}
              </span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Active Tickets:</span>
              <span className="font-bold text-blue-400">
                {crawlerMeta ? crawlerMeta.count : "—"}
              </span>
            </div>

            {crawlerMeta && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      <span className="text-blue-200">SH: {crawlerMeta?.breakdown?.sh ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                      <span className="text-rose-200">TT: {crawlerMeta?.breakdown?.tt ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                      <span className="text-amber-200">CC: {crawlerMeta?.breakdown?.cc ?? 0}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium">Shiftplan:</span>
              <span className="font-bold text-slate-200">
                {lastShiftplanUpload ? formatTime(lastShiftplanUpload) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2 bg-[rgba(8,12,28,0.72)] backdrop-blur-[20px] border border-blue-500/15 rounded-2xl p-1.5 px-2 shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] pointer-events-auto transition-all hover:border-blue-500/30">
          {/* GLOBAL CLOCK */}
          <ClockDisplay />

          {/* WEATHER */}
          <div className="hidden lg:block">
            <WeatherDisplay />
          </div>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* INFOS BADGE */}
          <button
            onClick={() => setInfosOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            title="Informationen und Anweisungen"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Infos</span>
          </button>

          {/* AUTOMATIONEN BADGE */}
          <button
            onClick={() => setAutomationOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${anyAutomationActive
              ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
              : "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
              }`}
            title="Einstellungen & Automationen"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Automationen</span>
          </button>

          {/* QUICK LINKS */}
          <QuickLinksMenu />

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* METRICS */}
          <div className="relative group">
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <Activity
                className={`w-4 h-4 ${metricsOk ? "text-slate-300" : "text-rose-400"
                  }`}
              />
            </button>

            <div className="absolute right-0 top-10 hidden group-hover:block bg-[#0f172a] border border-white/10 rounded-xl p-4 text-[13px] shadow-2xl w-72 z-50 animate-in fade-in zoom-in-95">
              <div className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                System Metrics
              </div>
              {!metricsOk ? (
                <div className="text-rose-400 text-sm bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {metricsError ?? "not available"}
                </div>
              ) : (
                <div className="space-y-2 text-slate-300">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">CPU</span>
                    <span className="font-medium text-slate-200">{cpuPct === null ? "-" : `${fmt1(cpuPct)} %`}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">RAM</span>
                    <span className="font-medium text-slate-200">{memPct === null ? "-" : `${fmt1(memPct)} %`}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Uptime</span>
                      <span className="font-medium text-slate-200">{formatUptime(metrics?.uptimeSec)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* THEME */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-300 transition-colors"
          >
            {theme === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* LANGUAGE */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-300">
                <img
                  src={language === "de" ? "/app/flags/de.svg" : "/app/flags/us.svg"}
                  className="h-3.5 object-contain"
                  alt="lang"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0f172a] border border-white/10 text-slate-200">
              <DropdownMenuItem onClick={() => setLanguage("de")} className="focus:bg-white/10 focus:text-white">
                Deutsch
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("en")} className="focus:bg-white/10 focus:text-white">
                English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* USER */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1.5 pl-2 hover:bg-white/5 rounded-lg transition-colors text-slate-200 group">
                <span className="hidden md:inline text-[13px] font-medium group-hover:text-white transition-colors">
                  {displayName}
                </span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-inner">
                  <User className="w-3.5 h-3.5" />
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48 bg-[#0f172a] border border-white/10 text-slate-200">
              <DropdownMenuItem onClick={() => navigate("/settings")} className="focus:bg-white/10 focus:text-white">
                Einstellungen
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-400"
              >
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}

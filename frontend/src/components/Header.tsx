/* ---------------------------------------------------- */
/* HEADER                                              */
/* ---------------------------------------------------- */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Sun, Moon, Menu, ChevronDown, Activity, Clock, Info, X, Link2, Upload, Camera, Trash2, Eye, EyeOff, Database, Gauge, UsersRound } from "lucide-react";

import { api } from "../api/api";
import { fetchEqixQuote, type MarketQuote } from "../api/market";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useHealthStatus } from "../hooks/useHealthStatus";
import { getUserDisplayName } from "../utils/userDisplay";
import { useCrawlerStaleness } from "../hooks/useCrawlerStaleness";
import { WeatherDisplay } from "./WeatherDisplay";
import { DashboardInfoBar } from "./dashboard/DashboardInfoBar";
import { getFeatureToggles } from "../api/dashboard";
import { ProjectsPanel } from "./dashboard/ProjectsPanel";
import { FeedbackButton } from "./FeedbackButton";
import { Brain, MessageSquareMore, Vote } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { FlagIcon } from "./FlagIcon";
import { PollsPanel } from "./PollsPanel";

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
  users?: {
    onlineCount?: number;
    totalApproved?: number;
    recentWindowMinutes?: number;
  };
  database?: {
    sizeMB?: number;
    sizePretty?: string | null;
    connectionCount?: number;
  };
  tickets?: {
    activeCount?: number;
    perOnlineUser?: number | null;
  };
  utilization?: {
    overallPct?: number | null;
    systemLoadPct?: number | null;
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

function formatStorage(sizePretty?: string | null, sizeMB?: number) {
  if (sizePretty) return sizePretty;
  if (sizeMB === null || sizeMB === undefined || !Number.isFinite(sizeMB)) return "-";
  return `${fmt1(sizeMB)} MB`;
}

function formatQuotePrice(price: number | null, currency: string | null) {
  if (price === null || !Number.isFinite(price)) return "--";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price?.toFixed(2) ?? "--"} ${currency || "USD"}`;
  }
}

function formatQuoteDelta(changePercent: number | null) {
  if (changePercent === null || !Number.isFinite(changePercent)) return null;
  return `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
}

function EqixStockBadge() {
  const { language } = useLanguage();
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const loadQuote = async () => {
      try {
        const nextQuote = await fetchEqixQuote();
        if (!alive) return;
        setQuote(nextQuote);
      } catch (error) {
        if (!alive) return;
        console.error("Failed to fetch EQIX quote", error);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadQuote();
    const interval = setInterval(loadQuote, 300000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const available = quote?.available === true && Number.isFinite(quote?.price);
  const delta = formatQuoteDelta(quote?.changePercent ?? null);
  const positive = (quote?.changePercent ?? 0) >= 0;
  const isGerman = language === "de";
  const title = available
    ? isGerman
      ? `Equinix-Aktie · ${quote?.stale ? "zwischengespeichert" : "live"}`
      : `Equinix stock · ${quote?.stale ? "cached" : "live"}`
    : isGerman
      ? "Equinix-Aktie aktuell nicht verfügbar"
      : "Equinix stock price currently unavailable";

  return (
    <div
      className="hidden shrink-0 sm:flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-[12px] font-medium text-cyan-100"
      title={title}
    >
      <span className={`h-2 w-2 rounded-full ${available ? (quote?.stale ? "bg-amber-400" : positive ? "bg-emerald-400" : "bg-rose-400") : loading ? "bg-slate-500 animate-pulse" : "bg-slate-500"}`} />
      <span className="font-semibold tracking-wide text-cyan-200">EQIX</span>
      <span className="text-slate-100">{available ? formatQuotePrice(quote?.price ?? null, quote?.currency ?? null) : "--"}</span>
      {available && delta ? (
        <span className={positive ? "text-emerald-300" : "text-rose-300"}>{delta}</span>
      ) : null}
    </div>
  );
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
  const { t } = useLanguage();
  const [images, setImages] = useState<Array<{
    id: number;
    url_path: string;
    original_name?: string;
    filename: string;
    created_at: string;    is_visible: boolean;  }>>([]);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await api.get("/events/images");
      setImages(Array.isArray(res.data) ? res.data : []);
      setLoadError(null);
    } catch {
      setLoadError(t("header.imageLoadError"));
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
      alert(t("header.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("header.confirmDeleteImage"))) return;
    try {
      await api.delete(`/events/images/${id}`);
      setImages(prev => prev.filter(i => i.id !== id));
    } catch {
      alert(t("header.deleteFailed"));
    }
  };

  const handleToggleVisibility = async (id: number, current: boolean) => {
    try {
      await api.patch(`/events/images/${id}/visibility`, { is_visible: !current });
      setImages(prev => prev.map(i => i.id === id ? { ...i, is_visible: !current } : i));
    } catch {
      alert(t("header.visibilityChangeFailed"));
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
          {uploading ? t("header.uploading") : t("header.uploadButton")}
        </button>
        <p className="text-[11px] text-muted-foreground mt-1">{t("header.fileFormats")}</p>
      </div>

      {loadError && <p className="text-red-400 text-sm">{loadError}</p>}

      {/* Image list */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Camera className="w-12 h-12 opacity-20" />
          <p className="text-sm">{t("header.noImagesAvailable")}</p>
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
                className={`w-full h-28 object-cover transition-opacity ${img.is_visible ? '' : 'opacity-30 grayscale'}`}
                loading="lazy"
              />
              {!img.is_visible && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <EyeOff className="w-6 h-6 text-white/50" />
                </div>
              )}
              <div className="flex items-center justify-between px-2 py-1.5 gap-1">
                <span className="text-[11px] text-slate-400 truncate">
                  {img.original_name ?? img.filename}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleToggleVisibility(img.id, img.is_visible)}
                    className={`shrink-0 p-1 rounded transition ${
                      img.is_visible
                        ? 'text-green-400 hover:text-slate-400 hover:bg-white/10'
                        : 'text-slate-500 hover:text-green-400 hover:bg-white/10'
                    }`}
                    title={img.is_visible ? t('header.imageVisibleHint') : t('header.imageHiddenHint')}
                  >
                    {img.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="shrink-0 p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition"
                    title={t("header.deleteTooltip")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
  const { t } = useLanguage();
  const [mode, setMode] = useState<"instructions" | "projects" | "events" | "polls">("instructions");

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
                {t("header.instructions")}
              </button>
              <button
                onClick={() => setMode("projects")}
                className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                  mode === "projects"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t("header.projects")}
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
              <button
                onClick={() => setMode("polls")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                  mode === "polls"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Vote className="w-3 h-3" />
                {t("header.polls")}
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
          ) : mode === "polls" ? (
            <PollsPanel />
          ) : (
            <EventsPanel />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- */
/* QUICK LINKS MENU                                    */
/* ---------------------------------------------------- */

function QuickLinksMenu() {
  const { t } = useLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
          title={t("header.quickLinks")}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{t("header.links")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[#0f172a] border border-white/10 text-slate-200">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {t("header.quickLinks")}
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
  const { language, languages, setLanguage, t } = useLanguage();

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  /* Infos modal */
  const [infosOpen, setInfosOpen] = useState(false);

  /* Status indicators: Teams + ODIN-Logik */
  const [teamsActive, setTeamsActive] = useState(false);
  const [odinLogicActive, setOdinLogicActive] = useState(false);

  /* Last shiftplan upload */
  const [lastShiftplanUpload, setLastShiftplanUpload] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const toggles = await getFeatureToggles();
        const teamsKeys = ['teams_tt','teams_update','teams_expedite','teams_assign','teams_info'];
        setTeamsActive(teamsKeys.some(k => !!(toggles as any)[k]));
      } catch { /* non-fatal */ }
      try {
        const res = await api.get('/assignment/health');
        setOdinLogicActive(res.data?.enabled === true);
      } catch { /* non-fatal */ }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
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

  const metricsOk = !!metrics;
  const metricsStale = !!metrics && !!metricsError;
  const cpuPct = metrics?.system?.cpuUsagePct ?? null;
  const memPct = metrics?.system?.memUsedPct ?? null;
  const onlineUsers = metrics?.users?.onlineCount ?? null;
  const totalUsers = metrics?.users?.totalApproved ?? null;
  const dbSize = formatStorage(metrics?.database?.sizePretty, metrics?.database?.sizeMB);
  const overallUtilization = metrics?.utilization?.overallPct ?? null;
  const systemLoadPct = metrics?.utilization?.systemLoadPct ?? null;
  const activeTicketsPerOnlineUser = metrics?.tickets?.perOnlineUser ?? null;

  const displayName = getUserDisplayName(user);
  const activeLanguage = languages.find((entry) => entry.code === language) || languages[0];

  // Format last update as DD.MM.YYYY HH:mm
  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return t("header.noUpdateAvailable");
    const d = new Date(iso);
    if (isNaN(d.getTime())) return t("header.noUpdateAvailable");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  };

  // Crawler staleness detection (> 5 minutes = stale)
  const crawlerStaleness = useCrawlerStaleness(crawlerMeta?.lastUpdate ?? null);

  return (
    <>
      {/* MODALS (rendered outside header flow) */}
      <InfosModal open={infosOpen} onClose={() => setInfosOpen(false)} />

      <header className="sticky top-0 z-40 flex w-full flex-wrap items-start justify-between gap-3 bg-transparent px-3 pb-2 pt-3 pointer-events-none sm:px-4 sm:pt-4 lg:px-6 2xl:items-center">
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
        <div className="order-3 flex basis-full justify-center pointer-events-none">
          <div className="w-full max-w-[1480px] bg-[rgba(8,12,28,0.72)] backdrop-blur-[20px] border border-blue-500/15 rounded-2xl px-4 py-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:border-blue-500/30 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">{t("header.crawlerUpdate")}:</span>
              <span className={`font-bold ${crawlerStaleness.isStale ? "text-red-400" : "text-slate-200"}`}>
                {formatDateTime(crawlerMeta?.lastUpdate ?? null)}
              </span>
            </div>

            {/* Crawler staleness warning */}
            {crawlerStaleness.isStale && (
              <>
                <div className="h-4 w-px bg-red-500/30" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <span className="text-red-400 font-bold text-[11px] uppercase tracking-wider">{t("header.noCurrentCrawlerData")}</span>
                </div>
              </>
            )}

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">{t("header.activeTickets")}:</span>
              <span className={`font-bold ${crawlerStaleness.isStale ? "text-red-400/50" : "text-blue-400"}`}>
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
              <span className="text-slate-500 font-medium">{t("header.shiftplan")}:</span>
              <span className="font-bold text-slate-200">
                {lastShiftplanUpload ? formatDateTime(lastShiftplanUpload) : t("header.noUpdateAvailable")}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 rounded-2xl border border-blue-500/15 bg-[rgba(8,12,28,0.72)] p-1.5 px-2 shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] pointer-events-auto transition-all hover:border-blue-500/30">
          {/* GLOBAL CLOCK */}
          <ClockDisplay />

          {/* WEATHER */}
          <div className="hidden shrink-0 lg:block">
            <WeatherDisplay />
          </div>

          <EqixStockBadge />

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* INFOS BADGE */}
          <button
            onClick={() => setInfosOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            title={t("header.infoAndInstructions")}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{t("header.infos")}</span>
          </button>

          {/* STATUS: TEAMS BENACHRICHTIGUNGEN */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border transition-colors cursor-default ${teamsActive
              ? "border-green-500/40 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.25)]"
              : "border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.25)]"
              }`}
            title={teamsActive ? t("header.teamsActiveTooltip") : t("header.teamsInactiveTooltip")}
          >
            <span className={`w-2 h-2 rounded-full ${teamsActive ? "bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]" : "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]"}`} />
            <MessageSquareMore className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{teamsActive ? t("header.teamsActive") : t("header.teamsInactive")}</span>
          </div>

          {/* STATUS: ODIN-LOGIK */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-lg border transition-colors cursor-default ${odinLogicActive
              ? "border-green-500/40 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.25)]"
              : "border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.25)]"
              }`}
            title={odinLogicActive ? t("header.odinLogicActiveTooltip") : t("header.odinLogicInactiveTooltip")}
          >
            <span className={`w-2 h-2 rounded-full ${odinLogicActive ? "bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]" : "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]"}`} />
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{odinLogicActive ? t("header.odinLogicActive") : t("header.odinLogicInactive")}</span>
          </div>

          {/* FEEDBACK */}
          <FeedbackButton variant="header" />

          {/* QUICK LINKS */}
          <QuickLinksMenu />

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* METRICS */}
          <div className="relative group">
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors" title={t("header.systemMetrics")}>
              <Activity
                className={`w-4 h-4 ${metricsOk ? metricsStale ? "text-amber-300" : "text-slate-300" : "text-rose-400"
                  }`}
              />
            </button>

            <div className="absolute right-0 top-10 z-50 hidden w-[22rem] rounded-xl border border-white/10 bg-[#0f172a] p-4 text-[13px] shadow-2xl animate-in fade-in zoom-in-95 group-hover:block">
              <div className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                {t("header.systemMetrics")}
              </div>
              {!metricsOk ? (
                <div className="text-rose-400 text-sm bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {metricsError ?? t("header.notAvailable")}
                </div>
              ) : (
                <div className="space-y-4 text-slate-300">
                  {metricsStale ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      {language === "de"
                        ? "Letzte erfolgreiche Metriken werden angezeigt. Das Live-Update ist aktuell gestört."
                        : "Showing the last successful metrics. Live updates are currently failing."}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                        <UsersRound className="h-3.5 w-3.5 text-sky-300" />
                        {t("header.loggedIn")}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{onlineUsers ?? "-"}</div>
                      <div className="text-[11px] text-slate-500">{`${onlineUsers ?? "-"} / ${totalUsers ?? "-"} ${t("header.ofApprovedUsers")}`}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                        <Gauge className="h-3.5 w-3.5 text-amber-300" />
                        {t("header.utilization")}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{overallUtilization === null ? "-" : `${fmt1(overallUtilization)} %`}</div>
                      <div className="text-[11px] text-slate-500">{t("header.systemLoad")} {systemLoadPct === null ? "-" : `${fmt1(systemLoadPct)} %`}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                        <Database className="h-3.5 w-3.5 text-fuchsia-300" />
                        {t("header.dbStorage")}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{dbSize}</div>
                      <div className="text-[11px] text-slate-500">{metrics?.database?.connectionCount ?? "-"} {t("header.activeConnections")}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                        <Activity className="h-3.5 w-3.5 text-emerald-300" />
                        {t("header.ticketLoad")}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{metrics?.tickets?.activeCount ?? "-"}</div>
                      <div className="text-[11px] text-slate-500">{activeTicketsPerOnlineUser === null ? "-" : `${fmt1(activeTicketsPerOnlineUser)} ${t("header.ticketsPerUser")}`}</div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">CPU</span>
                      <span className="font-medium text-slate-200">{cpuPct === null ? "-" : `${fmt1(cpuPct)} %`}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">RAM</span>
                      <span className="font-medium text-slate-200">{memPct === null ? "-" : `${fmt1(memPct)} %`}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Node Heap</span>
                      <span className="font-medium text-slate-200">{metrics?.process?.heapUsedMB === undefined ? "-" : `${fmt1(metrics?.process?.heapUsedMB)} / ${fmt1(metrics?.process?.heapTotalMB)} MB`}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Uptime</span>
                    <span className="font-medium text-slate-200">{formatUptime(metrics?.uptimeSec)}</span>
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
                <FlagIcon code={activeLanguage.code} />
                <span className="inline-flex min-w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-100">
                  {activeLanguage.shortLabel}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0f172a] border border-white/10 text-slate-200">
              {languages.map((option) => (
                <DropdownMenuItem key={option.code} onClick={() => setLanguage(option.code)} className="focus:bg-white/10 focus:text-white">
                  <div className="flex items-center gap-2">
                    <FlagIcon code={option.code} />
                    <span className="inline-flex min-w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-100">
                      {option.shortLabel}
                    </span>
                    <span>{option.nativeLabel}</span>
                  </div>
                </DropdownMenuItem>
              ))}
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
                {t("common.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-400"
              >
                {t("common.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}

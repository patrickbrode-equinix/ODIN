/* ---------------------------------------------------- */
/* HEADER                                              */
/* ---------------------------------------------------- */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Sun, Moon, Menu, ChevronDown, Activity, Clock, Info, Zap, X } from "lucide-react";

import { api } from "../api/api";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useHealthStatus } from "../hooks/useHealthStatus";
import { getUserDisplayName } from "../utils/userDisplay";
import { WeatherDisplay } from "./WeatherDisplay";
import { DashboardInfoBar } from "./dashboard/DashboardInfoBar";
import { DashboardToggles } from "./dashboard/DashboardToggles";
import { getFeatureToggles } from "../api/dashboard";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

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
        <button className="px-3 py-1.5 hover:bg-accent rounded-lg text-sm font-medium tabular-nums flex items-center gap-2 border border-transparent hover:border-border transition-all">
          <Clock className="w-4 h-4 text-primary" />
          <span>{formatTime(now, tz)}</span>
          <span className="text-muted-foreground text-xs hidden xl:inline">
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
/* INFOS MODAL                                         */
/* ---------------------------------------------------- */

function InfosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[9999] bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl w-[90vw] max-w-[90vw] xl:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-none">
          <div className="flex items-center gap-2 font-semibold">
            <Info className="w-4 h-4 text-amber-400" />
            Informationen und Anweisungen
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          <DashboardInfoBar />
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

      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* CENTER: CRAWLER INFO */}
        <div className="flex-1 flex justify-center">
          <div className="bg-accent/50 border border-border/50 rounded-xl px-4 py-1.5 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Last Update:</span>
              <span className="font-medium text-foreground">
                {formatTime(crawlerMeta?.lastUpdate ?? null)}
              </span>
            </div>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Active Tickets:</span>
              <span className="font-medium text-foreground">
                {crawlerMeta ? crawlerMeta.count : "—"}
              </span>
            </div>

            {crawlerMeta && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>SH: {crawlerMeta.breakdown.sh}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span>TT: {crawlerMeta.breakdown.tt}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>CC: {crawlerMeta.breakdown.cc}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          {/* GLOBAL CLOCK */}
          <ClockDisplay />

          {/* WEATHER */}
          <WeatherDisplay />

          {/* INFOS BADGE */}
          <button
            onClick={() => setInfosOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            title="Informationen und Anweisungen"
          >
            <Info className="w-4 h-4" />
            <span className="hidden lg:inline font-medium">Infos</span>
          </button>

          {/* AUTOMATIONEN BADGE */}
          <button
            onClick={() => setAutomationOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${anyAutomationActive
              ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
              : "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
              }`}
            title="Einstellungen & Automationen"
          >
            <Zap className="w-4 h-4" />
            <span className="hidden lg:inline font-medium">Automationen</span>
          </button>

          {/* SYSTEM STATUS */}
          <div className="relative group">
            <div
              className={`w-3 h-3 rounded-full ${systemOk ? "bg-green-500" : "bg-red-500"
                }`}
            />
            <div className="absolute right-0 top-6 hidden group-hover:block bg-card border rounded-lg p-3 text-sm shadow-xl w-56 z-50">
              <div className="font-medium mb-2">System Status</div>
              <div className="flex justify-between">
                <span>Backend</span>
                <span>{status?.backend ?? "error"}</span>
              </div>
              <div className="flex justify-between">
                <span>Database</span>
                <span>{status?.database ?? "error"}</span>
              </div>
              <div className="flex justify-between">
                <span>Latency</span>
                <span>{status?.latencyMs ?? "-"} ms</span>
              </div>
            </div>
          </div>

          {/* METRICS */}
          <div className="relative group">
            <button className="p-2 hover:bg-accent rounded-lg">
              <Activity
                className={`w-5 h-5 ${metricsOk ? "text-foreground" : "text-destructive"
                  }`}
              />
            </button>

            <div className="absolute right-0 top-10 hidden group-hover:block bg-card border rounded-lg p-3 text-sm shadow-xl w-72 z-50">
              <div className="font-medium mb-2">System Metrics</div>
              {!metricsOk ? (
                <div className="text-destructive text-sm">
                  {metricsError ?? "not available"}
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>CPU</span>
                    <span>{cpuPct === null ? "-" : `${fmt1(cpuPct)} %`}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span>RAM</span>
                    <span>{memPct === null ? "-" : `${fmt1(memPct)} %`}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Uptime: {formatUptime(metrics?.uptimeSec)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* THEME */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="p-2 hover:bg-accent rounded-lg"
          >
            {theme === "light" ? <Sun /> : <Moon />}
          </button>

          {/* LANGUAGE */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg">
                <img
                  src={language === "de" ? "/app/flags/de.svg" : "/app/flags/us.svg"}
                  className="h-4"
                />
                <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage("de")}>
                Deutsch
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("en")}>
                English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* USER */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                  <User className="w-4 h-4" />
                </div>
                <span className="hidden md:inline">{displayName}</span>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                Einstellungen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive"
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

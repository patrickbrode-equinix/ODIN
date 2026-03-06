/* ------------------------------------------------ */
/* TV LAYOUT – 4-SLIDE ROTATOR                     */
/* Slide 1: Schichten Heute + Tickets               */
/* Slide 2: Informationen & Anweisungen             */
/* Slide 3: Nächste 72 Stunden                      */
/* Slide 4: Handover                                */
/* ------------------------------------------------ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TvLayoutProps } from "./tv.types";
import { TvShiftplan } from "./tv.shiftplan";
import { TVHandoverMirror } from "./TVHandoverMirror";
import type { DashboardInfoEntry } from "../../api/dashboard";
import { ChevronLeft, ChevronRight, Clock, ArrowRightLeft, Users, AlertTriangle, Megaphone, FolderKanban, CheckCircle2, Calendar, User, Camera } from "lucide-react";
import { api } from "../../api/api";
import { getRemainingMs, getColorTier, tierClasses, tierGlow, formatRemainingTime } from "../../utils/ticketColors";
import { formatDate, formatTime } from "../../utils/dateFormat";

const AUTO_ROTATE_MS = 10_000; // 10 seconds – adjustable TV default
const PAUSE_AFTER_MANUAL_MS = 60_000;

/* Static slide definitions – filtering happens at runtime */
const ALL_SLIDES = [
  { id: "shifts",   title: "Schichten Heute",           icon: Users         },
  { id: "info",     title: "Informationen & Anweisungen", icon: Megaphone     },
  { id: "72h",      title: "N\u00e4chste 72 Stunden",          icon: AlertTriangle },
  { id: "handover", title: "Handover",                  icon: ArrowRightLeft },
  { id: "projects", title: "Projekte",                  icon: FolderKanban  },
  { id: "events",   title: "Events",                   icon: Camera        },
] as const;

type SlideId = typeof ALL_SLIDES[number]["id"];

/* ------------------------------------------------ */
/* SHIFT WINDOW CALCULATION                         */
/* ------------------------------------------------ */
type ShiftName = "E1" | "E2" | "L1" | "L2" | "N";
interface ShiftWindow { name: ShiftName; start: number; end: number; }

function getTodayShiftWindows(now: Date): ShiftWindow[] {
  const base = (h: number, m: number, extra = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + extra);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  return [
    { name: "E1", start: base(6, 30), end: base(15, 30) },
    { name: "E2", start: base(7, 0), end: base(16, 0) },
    { name: "L1", start: base(13, 0), end: base(22, 0) },
    { name: "L2", start: base(15, 0), end: base(0, 0, 1) },
    { name: "N", start: base(21, 15), end: base(6, 45, 1) },
  ];
}

function buildShiftTiming(now: Date): { label: string; color: string }[] {
  const nowMs = now.getTime();
  const windows = getTodayShiftWindows(now);
  const result: { label: string; color: string }[] = [];

  for (const w of windows) {
    if (nowMs >= w.start && nowMs < w.end) {
      const remaining = w.end - nowMs;
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      result.push({ label: `${w.name}: noch ${h}h ${m}min`, color: "text-green-400 font-bold" });
    } else if (nowMs < w.start) {
      const until = w.start - nowMs;
      const h = Math.floor(until / 3600000);
      const m = Math.floor((until % 3600000) / 60000);
      result.push({ label: `${w.name} in ${h}h ${m}min`, color: "text-muted-foreground" });
    }
  }

  // Active shifts first
  result.sort((a, b) => {
    const aAct = a.label.includes("noch");
    const bAct = b.label.includes("noch");
    if (aAct && !bAct) return -1;
    if (!aAct && bAct) return 1;
    return 0;
  });

  return result;
}

/* ------------------------------------------------ */
/* SLIDE HEADER                                     */
/* ------------------------------------------------ */
function SlideHeader({ now, title, icon: Icon }: { now: Date; title: string; icon: React.FC<any> }) {
  const shiftInfo = useMemo(() => buildShiftTiming(now), [now]);

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-[#050a1c] border-b border-blue-500/30 shadow-[0_4px_32px_rgba(0,0,0,0.6)] shrink-0 gap-4"
      style={{ background: "linear-gradient(90deg, rgba(5,10,28,1) 0%, rgba(10,18,48,1) 50%, rgba(5,10,28,1) 100%)" }}>
      {/* ODIN BRANDING – always visible */}
      <div className="flex items-center gap-4 text-slate-100 shrink-0">
        <img
          src="/app/ODIN_Logo.png"
          alt="ODIN"
          className="w-16 h-16 object-contain drop-shadow-[0_0_20px_rgba(0,216,255,0.9)]"
        />
        <div>
          <div
            className="text-3xl font-black tracking-[0.2em] uppercase"
            style={{
              color: "#00d8ff",
              textShadow: "0 0 16px rgba(0,216,255,0.8), 0 0 40px rgba(59,130,246,0.4)",
            }}
          >
            O.D.I.N
          </div>
          <div className="text-xs font-semibold tracking-wider text-blue-300/70 uppercase">
            Operations Dispatching and Intelligence Node
          </div>
        </div>
        <div className="h-8 w-px bg-white/10 mx-2" />
        <div className="flex items-center gap-2.5 font-bold tracking-widest uppercase text-slate-300">
          <Icon className="w-6 h-6 text-indigo-400" />
          <span className="text-xl">{title}</span>
        </div>
      </div>

      {/* Shift timers */}
      <div className="flex items-center gap-4 text-base overflow-hidden">
        {shiftInfo.map((s, i) => (
          <span key={i} className={`font-semibold whitespace-nowrap ${s.color}`}>{s.label}</span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-lg text-muted-foreground shrink-0">
        <span className="text-slate-300">{formatDate(now)}</span>
        <span
          className="font-mono font-black text-2xl"
          style={{ color: "#00d8ff", textShadow: "0 0 8px rgba(0,216,255,0.5)" }}
        >
          {formatTime(now)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* HELPER: project glow by progress %               */
/* ------------------------------------------------ */
function getProjectGlow(progress: number): string {
  const p = Math.min(100, Math.max(0, progress));
  if (p <= 25) return "shadow-[0_0_20px_3px_rgba(239,68,68,0.45)] border-red-500/40";
  if (p <= 50) return "shadow-[0_0_20px_3px_rgba(249,115,22,0.45)] border-orange-500/40";
  if (p <= 75) return "shadow-[0_0_20px_3px_rgba(21,128,61,0.5)] border-green-700/40";
  return "shadow-[0_0_20px_3px_rgba(134,239,172,0.45)] border-green-400/40";
}

/* ------------------------------------------------ */
/* PROJEKTE SLIDE (read-only, TV-optimiert)          */
/* ------------------------------------------------ */

interface TvProject {
  id: number;
  name: string;
  responsible?: string | null;
  expected_done?: string | null;
  progress: number;
  description?: string | null;
  status: string;
  creator: string;
  created_at: string;
}

function ProgressBarTv({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, progress));
  const color =
    pct >= 100 ? "bg-green-500" :
    pct >= 60 ? "bg-blue-500" :
    pct >= 30 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ProjekteSlide({ projects }: { projects: TvProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <FolderKanban className="w-16 h-16 opacity-20" />
        <p className="text-2xl font-semibold">Keine Projekte angelegt</p>
      </div>
    );
  }

  const active = projects.filter(p => p.status !== "completed");
  const done = projects.filter(p => p.status === "completed");

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* AKTIVE PROJEKTE */}
        {active.length > 0 && (
          <div>
            <h2 className="text-xl font-black tracking-wide uppercase text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.4)] mb-4">
              Aktive Projekte
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {active.map(p => {
                const daysLeft = p.expected_done
                  ? Math.ceil((new Date(p.expected_done).getTime() - Date.now()) / 86400000)
                  : null;
                const daysColor =
                  daysLeft === null ? "text-slate-500"
                  : daysLeft < 0 ? "text-red-400"
                  : daysLeft < 7 ? "text-orange-400"
                  : "text-slate-300";
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col gap-3 px-5 py-4 rounded-2xl bg-[#0f172a]/80 backdrop-blur-md border ${getProjectGlow(p.progress)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-lg text-slate-100 leading-snug">{p.name}</h3>
                      <span className="text-lg font-black text-blue-300 shrink-0">{p.progress}%</span>
                    </div>

                    <ProgressBarTv progress={p.progress} />

                    <div className="flex flex-wrap gap-3 text-[13px] text-slate-400">
                      {p.responsible && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {p.responsible}
                        </span>
                      )}
                      {p.expected_done && (
                        <span className={`flex items-center gap-1.5 ${daysColor}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(p.expected_done).toLocaleDateString("de-DE")}
                          {daysLeft !== null && (
                            <span className="text-[12px]">
                              ({daysLeft < 0 ? `${Math.abs(daysLeft)}d überfällig` : daysLeft === 0 ? "heute" : `noch ${daysLeft}d`})
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {p.description && (
                      <p className="text-[13px] text-slate-400 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABGESCHLOSSENE PROJEKTE */}
        {done.length > 0 && (
          <div>
            <h2 className="text-xl font-black tracking-wide uppercase text-green-400 drop-shadow-[0_0_6px_rgba(34,197,94,0.4)] mb-4">
              Abgeschlossen
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {done.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-950/20 border border-green-500/20"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-green-100 truncate">{p.name}</p>
                    {p.responsible && (
                      <p className="text-[12px] text-slate-400 truncate">{p.responsible}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* INFO & ANWEISUNGEN SLIDE                         */
/* Full-width list, glow by type                    */
/* ------------------------------------------------ */
function InfoAnweisungenSlide({ entries }: { entries: DashboardInfoEntry[] }) {
  // DB values: 'instruction' | 'info'
  const anweisungen = entries.filter(e => e.type === "instruction");
  const infos = entries.filter(e => e.type !== "instruction");

  return (
    <div className="h-full overflow-auto p-6">
      <div className="w-full space-y-4">

        {/* ANWEISUNGEN – red glow, full-width */}
        {anweisungen.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-5 h-5 text-red-400 animate-pulse" />
              <h2 className="text-xl font-black tracking-wide uppercase text-red-500 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">Anweisungen</h2>
            </div>
            {anweisungen.map((e) => (
              <div
                key={e.id}
                className="relative w-full flex items-start gap-4 px-6 py-5 rounded-2xl bg-[#120808] border border-red-500/60 shadow-[0_0_26px_4px_rgba(239,68,68,0.48)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-500/8 pointer-events-none" />
                <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-[11px] font-black uppercase tracking-wider relative z-10">Anweisung</span>
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5 relative z-10" />
                <p className="font-extrabold text-2xl text-red-50 leading-snug tracking-wide relative z-10">{e.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* INFORMATIONEN – blue glow, full-width */}
        {infos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black tracking-wide uppercase text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]">Informationen</h2>
            </div>
            {infos.map((e) => (
              <div
                key={e.id}
                className="w-full flex items-start gap-4 px-6 py-5 rounded-2xl bg-[#0a0f1e]/90 backdrop-blur-md border border-blue-500/55 shadow-[0_0_26px_4px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-black uppercase tracking-wider">Info</span>
                <p className="text-2xl font-bold text-blue-50 leading-relaxed tracking-wide">{e.content}</p>
              </div>
            ))}
          </div>
        )}

        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Megaphone className="w-14 h-14 opacity-20" />
            <p className="text-xl font-semibold">Keine Anweisungen oder Informationen</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* EVENTS SLIDE                                     */
/* Shows event photos full-screen with slideshow    */
/* ------------------------------------------------ */

interface EventImage {
  id: number;
  filename: string;
  original_name?: string;
  url_path: string;
  created_at: string;
  is_visible?: boolean;
}

function EventsSlide({ images }: { images: EventImage[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  // Reset index when images list changes
  useEffect(() => { setCurrentIdx(0); }, [images.length]);

  // Auto-advance within events slide (every 10 s)
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setCurrentIdx(i => (i + 1) % images.length), 10_000);
    return () => clearInterval(id);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 text-muted-foreground">
        <Camera className="w-20 h-20 opacity-20" />
        <p className="text-2xl font-semibold">Keine Events vorhanden</p>
      </div>
    );
  }

  const idx = Math.min(currentIdx, images.length - 1);
  const img = images[idx];

  return (
    <div className="h-full relative flex items-center justify-center bg-black">
      <img
        key={img.id}
        src={img.url_path}
        alt={img.original_name ?? img.filename}
        className="max-h-full max-w-full object-contain animate-in fade-in duration-500"
      />
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                i === idx
                  ? "bg-cyan-400 scale-125 shadow-[0_0_6px_rgba(0,216,255,0.8)]"
                  : "bg-white/30 hover:bg-white/55"
              }`}
              aria-label={`Bild ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export function TvLayout({
  now,
  early = [],
  late = [],
  night = [],
}: TvLayoutProps) {

  /* State */
  const [currentSlide, setCurrentSlide] = useState(0);
  const [countdown, setCountdown] = useState(AUTO_ROTATE_MS / 1000);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaused = useRef(false);
  const slidesCountRef = useRef(1);

  const [infoEntries,   setInfoEntries]   = useState<DashboardInfoEntry[]>([]);
  const [allTickets,    setAllTickets]    = useState<any[]>([]);
  const [projects,      setProjects]      = useState<TvProject[]>([]);
  const [handoverCount, setHandoverCount] = useState(0);
  const [eventImages,   setEventImages]   = useState<EventImage[]>([]);

  /* Clock */
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Info Entries — public TV endpoint, no auth required */
  useEffect(() => {
    const load = () =>
      api.get("/tv/info-entries")
        .then(res => setInfoEntries(Array.isArray(res.data?.data) ? res.data.data : []))
        .catch(() => { });
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  /* Projects — public TV endpoint, no auth required */
  useEffect(() => {
    const load = () =>
      api.get("/tv/projects")
        .then(res => {
          const rows = Array.isArray(res.data) ? res.data : (res.data?.rows ?? []);
          setProjects(rows);
        })
        .catch(() => { });
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  /* Handover count – for empty-slide logic */
  useEffect(() => {
    const load = () =>
      fetch("/api/tv/handover")
        .then(r => r.ok ? r.json() : [])
        .then(data => setHandoverCount(Array.isArray(data) ? data.filter((h: any) => String(h.status ?? "").toLowerCase() !== "erledigt").length : 0))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  /* Event images – for empty-slide logic and EventsSlide */
  useEffect(() => {
    const load = () =>
      fetch("/api/tv/events/images")
        .then(r => r.ok ? r.json() : [])
        .then(data => setEventImages(Array.isArray(data) ? data : []))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  /* All Tickets – use public TV endpoints (no auth required) */
  useEffect(() => {
    const load = async () => {
      try {
        // /api/tv/tickets is public (no auth), /api/commit/latest requires auth –
        // fall back gracefully so TV works without login.
        const [tvTicketsRes, commitRes] = await Promise.all([
          fetch("/api/tv/tickets").then(r => r.ok ? r.json() : []).catch(() => []),
          api.get("/commit/latest").then(r => r.data).catch(() => []),
        ]);

        const tvRows: any[] = Array.isArray(tvTicketsRes) ? tvTicketsRes : [];
        let commitRows: any[] = [];
        if (Array.isArray(commitRes)) commitRows = commitRes;
        else if (Array.isArray(commitRes?.data)) commitRows = commitRes.data;
        else if (Array.isArray(commitRes?.rows)) commitRows = commitRes.rows;

        const map = new Map();
        tvRows.forEach(t => map.set(t.external_id || t.id, t));
        commitRows.forEach(t => map.set(t.external_id || t.ticketNumber || t.id, t));

        setAllTickets(Array.from(map.values()));
      } catch (e) {
        console.error("Failed to load TV tickets", e);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  /* Group tickets by owner */
  const ticketsByOwner = useMemo(() => {
    const map = new Map<string, any[]>();
    const allEmployees = [...early, ...late, ...night];
    const rawMap = new Map<string, any[]>();
    for (const t of allTickets) {
      const ownerRaw = (t?.owner ?? t?.Owner ?? "") as string;
      const ownerClean = String(ownerRaw).trim().replace(/[0-9]+$/, "").toUpperCase();
      if (!ownerClean) continue;
      const arr = rawMap.get(ownerClean) ?? [];
      arr.push(t);
      rawMap.set(ownerClean, arr);
    }
    for (const emp of allEmployees) {
      const parts = emp.name.split(" ");
      if (parts.length === 0) continue;
      const surname = parts[0].trim().replace(/[^a-zA-Z0-9-]/g, "");
      if (surname.length < 2) continue;
      const surnameUpper = surname.toUpperCase();
      const matches: any[] = [];
      for (const [ownerClean, tix] of rawMap.entries()) {
        if (ownerClean.endsWith(surnameUpper)) matches.push(...tix);
      }
      if (matches.length > 0) {
        matches.sort((a, b) => {
          const ah = getRemainingMs(a);
          const bh = getRemainingMs(b);
          if (ah === null && bh === null) return 0;
          if (ah === null) return 1;
          if (bh === null) return -1;
          return ah - bh;
        });
        map.set(emp.name, matches);
      }
    }
    return map;
  }, [allTickets, early, late, night]);

  /* goToSlide – uses slidesCountRef for stale-closure safety */
  const goToSlide = useCallback((idx: number, manual = false) => {
    const count = slidesCountRef.current;
    if (count === 0) return;
    setCurrentSlide(((idx % count) + count) % count);
    setCountdown(AUTO_ROTATE_MS / 1000);
    if (manual) {
      isPaused.current = true;
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => { isPaused.current = false; }, PAUSE_AFTER_MANUAL_MS);
    }
  }, []);

  /* Auto-rotate */
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (!isPaused.current) {
            setCurrentSlide(s => {
              const count = slidesCountRef.current;
              return count > 0 ? (s + 1) % count : 0;
            });
          }
          return AUTO_ROTATE_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  /* Next 72 Hours Tickets — all expiring OR terminiert, Trouble Tickets first */
  const next72hTickets = useMemo(() => {
    const nowMs = clock.getTime();
    const limitMs = nowMs + 72 * 3600 * 1000;

    // Filter 1: tickets with a due/termin date within 72h
    const terminiert = allTickets.filter(t => {
      const dStr = t.commit_date || t.dueDate || t.targetDate || t.termin || t.sched_start || t.Start_Date || t.EndDate;
      if (!dStr) return false;
      const dMs = new Date(dStr).getTime();
      if (isNaN(dMs)) return false;
      return dMs >= nowMs && dMs <= limitMs;
    });

    // Filter 2: tickets that "expire" (restzeit <= 72h from remaining ms)
    const expiring = allTickets.filter(t => {
      if (terminiert.includes(t)) return false; // already included
      const ms = getRemainingMs(t);
      if (ms === null) return false;
      return ms >= 0 && ms <= 72 * 3600 * 1000;
    });

    const combined = [...terminiert, ...expiring];

    const isTT = (t: any) => {
      const qt = String(t.queue_type ?? t.type ?? t.Type ?? t.queueType ?? "").toLowerCase();
      return qt.includes("tt") || qt.includes("trouble");
    };

    combined.sort((a, b) => {
      const aTT = isTT(a) ? 0 : 1;
      const bTT = isTT(b) ? 0 : 1;
      if (aTT !== bTT) return aTT - bTT;
      // then chronologically by due date or remaining
      const msA = getRemainingMs(a) ?? Infinity;
      const msB = getRemainingMs(b) ?? Infinity;
      return msA - msB;
    });

    return combined;
  }, [allTickets, clock]);

  /* Active slides — skip empty ones */
  const activeSlides = useMemo(() => {
    const activeProjects = projects.filter(p => String(p.status ?? "").toLowerCase() !== "completed");
    return ALL_SLIDES.filter(s => {
      if (s.id === "shifts")   return true;
      if (s.id === "info")     return infoEntries.length > 0;
      if (s.id === "72h")      return next72hTickets.length > 0;
      if (s.id === "handover") return handoverCount > 0;
      if (s.id === "projects") return activeProjects.length > 0;
      if (s.id === "events")   return eventImages.length > 0;
      return true;
    });
  }, [infoEntries, next72hTickets, handoverCount, projects, eventImages]);

  /* Keep ref in sync for stale-closure-safe auto-rotate */
  useEffect(() => { slidesCountRef.current = activeSlides.length; }, [activeSlides.length]);

  /* Clamp current index when active slides shrink */
  useEffect(() => {
    if (activeSlides.length > 0 && currentSlide >= activeSlides.length) {
      setCurrentSlide(0);
    }
  }, [activeSlides.length, currentSlide]);

  const currentSlideId = activeSlides[currentSlide]?.id ?? "shifts";

  return (
    <div className="tv-mode flex flex-col h-full min-h-0 bg-[#030711]">
      {/* SLIDE HEADER */}
      <SlideHeader now={clock} title={activeSlides[currentSlide]?.title ?? ""} icon={activeSlides[currentSlide]?.icon ?? Users} />

      {/* SLIDE CONTENT */}
      <div className="flex-1 min-h-0 overflow-hidden relative">

        {/* Schichten Heute */}
        {currentSlideId === "shifts" && (
          <div className="h-full overflow-auto p-4">
            <TvShiftplan early={early} late={late} night={night} ticketsByOwner={ticketsByOwner} />
          </div>
        )}

        {/* Informationen & Anweisungen */}
        {currentSlideId === "info" && (
          <InfoAnweisungenSlide entries={infoEntries} />
        )}

        {/* Nächste 72 Stunden */}
        {currentSlideId === "72h" && (
          <div className="h-full overflow-auto p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-w-full">
              {next72hTickets.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center text-muted-foreground py-20 gap-4">
                  <Clock className="w-16 h-16 opacity-20" />
                  <span className="text-2xl font-semibold">Keine anstehenden Tickets in den nächsten 72 Stunden</span>
                </div>
              )}
              {next72hTickets.map((t, i) => {
                const dStr = t.commit_date || t.dueDate || t.targetDate || t.termin || t.sched_start || t.Start_Date || t.EndDate;
                const dateObj = dStr ? new Date(dStr) : null;
                const dateFormatted = dateObj ? dateObj.toLocaleDateString("de-DE", { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
                const schedStart = t.sched_start || t.Start_Date;
                const schedFormatted = schedStart ? new Date(schedStart).toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
                const owner = String(t.owner ?? t.Owner ?? t.assignee ?? t.assignedTo ?? t.ticketOwner ?? "–").trim();
                const id = String(t.external_id ?? t.ticketNumber ?? t.id ?? "").trim();
                const activity = String(t.activityType ?? t.activity ?? t.title ?? t.subtype ?? "–").trim();
                const status = String(t.activityStatus ?? t.status ?? t.state ?? "").trim();
                const system = String(t.systemName ?? t.system_name ?? t.component_name ?? t.db_name ?? t.Area ?? "").trim();
                const ms = getRemainingMs(t);
                const rem = ms !== null ? formatRemainingTime(ms) : "";
                const tier = getColorTier(ms);
                const css = tierClasses[tier];
                const isTT = String(t.queue_type ?? t.type ?? t.Type ?? "").toLowerCase().includes("tt") || String(t.queue_type ?? t.type ?? t.Type ?? "").toLowerCase().includes("trouble");
                const msUntil = dateObj ? dateObj.getTime() - clock.getTime() : null;
                const isUrgent = msUntil !== null && msUntil < 24 * 3600 * 1000;

                const cardGlow = isTT ? 'border-red-500/50 bg-red-950/20 shadow-[0_0_20px_3px_rgba(239,68,68,0.18)]' : `${tierClasses[tier]} ${tierGlow[tier]}`;
                const pulseClass = (tier === "red" || isTT) ? "tv-red-pulse" : "";

                return (
                  <div key={`${id}-${i}`} className={`flex flex-col gap-1.5 px-4 py-3 rounded-xl border transition-all ${cardGlow} ${pulseClass}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{id}</span>
                      <div className="flex items-center gap-1.5">
                        {isTT && <span className="bg-red-500/20 text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/30 uppercase">TT</span>}
                        {rem && <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${css}`}>{rem}</span>}
                      </div>
                    </div>
                    <div className="font-semibold text-sm text-foreground/90 truncate">{activity}</div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      {system && <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={system}>{system}</span>}
                      {owner && owner !== "–" && <span>{owner}</span>}
                      {status && <span className="border border-border px-1 py-0.5 rounded">{status}</span>}
                      {schedStart && <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="w-2.5 h-2.5" />Start: {schedFormatted}</span>}
                      {dateFormatted && <span className={`font-bold px-1.5 py-0.5 rounded ${isUrgent ? 'text-orange-400' : 'text-blue-400'}`}>{dateFormatted}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Handover */}
        {currentSlideId === "handover" && (
          <div className="h-full overflow-auto p-4">
            <TVHandoverMirror />
          </div>
        )}

        {/* Projekte */}
        {currentSlideId === "projects" && <ProjekteSlide projects={projects} />}

        {/* Events */}
        {currentSlideId === "events" && <EventsSlide images={eventImages} />}
      </div>

      {/* SLIDE NAVIGATION */}
      <div className="shrink-0 flex flex-col border-t border-blue-500/20" style={{ background: "linear-gradient(90deg, rgba(5,10,28,1) 0%, rgba(10,18,48,1) 50%, rgba(5,10,28,1) 100%)" }}>
        {/* Progress bar */}
        <div className="h-0.5 bg-blue-900/40 w-full">
          <div
            className="h-full bg-cyan-400/70 transition-all duration-1000 shadow-[0_0_6px_rgba(0,216,255,0.6)]"
            style={{ width: `${((AUTO_ROTATE_MS / 1000 - countdown) / (AUTO_ROTATE_MS / 1000)) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-center gap-4 py-2.5">
          <button
            onClick={() => goToSlide(currentSlide - 1, true)}
            className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground"
            aria-label="Vorheriger Slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {activeSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i, true)}
              className={`w-4 h-4 rounded-full transition-all ${i === currentSlide ? "bg-cyan-400 scale-125 shadow-[0_0_8px_rgba(0,216,255,0.8)]" : "bg-white/20 hover:bg-white/40"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}

          <button
            onClick={() => goToSlide(currentSlide + 1, true)}
            className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground"
            aria-label="Nächster Slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <span className="text-sm text-muted-foreground tabular-nums ml-2">
            {isPaused.current ? `Pausiert – weiter in ${countdown}s` : `Weiter in ${countdown}s`}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ================================================ */
/* TV Assignment Hero Slide — Redesigned            */
/* "ODIN Decision Transparency" — 20-second showcase*/
/*                                                  */
/* Renders a backend-provided explanation trace      */
/* showing WHY a ticket was assigned to someone.     */
/* Zero business logic in this component.            */
/* ================================================ */

import { useEffect, useMemo, useState } from "react";
import {
  Scan,
  Tag,
  Signal,
  Users,
  Shield,
  Server,
  Scale,
  CheckCircle2,
  Clock,
  Zap,
  Briefcase,
  XCircle,
  Activity,
  Layers,
  ArrowRight,
  UserCheck,
  UserX,
  Target,
  TrendingUp,
  GitBranch,
} from "lucide-react";
import type {
  TvAssignmentTrace,
  TvCandidateEntry,
  TvDecisionStep,
} from "./tv.assignment.types";

/* ------------------------------------------------ */
/* CONSTANTS                                        */
/* ------------------------------------------------ */

const TOTAL_DURATION_S = 20;

const PHASE = {
  HEADER_IN:            0.2,
  TICKET_IN:            0.5,
  FLOW_START:           2.5,
  FLOW_STEP_INTERVAL:   0.55,
  STRATEGY_IN:          7.5,
  CANDIDATES_START:     8.5,
  CANDIDATES_STAGGER:   0.35,
  RESULT_START:         14,
  SETTLED:              18,
} as const;

const STEP_ICONS: Record<string, React.FC<any>> = {
  scan: Scan,
  tag: Tag,
  signal: Signal,
  users: Users,
  shield: Shield,
  server: Server,
  scale: Scale,
  check: CheckCircle2,
};

const STRATEGY_ICONS: Record<string, React.FC<any>> = {
  "system-grouping": Server,
  "queue-purity": Layers,
  workload: TrendingUp,
  "colleague-pref": Users,
  "worker-id": GitBranch,
};

/* ------------------------------------------------ */
/* PRIORITY STYLE                                   */
/* ------------------------------------------------ */

function getPriorityStyle(priorityLabel: string) {
  const p = (priorityLabel || "").toLowerCase();
  if (p.includes("high") || p.includes("critical"))
    return {
      border: "border-red-500/60",
      glow: "shadow-[0_0_24px_4px_rgba(239,68,68,0.3)]",
      badge: "bg-red-500/20 text-red-300 border-red-500/50",
      accent: "text-red-400",
      accentBg: "bg-red-500/10",
    };
  if (p.includes("medium"))
    return {
      border: "border-orange-500/50",
      glow: "shadow-[0_0_24px_4px_rgba(249,115,22,0.25)]",
      badge: "bg-orange-500/20 text-orange-300 border-orange-500/50",
      accent: "text-orange-400",
      accentBg: "bg-orange-500/10",
    };
  if (p.includes("smart"))
    return {
      border: "border-emerald-500/50",
      glow: "shadow-[0_0_24px_4px_rgba(16,185,129,0.2)]",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
      accent: "text-emerald-400",
      accentBg: "bg-emerald-500/10",
    };
  if (p.includes("cross") || p.includes("cc"))
    return {
      border: "border-cyan-500/50",
      glow: "shadow-[0_0_24px_4px_rgba(0,216,255,0.2)]",
      badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
      accent: "text-cyan-400",
      accentBg: "bg-cyan-500/10",
    };
  if (p.includes("sched"))
    return {
      border: "border-indigo-500/50",
      glow: "shadow-[0_0_24px_4px_rgba(99,102,241,0.2)]",
      badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/50",
      accent: "text-indigo-400",
      accentBg: "bg-indigo-500/10",
    };
  return {
    border: "border-blue-500/40",
    glow: "shadow-[0_0_20px_3px_rgba(59,130,246,0.15)]",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    accent: "text-blue-400",
    accentBg: "bg-blue-500/10",
  };
}

/* ------------------------------------------------ */
/* TOP HEADER BAR                                   */
/* ------------------------------------------------ */

function HeaderBar({
  trace,
  visible,
}: {
  trace: TvAssignmentTrace;
  visible: boolean;
}) {
  const decidedTime = new Date(trace.decidedAt).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className="flex items-center justify-between px-5 py-2.5 rounded-xl bg-[#070c1e]/80 border border-white/[0.06] backdrop-blur-sm"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-12px)",
        transition: "all 0.6s cubic-bezier(.22,.68,0,1.1)",
      }}
    >
      {/* Left: Mode badge + Title */}
      <div className="flex items-center gap-3">
        {trace.modeLabel && (
          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border ${
              trace.mode === "live"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                : trace.mode === "shadow"
                ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                : "bg-slate-500/15 text-slate-400 border-slate-500/40"
            }`}
          >
            {trace.modeLabel}
          </span>
        )}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-black uppercase tracking-[0.15em] text-slate-300">
            ODIN Entscheidungslogik
          </span>
        </div>
      </div>

      {/* Center: Ticket Pool */}
      {trace.ticketPoolSize != null && trace.ticketPoolSize > 0 && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">
            <span className="font-bold text-slate-300">{trace.ticketPoolSize}</span>{" "}
            Tickets im Pool
          </span>
        </div>
      )}

      {/* Right: Run info */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-500 tabular-nums">
          Run #{trace.runId}
        </span>
        <span className="text-xs text-slate-500 tabular-nums flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {decidedTime}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* TICKET CARD (Left Zone)                          */
/* ------------------------------------------------ */

function TicketCard({
  trace,
  visible,
}: {
  trace: TvAssignmentTrace;
  visible: boolean;
}) {
  const t = trace.ticket;
  const cls = trace.classification;
  const pStyle = getPriorityStyle(t.priorityLabel);

  return (
    <div
      className={`flex flex-col gap-3.5 p-5 rounded-2xl border backdrop-blur-md ${pStyle.border} ${pStyle.glow} bg-[#080d1f]/90`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0) scale(1)" : "translateX(-30px) scale(0.97)",
        transition: "all 0.8s cubic-bezier(.22,.68,0,1.1)",
      }}
    >
      {/* Type + Priority row */}
      <div className="flex items-center gap-2.5">
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${pStyle.badge}`}
        >
          {t.typeCode}
        </span>
        <span className={`text-base font-bold ${pStyle.accent}`}>
          {t.priorityLabel}
        </span>
        {cls.expedite && (
          <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
        )}
      </div>

      {/* Ticket ID */}
      <div>
        <p className="text-xl font-black text-slate-100 tracking-wide leading-tight">
          {t.externalId || t.id}
        </p>
        {t.activity && t.activity !== t.externalId && (
          <p className="text-sm text-slate-400 mt-0.5 font-medium truncate">
            {t.activity}
          </p>
        )}
      </div>

      {/* System Name */}
      {t.systemName && (
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-base font-semibold text-slate-200 truncate">
            {t.systemName}
          </span>
        </div>
      )}

      {/* Rest Time */}
      {t.restTime && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${pStyle.accentBg} border ${pStyle.border}`}>
          <Clock className={`w-4 h-4 ${pStyle.accent}`} />
          <span className={`text-lg font-black tabular-nums ${pStyle.accent}`}>
            {t.restTime}
          </span>
          <span className="text-xs text-slate-500">verbleibend</span>
        </div>
      )}

      {/* Sched Start */}
      {t.schedStart && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Geplant:{" "}
            {new Date(t.schedStart).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {/* Classification Tags */}
      <div className="flex flex-wrap gap-1.5">
        {cls.scheduled && (
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase">
            Scheduled
          </span>
        )}
        {cls.clusterCandidate && (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase">
            Cluster
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* DECISION PIPELINE (Middle Zone)                  */
/* ------------------------------------------------ */

function PipelineStep({
  step,
  active,
  completed,
}: {
  step: TvDecisionStep;
  active: boolean;
  completed: boolean;
}) {
  const Icon = STEP_ICONS[step.icon] || CheckCircle2;
  const isDone = step.status === "done";

  return (
    <div
      className="flex items-center gap-2.5 transition-all duration-700"
      style={{
        opacity: completed ? 1 : active ? 1 : 0.12,
        transform: active
          ? "translateY(0) scale(1)"
          : completed
          ? "translateY(0) scale(1)"
          : "translateY(6px) scale(0.97)",
        transition: "opacity 0.5s ease-out, transform 0.4s ease-out",
      }}
    >
      {/* Indicator */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
          active
            ? "bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_14px_3px_rgba(0,216,255,0.35)]"
            : completed && isDone
            ? "bg-emerald-500/15 border border-emerald-500/40"
            : "bg-white/[0.03] border border-white/[0.08]"
        }`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${
            active
              ? "text-cyan-300"
              : completed && isDone
              ? "text-emerald-400"
              : "text-slate-700"
          }`}
        />
      </div>

      {/* Label + reason */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-bold leading-tight ${
            active ? "text-cyan-200" : completed ? "text-slate-300" : "text-slate-600"
          }`}
        >
          {step.label}
        </p>
        {step.reason && (completed || active) && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {step.reason}
          </p>
        )}
      </div>

      {/* Status */}
      {completed && isDone && (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      )}
    </div>
  );
}

function DecisionPipeline({
  steps,
  elapsedS,
}: {
  steps: TvDecisionStep[];
  elapsedS: number;
}) {
  const activeIndex = useMemo(() => {
    if (elapsedS < PHASE.FLOW_START) return -1;
    const elapsed = elapsedS - PHASE.FLOW_START;
    const idx = Math.floor(elapsed / PHASE.FLOW_STEP_INTERVAL);
    return Math.min(idx, steps.length - 1);
  }, [elapsedS, steps.length]);

  return (
    <div className="flex flex-col gap-1.5">
      <h3
        className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 mb-1 flex items-center gap-2"
        style={{
          opacity: elapsedS >= PHASE.FLOW_START ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        <Target className="w-3 h-3" />
        Entscheidungs-Pipeline
      </h3>

      <div className="relative">
        {/* Track line */}
        <div
          className="absolute left-[15px] top-0 bottom-0 w-px bg-white/[0.04]"
          style={{ zIndex: 0 }}
        />
        {/* Animated progress */}
        <div
          className="absolute left-[15px] top-0 w-px bg-gradient-to-b from-cyan-400/60 to-cyan-400/0"
          style={{
            height:
              activeIndex >= 0
                ? `${Math.min(100, ((activeIndex + 1) / steps.length) * 100)}%`
                : "0%",
            transition: "height 0.5s cubic-bezier(.22,.68,0,1.1)",
            zIndex: 1,
            boxShadow: "0 0 6px rgba(0,216,255,0.4)",
          }}
        />

        <div className="flex flex-col gap-1.5 relative z-10">
          {steps.map((step, i) => (
            <PipelineStep
              key={step.key}
              step={step}
              active={i === activeIndex}
              completed={i < activeIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* STRATEGY DISPLAY                                 */
/* ------------------------------------------------ */

function StrategySection({
  trace,
  visible,
}: {
  trace: TvAssignmentTrace;
  visible: boolean;
}) {
  const strategy = trace.strategy;
  if (!strategy) return null;

  return (
    <div
      className="mt-3 p-3 rounded-xl bg-[#070c1e]/60 border border-white/[0.05]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.6s ease-out",
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2 flex items-center gap-1.5">
        <GitBranch className="w-3 h-3" />
        Selektionsstrategie
      </p>
      <div className="flex flex-col gap-1">
        {strategy.steps.map((s) => {
          const Icon = STRATEGY_ICONS[s.key] || ArrowRight;
          return (
            <div
              key={s.key}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                s.active
                  ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                  : "text-slate-600"
              }`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{s.label}</span>
              {s.active && (
                <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0 ml-auto" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* CANDIDATE STATS BAR                              */
/* ------------------------------------------------ */

function CandidateStatsBar({
  trace,
  visible,
}: {
  trace: TvAssignmentTrace;
  visible: boolean;
}) {
  const stats = trace.candidateStats;
  if (!stats) return null;

  const eligiblePct = stats.total > 0 ? Math.round((stats.eligible / stats.total) * 100) : 0;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#070c1e]/60 border border-white/[0.05]"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-bold text-slate-300">{stats.total}</span>
        <span className="text-[10px] text-slate-500">geprüft</span>
      </div>
      <div className="h-3 w-px bg-white/[0.08]" />
      <div className="flex items-center gap-1.5">
        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-bold text-emerald-400">{stats.eligible}</span>
        <span className="text-[10px] text-slate-500">qualifiziert</span>
      </div>
      <div className="h-3 w-px bg-white/[0.08]" />
      <div className="flex items-center gap-1.5">
        <UserX className="w-3.5 h-3.5 text-red-400/60" />
        <span className="text-xs font-bold text-red-400/70">{stats.excluded}</span>
        <span className="text-[10px] text-slate-500">ausgeschlossen</span>
      </div>
      {/* Mini bar */}
      <div className="flex-1 flex items-center gap-1.5 ml-1">
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            style={{ width: `${eligiblePct}%`, transition: "width 0.8s ease" }}
          />
        </div>
        <span className="text-[10px] font-bold text-slate-500 tabular-nums">{eligiblePct}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* CANDIDATE CARD                                   */
/* ------------------------------------------------ */

function CandidateCard({
  candidate,
  visible,
  isSelected,
  showResult,
}: {
  candidate: TvCandidateEntry;
  visible: boolean;
  isSelected: boolean;
  showResult: boolean;
}) {
  const isExcluded = candidate.state === "excluded";

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-600 ${
        isSelected && showResult
          ? "bg-cyan-500/10 border-cyan-400/50 shadow-[0_0_20px_3px_rgba(0,216,255,0.25)]"
          : isExcluded
          ? "bg-white/[0.01] border-white/[0.04] opacity-35"
          : "bg-[#0a0f1e]/50 border-blue-500/10"
      }`}
      style={{
        opacity: visible ? (isExcluded ? 0.35 : 1) : 0,
        transform: visible ? "translateX(0)" : "translateX(16px)",
        transition: "opacity 0.4s ease-out, transform 0.4s ease-out, box-shadow 0.5s ease, border-color 0.5s ease",
      }}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          isSelected && showResult
            ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/40"
            : isExcluded
            ? "bg-white/[0.03] text-slate-700 border border-white/[0.04]"
            : "bg-blue-500/10 text-blue-300 border border-blue-500/15"
        }`}
      >
        {(candidate.employeeName || "?")[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-bold truncate ${
            isSelected && showResult
              ? "text-cyan-100"
              : isExcluded
              ? "text-slate-600"
              : "text-slate-300"
          }`}
        >
          {candidate.employeeName}
        </p>
        <p
          className={`text-[10px] truncate ${
            isExcluded ? "text-red-400/40" : "text-slate-500"
          }`}
        >
          {candidate.reason}
        </p>
      </div>

      {/* Meta */}
      <div className="shrink-0 flex items-center gap-1">
        {candidate.shiftLabel && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/[0.04] text-slate-500 border border-white/[0.04]">
            {candidate.shiftLabel}
          </span>
        )}
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums ${
            isExcluded
              ? "bg-white/[0.02] text-slate-700"
              : "bg-blue-500/10 text-blue-400 border border-blue-500/10"
          }`}
        >
          {candidate.currentLoad}
        </span>
        {isExcluded && (
          <XCircle className="w-3 h-3 text-red-500/40 shrink-0" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* FINAL RESULT CARD                                */
/* ------------------------------------------------ */

function FinalResultCard({
  trace,
  visible,
}: {
  trace: TvAssignmentTrace;
  visible: boolean;
}) {
  const s = trace.selectedCandidate;

  return (
    <div
      className="relative p-4 rounded-2xl border border-cyan-400/40 bg-[#061020]/90 backdrop-blur-md overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
        transition: "all 0.8s cubic-bezier(.22,.68,0,1.2)",
        boxShadow: visible
          ? "0 0 32px 6px rgba(0,216,255,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "none",
      }}
    >
      {/* Top glow */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: visible
            ? "linear-gradient(90deg, transparent, rgba(0,216,255,0.5), transparent)"
            : "transparent",
          transition: "background 0.8s ease",
        }}
      />

      <div className="flex items-center gap-2 mb-2.5">
        <CheckCircle2
          className="w-4 h-4 text-cyan-400"
          style={{
            filter: visible ? "drop-shadow(0 0 5px rgba(0,216,255,0.5))" : "none",
          }}
        />
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400/80">
          Zugewiesen
        </span>
      </div>

      {/* Name */}
      <p
        className="text-xl font-black text-white leading-tight mb-2"
        style={{
          textShadow: visible ? "0 0 16px rgba(0,216,255,0.25)" : "none",
        }}
      >
        {s.employeeName}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-2.5 mb-3">
        {s.shiftLabel && (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-300 text-[10px] font-bold">
            {s.shiftLabel}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Briefcase className="w-3 h-3" />
          {s.currentLoad} Tickets
        </span>
      </div>

      {/* Reasons */}
      <div className="space-y-1">
        {trace.finalReasons.map((reason, i) => (
          <div
            key={i}
            className="flex items-start gap-1.5 text-xs"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(8px)",
              transition: `opacity 0.3s ease ${0.15 + i * 0.12}s, transform 0.3s ease ${0.15 + i * 0.12}s`,
            }}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-slate-300">{reason}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-2"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s ease 0.6s",
        }}
      >
        <span
          className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-500/50"
          style={{ textShadow: "0 0 6px rgba(0,216,255,0.15)" }}
        >
          Assigned by ODIN Logic
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* MAIN EXPORT                                      */
/* ------------------------------------------------ */

export function TVAssignmentHeroSlide({
  trace,
}: {
  trace: TvAssignmentTrace;
}) {
  const [elapsedS, setElapsedS] = useState(0);

  useEffect(() => {
    setElapsedS(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const s = (Date.now() - start) / 1000;
      setElapsedS(s);
      if (s >= TOTAL_DURATION_S) clearInterval(timer);
    }, 80);
    return () => clearInterval(timer);
  }, [trace]);

  /* Phase booleans */
  const headerVisible = elapsedS >= PHASE.HEADER_IN;
  const ticketVisible = elapsedS >= PHASE.TICKET_IN;
  const strategyVisible = elapsedS >= PHASE.STRATEGY_IN;
  const candidatesPhase = elapsedS >= PHASE.CANDIDATES_START;
  const resultPhase = elapsedS >= PHASE.RESULT_START;
  const settled = elapsedS >= PHASE.SETTLED;

  /* Sorted candidates: selected > eligible > checked > excluded */
  const sortedCandidates = useMemo(() => {
    const pool = [...trace.candidatePool];
    pool.sort((a, b) => {
      const order: Record<string, number> = {
        selected: 0,
        eligible: 1,
        checked: 2,
        excluded: 3,
      };
      return (order[a.state] ?? 2) - (order[b.state] ?? 2);
    });
    return pool;
  }, [trace.candidatePool]);

  const visibleCandidateCount = candidatesPhase
    ? Math.min(
        sortedCandidates.length,
        Math.floor(
          (elapsedS - PHASE.CANDIDATES_START) / PHASE.CANDIDATES_STAGGER
        ) + 1
      )
    : 0;

  return (
    <div className="h-full w-full flex flex-col p-4 gap-3 relative overflow-hidden">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,216,255,0.02) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Header Bar */}
      <div className="shrink-0 relative z-10">
        <HeaderBar trace={trace} visible={headerVisible} />
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 min-h-0 flex gap-4 relative z-10">
        {/* LEFT: Ticket Card */}
        <div className="w-[28%] shrink-0 flex flex-col justify-center">
          <TicketCard trace={trace} visible={ticketVisible} />
        </div>

        {/* MIDDLE: Decision Pipeline + Strategy */}
        <div className="w-[30%] shrink-0 flex flex-col justify-center overflow-y-auto pr-1">
          <DecisionPipeline steps={trace.decisionSteps} elapsedS={elapsedS} />
          <StrategySection trace={trace} visible={strategyVisible} />
        </div>

        {/* RIGHT: Candidates + Result */}
        <div className="flex-1 flex flex-col gap-2.5 justify-center overflow-y-auto">
          {/* Candidate Stats */}
          <CandidateStatsBar trace={trace} visible={candidatesPhase} />

          {/* Candidate List */}
          <div className="space-y-1.5 max-h-[48%] overflow-y-auto pr-1 scrollbar-thin">
            <h3
              className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 flex items-center gap-1.5"
              style={{
                opacity: candidatesPhase ? 1 : 0,
                transition: "opacity 0.4s ease",
              }}
            >
              <Users className="w-3 h-3" />
              Kandidaten ({sortedCandidates.length})
            </h3>
            {sortedCandidates.map((c, i) => (
              <CandidateCard
                key={c.employeeId}
                candidate={c}
                visible={i < visibleCandidateCount}
                isSelected={
                  c.employeeId === trace.selectedCandidate.employeeId
                }
                showResult={resultPhase}
              />
            ))}
          </div>

          {/* Final Result */}
          <FinalResultCard trace={trace} visible={resultPhase} />
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="shrink-0 flex items-center justify-center gap-3 py-1.5"
        style={{
          opacity: settled ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent" />
        <span
          className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-500/40"
          style={{ textShadow: "0 0 10px rgba(0,216,255,0.15)" }}
        >
          Regelbasierte Zuweisung · Entscheidung abgeschlossen
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent" />
      </div>
    </div>
  );
}

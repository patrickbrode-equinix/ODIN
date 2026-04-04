/* ------------------------------------------------ */
/* TV Assignment Hero Slide                         */
/* "Assignment Decision Flow" — 20-second showcase  */
/*                                                  */
/* Renders a backend-provided explanation trace.    */
/* Zero business logic in this component.           */
/* ------------------------------------------------ */

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
  AlertTriangle,
  Zap,
  User,
  Briefcase,
} from "lucide-react";
import type {
  TvAssignmentTrace,
  TvCandidateEntry,
  TvDecisionStep,
} from "./tv.assignment.types";

/* ------------------------------------------------ */
/* CONSTANTS                                        */
/* ------------------------------------------------ */

/** Total slide duration – animation phases keyed to this */
const TOTAL_DURATION_S = 20;

/** Phase timings (seconds from slide start) */
const PHASE = {
  TICKET_IN: 0.3,
  FLOW_START: 3,
  FLOW_STEP_INTERVAL: 0.6,
  CANDIDATES_START: 8,
  CANDIDATES_STAGGER: 0.4,
  RESULT_START: 14,
  SETTLED: 18,
} as const;

/** Map step icon keys to Lucide components */
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

/* ------------------------------------------------ */
/* PRIORITY COLOR MAP                               */
/* ------------------------------------------------ */

function getPriorityStyle(priorityLabel: string) {
  const p = (priorityLabel || "").toLowerCase();
  if (p.includes("high") || p.includes("critical"))
    return {
      border: "border-red-500/60",
      glow: "shadow-[0_0_30px_6px_rgba(239,68,68,0.35)]",
      badge: "bg-red-500/20 text-red-300 border-red-500/50",
      accent: "text-red-400",
      glowColor: "rgba(239,68,68,0.4)",
    };
  if (p.includes("medium"))
    return {
      border: "border-orange-500/50",
      glow: "shadow-[0_0_30px_6px_rgba(249,115,22,0.3)]",
      badge: "bg-orange-500/20 text-orange-300 border-orange-500/50",
      accent: "text-orange-400",
      glowColor: "rgba(249,115,22,0.35)",
    };
  if (p.includes("smart"))
    return {
      border: "border-emerald-500/50",
      glow: "shadow-[0_0_30px_6px_rgba(16,185,129,0.25)]",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
      accent: "text-emerald-400",
      glowColor: "rgba(16,185,129,0.3)",
    };
  if (p.includes("cross") || p.includes("cc"))
    return {
      border: "border-cyan-500/50",
      glow: "shadow-[0_0_30px_6px_rgba(0,216,255,0.25)]",
      badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
      accent: "text-cyan-400",
      glowColor: "rgba(0,216,255,0.3)",
    };
  if (p.includes("sched"))
    return {
      border: "border-indigo-500/50",
      glow: "shadow-[0_0_30px_6px_rgba(99,102,241,0.25)]",
      badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/50",
      accent: "text-indigo-400",
      glowColor: "rgba(99,102,241,0.3)",
    };
  // Default: blue
  return {
    border: "border-blue-500/40",
    glow: "shadow-[0_0_24px_4px_rgba(59,130,246,0.2)]",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    accent: "text-blue-400",
    glowColor: "rgba(59,130,246,0.25)",
  };
}

/* ------------------------------------------------ */
/* HERO TICKET CARD (Left Zone)                     */
/* ------------------------------------------------ */

function HeroTicketCard({
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
      className={`flex flex-col gap-4 p-6 rounded-2xl border backdrop-blur-md transition-all duration-1000 ${pStyle.border} ${pStyle.glow} bg-[#0a0e1f]/90`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0) scale(1)" : "translateX(-40px) scale(0.96)",
        transition: "opacity 0.8s cubic-bezier(.22,.68,0,1.1), transform 0.8s cubic-bezier(.22,.68,0,1.1)",
      }}
    >
      {/* Type Badge */}
      <div className="flex items-center gap-3">
        <span
          className={`px-3 py-1.5 rounded-lg text-sm font-black uppercase tracking-wider border ${pStyle.badge}`}
        >
          {t.typeCode}
        </span>
        <span className={`text-lg font-bold ${pStyle.accent}`}>
          {t.priorityLabel}
        </span>
        {cls.expedite && (
          <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
        )}
      </div>

      {/* Ticket ID / Activity */}
      <div>
        <p className="text-2xl font-black text-slate-100 tracking-wide leading-tight">
          {t.externalId || t.id}
        </p>
        {t.activity && t.activity !== t.externalId && (
          <p className="text-base text-slate-400 mt-1 font-medium">
            {t.activity}
          </p>
        )}
      </div>

      {/* System Name – full, large */}
      {t.systemName && (
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-lg font-semibold text-slate-200 break-words">
            {t.systemName}
          </span>
        </div>
      )}

      {/* Rest Time */}
      {t.restTime && (
        <div className="flex items-center gap-2">
          <Clock className={`w-5 h-5 ${pStyle.accent}`} />
          <span className={`text-xl font-black tabular-nums ${pStyle.accent}`}>
            {t.restTime}
          </span>
          <span className="text-sm text-slate-500">verbleibend</span>
        </div>
      )}

      {/* Sched Start */}
      {t.schedStart && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="w-4 h-4" />
          <span>
            Sched. Start:{" "}
            {new Date(t.schedStart).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {/* Classification Badges */}
      <div className="flex flex-wrap gap-2 mt-1">
        {cls.scheduled && (
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase">
            Scheduled
          </span>
        )}
        {cls.clusterCandidate && (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase">
            Cluster
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* DECISION FLOW (Middle Zone)                      */
/* ------------------------------------------------ */

function DecisionFlowStep({
  step,
  index,
  active,
  completed,
}: {
  step: TvDecisionStep;
  index: number;
  active: boolean;
  completed: boolean;
}) {
  const Icon = STEP_ICONS[step.icon] || CheckCircle2;
  const isDone = step.status === "done";

  return (
    <div
      className="flex items-center gap-3 transition-all duration-700"
      style={{
        opacity: completed ? 1 : active ? 1 : 0.15,
        transform: active
          ? "translateY(0) scale(1)"
          : completed
          ? "translateY(0) scale(1)"
          : "translateY(8px) scale(0.97)",
        transition: "opacity 0.6s ease-out, transform 0.5s ease-out",
      }}
    >
      {/* Step indicator */}
      <div
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
          active
            ? "bg-cyan-500/25 border-2 border-cyan-400 shadow-[0_0_16px_3px_rgba(0,216,255,0.4)]"
            : completed && isDone
            ? "bg-emerald-500/20 border border-emerald-500/50"
            : "bg-white/5 border border-white/10"
        }`}
      >
        <Icon
          className={`w-4 h-4 ${
            active
              ? "text-cyan-300"
              : completed && isDone
              ? "text-emerald-400"
              : "text-slate-600"
          }`}
        />
      </div>

      {/* Label + reason */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-base font-bold leading-tight ${
            active
              ? "text-cyan-200"
              : completed
              ? "text-slate-300"
              : "text-slate-600"
          }`}
        >
          {step.label}
        </p>
        {step.reason && (completed || active) && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {step.reason}
          </p>
        )}
      </div>

      {/* Status dot */}
      {completed && isDone && (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      )}
    </div>
  );
}

function DecisionFlow({
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
    <div className="flex flex-col gap-2.5">
      <h3
        className="text-sm font-black uppercase tracking-widest text-slate-500 mb-1"
        style={{
          opacity: elapsedS >= PHASE.FLOW_START ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        Decision Flow
      </h3>

      {/* Connecting line */}
      <div className="relative">
        {/* Vertical track */}
        <div
          className="absolute left-[17px] top-0 bottom-0 w-px bg-white/5"
          style={{ zIndex: 0 }}
        />
        {/* Animated progress line */}
        <div
          className="absolute left-[17px] top-0 w-px bg-gradient-to-b from-cyan-400/70 to-cyan-400/0"
          style={{
            height:
              activeIndex >= 0
                ? `${Math.min(100, ((activeIndex + 1) / steps.length) * 100)}%`
                : "0%",
            transition: "height 0.6s cubic-bezier(.22,.68,0,1.1)",
            zIndex: 1,
            boxShadow: "0 0 8px rgba(0,216,255,0.5)",
          }}
        />

        <div className="flex flex-col gap-2.5 relative z-10">
          {steps.map((step, i) => (
            <DecisionFlowStep
              key={step.key}
              step={step}
              index={i}
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
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-700 ${
        isSelected && showResult
          ? "bg-cyan-500/10 border-cyan-400/60 shadow-[0_0_24px_4px_rgba(0,216,255,0.3)]"
          : isExcluded
          ? "bg-white/[0.02] border-white/[0.06] opacity-40"
          : "bg-[#0a0f1e]/60 border-blue-500/15"
      }`}
      style={{
        opacity: visible ? (isExcluded ? 0.4 : 1) : 0,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        transition:
          "opacity 0.5s ease-out, transform 0.5s ease-out, box-shadow 0.6s ease, border-color 0.6s ease",
      }}
    >
      {/* Avatar circle */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isSelected && showResult
            ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/50"
            : isExcluded
            ? "bg-white/5 text-slate-600 border border-white/5"
            : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
        }`}
      >
        {(candidate.employeeName || "?")[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-bold truncate ${
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
          className={`text-xs truncate ${
            isExcluded ? "text-slate-700" : "text-slate-500"
          }`}
        >
          {candidate.reason}
        </p>
      </div>

      {/* Load indicator */}
      <div className="shrink-0 flex items-center gap-1">
        {candidate.shiftLabel && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-500 border border-white/5">
            {candidate.shiftLabel}
          </span>
        )}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
            isExcluded
              ? "bg-white/[0.03] text-slate-700"
              : "bg-blue-500/10 text-blue-400 border border-blue-500/15"
          }`}
        >
          {candidate.currentLoad}
        </span>
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
      className="relative p-5 rounded-2xl border border-cyan-400/50 bg-[#061020]/90 backdrop-blur-md overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.96)",
        transition:
          "opacity 0.8s cubic-bezier(.22,.68,0,1.2), transform 0.8s cubic-bezier(.22,.68,0,1.2)",
        boxShadow: visible
          ? "0 0 40px 8px rgba(0,216,255,0.25), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "none",
      }}
    >
      {/* Subtle top glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: visible
            ? "linear-gradient(90deg, transparent, rgba(0,216,255,0.6), transparent)"
            : "transparent",
          transition: "background 1s ease",
        }}
      />

      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2
          className="w-5 h-5 text-cyan-400"
          style={{
            filter: visible ? "drop-shadow(0 0 6px rgba(0,216,255,0.6))" : "none",
          }}
        />
        <span className="text-xs font-black uppercase tracking-widest text-cyan-400/80">
          Zugewiesen
        </span>
      </div>

      {/* Name */}
      <p
        className="text-2xl font-black text-white leading-tight mb-2"
        style={{
          textShadow: visible
            ? "0 0 20px rgba(0,216,255,0.3)"
            : "none",
        }}
      >
        {s.employeeName}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-4">
        {s.shiftLabel && (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold">
            {s.shiftLabel}
          </span>
        )}
        <span className="flex items-center gap-1 text-sm text-slate-400">
          <Briefcase className="w-3.5 h-3.5" />
          {s.currentLoad} Tickets
        </span>
      </div>

      {/* Final Reasons */}
      <div className="space-y-1.5">
        {trace.finalReasons.map((reason, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-sm"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(10px)",
              transition: `opacity 0.4s ease ${0.2 + i * 0.15}s, transform 0.4s ease ${0.2 + i * 0.15}s`,
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-slate-300">{reason}</span>
          </div>
        ))}
      </div>

      {/* Footer stamp */}
      <div
        className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.6s ease 0.8s",
        }}
      >
        <span
          className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-500/60"
          style={{
            textShadow: "0 0 8px rgba(0,216,255,0.2)",
          }}
        >
          Assigned by ODIN Logic
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* CONNECTING LINE (Ticket → Flow → Result)         */
/* ------------------------------------------------ */

function ConnectingLine({ visible }: { visible: boolean }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, opacity: visible ? 0.5 : 0, transition: "opacity 1s ease" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,216,255,0.5)" />
          <stop offset="50%" stopColor="rgba(59,130,246,0.3)" />
          <stop offset="100%" stopColor="rgba(0,216,255,0.5)" />
        </linearGradient>
      </defs>
      <line
        x1="0%"
        y1="50%"
        x2="100%"
        y2="50%"
        stroke="url(#lineGrad)"
        strokeWidth="1"
        strokeDasharray="8 4"
        style={{
          filter: "drop-shadow(0 0 4px rgba(0,216,255,0.4))",
        }}
      />
    </svg>
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
  /* Elapsed time counter for animation phasing */
  const [elapsedS, setElapsedS] = useState(0);

  useEffect(() => {
    setElapsedS(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const s = (Date.now() - start) / 1000;
      setElapsedS(s);
      if (s >= TOTAL_DURATION_S) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [trace]);

  /* Phase booleans */
  const ticketVisible = elapsedS >= PHASE.TICKET_IN;
  const candidatesPhase = elapsedS >= PHASE.CANDIDATES_START;
  const resultPhase = elapsedS >= PHASE.RESULT_START;
  const settled = elapsedS >= PHASE.SETTLED;

  /* Sort candidates: selected at top, eligible, then excluded */
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
    <div className="h-full w-full flex flex-col p-6 gap-4 relative overflow-hidden">
      {/* Background subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,216,255,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Connecting line behind content */}
      <ConnectingLine visible={resultPhase} />

      {/* Main 3-column layout */}
      <div className="flex-1 min-h-0 flex gap-5 relative z-10">
        {/* LEFT: Hero Ticket Card */}
        <div className="w-[28%] shrink-0 flex flex-col justify-center">
          <HeroTicketCard trace={trace} visible={ticketVisible} />
        </div>

        {/* MIDDLE: Decision Flow */}
        <div className="w-[30%] shrink-0 flex flex-col justify-center overflow-y-auto pr-2">
          <DecisionFlow steps={trace.decisionSteps} elapsedS={elapsedS} />
        </div>

        {/* RIGHT: Candidates + Final Result */}
        <div className="flex-1 flex flex-col gap-4 justify-center overflow-y-auto">
          {/* Candidate Cards */}
          <div className="space-y-2 max-h-[50%] overflow-y-auto pr-1">
            <h3
              className="text-sm font-black uppercase tracking-widest text-slate-500 mb-1"
              style={{
                opacity: candidatesPhase ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
            >
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

          {/* Final Result Card */}
          <FinalResultCard trace={trace} visible={resultPhase} />
        </div>
      </div>

      {/* Bottom settled stamp */}
      <div
        className="shrink-0 flex items-center justify-center gap-3 py-2"
        style={{
          opacity: settled ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        <span
          className="text-xs font-black uppercase tracking-[0.2em] text-cyan-500/50"
          style={{ textShadow: "0 0 12px rgba(0,216,255,0.2)" }}
        >
          Rule-based Assignment · Decision completed
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      </div>
    </div>
  );
}

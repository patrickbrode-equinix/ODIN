/* ------------------------------------------------ */
/* SHIFTPLAN TABLE                                  */
/* ------------------------------------------------ */

import { useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { shiftTypes } from "../../store/shiftStore";
import { EmployeeYearlyStats } from "./EmployeeYearlyChart"; // [NEW]
import type { HolidayMap } from "../../utils/deHolidays";
import type { UnderstaffWarning } from "./shiftplan.warnings";
import { EmployeeMonthlyStats } from "./shiftplan.hours"; // [NEW]
import { WellbeingConfig, WellbeingMetric } from "../../api/wellbeing"; // [NEW]
import { ShiftViolation, ViolationType } from "../../api/shiftValidation"; // [NEW]

// [NEW] Imports
import { EmployeeSkills, CoverageViolation } from "../../api/coverage";
import { StaffingResult } from "../../api/staffing";
import { Absence, AbsenceConflict } from "../../api/absences";
import { EmployeeConstraints, ConstraintViolation } from "../../api/constraints";
import { Badge } from "../ui/badge";
import { AlertTriangle, Moon, Sun, CalendarX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { RamadanMeta, SunTime } from "../../api/ramadan"; // [NEW]
import { useCommitStore } from "../../store/commitStore";
import * as ContextMenu from "@radix-ui/react-context-menu";

interface ShiftplanTableProps {
  schedule: Record<string, Record<number, string>>;
  daysInMonth: number;
  loading?: boolean;

  year: number;
  monthIndex1: number; // 1..12

  holidays: HolidayMap;
  warnings: UnderstaffWarning[];

  isEditMode?: boolean;
  selectedCells: Set<string>;
  onCellClick: (employeeName: string, day: number, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void;
  onHideEmployee: (name: string) => void;
  onCellContextMenu: (e: React.MouseEvent, args: { employeeName: string; day: number; current: string }) => void;

  // 2027
  employeeHours?: Map<string, EmployeeMonthlyStats>; // Type mismatch fixed below? No, it was EmployeeMonthlyStats in import?
  highlightRequest?: number;
  wellbeingMetrics?: WellbeingMetric[];
  wellbeingConfig?: WellbeingConfig | null;
  violations?: ShiftViolation[];
  // Coverage
  showSkillsOverlay?: boolean;
  employeeSkills?: Map<string, EmployeeSkills>;
  coverageViolations?: CoverageViolation[];
  // Staffing
  staffingResults?: StaffingResult[];
  // Absences
  absences?: Absence[];
  absenceConflicts?: AbsenceConflict[];
  // Constraints
  constraintsMap?: Record<string, EmployeeConstraints>;
  constraintViolations?: ConstraintViolation[];

  // Ramadan
  showRamadanOverlay?: boolean;
  showSunTimesHints?: boolean;
  ramadanMeta?: RamadanMeta | null;
  ramadanTimings?: SunTime[];
}


function cellKey(employeeName: string, day: number) {
  return `${employeeName}|||${day}`;
}

// [NEW] ShiftBadge Component
function ShiftBadge({ code, hasWarning }: { code: string; hasWarning?: boolean }) {
  let colorClass = "bg-white/5 text-muted-foreground border-white/10";

  const c = code.toUpperCase();
  if (c.startsWith("E")) colorClass = "bg-orange-500/15 text-orange-400 border-orange-500/20";
  else if (c.startsWith("L")) colorClass = "bg-yellow-500/15 text-yellow-500 border-yellow-500/20";
  else if (c === "N") colorClass = "bg-blue-500/15 text-blue-400 border-blue-500/20";
  else if (c === "FS") colorClass = "bg-teal-500/15 text-teal-400 border-teal-500/20";
  else if (c === "DBS") colorClass = "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20";
  else if (c === "S" || c === "ABW" || c === "SEMINAR") colorClass = "bg-purple-500/15 text-purple-400 border-purple-500/20";

  return (
    <div className={`inline-flex items-center justify-center min-w-[32px] h-[22px] px-2 text-[11px] font-bold rounded-md border ${colorClass} ${hasWarning ? "ring-2 ring-red-500/50 shadow-md" : ""}`}>
      {code}
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoWeek(date: Date) {
  // ISO week algorithm (UTC based)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNo, weekYear: d.getUTCFullYear() };
}

function weekdayAbbrev(date: Date) {
  // de-DE short weekday can contain a dot ("Mo.") – normalize to "Mo"
  const raw = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(date);
  return raw.replace(".", "");
}

function dateKey(year: number, monthIndex1: number, day: number) {
  return `${year}-${pad2(monthIndex1)}-${pad2(day)}`;
}

export function ShiftplanTable({
  schedule,
  daysInMonth,
  loading,
  year,
  monthIndex1,
  holidays,
  warnings,
  isEditMode,
  selectedCells,
  onCellClick,
  onHideEmployee,
  onCellContextMenu,

  // 2027
  employeeHours,
  highlightRequest,
  wellbeingMetrics = [],
  wellbeingConfig,
  violations = [],
  showSkillsOverlay = false,
  employeeSkills,
  coverageViolations = [],
  staffingResults = [],
  absences = [],
  absenceConflicts = [],
  constraintsMap = {},
  constraintViolations = [],

  // Ramadan
  showRamadanOverlay = false,
  showSunTimesHints = false,
  ramadanMeta = null,
  ramadanTimings = []
}: ShiftplanTableProps) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  // Helper
  const getMetric = (name: string) => wellbeingMetrics.find(m => m.employee_name === name);

  // For C3: Last Update + Asset Count Display
  const tickets = useCommitStore((s) => s.tickets);
  const lastUpdate = useMemo(() => {
    if (!tickets || tickets.length === 0) return null;
    let maxTime = 0;
    for (const t of tickets as any[]) {
      if (t.updated_at) {
        const time = new Date(t.updated_at).getTime();
        if (time > maxTime) maxTime = time;
      }
    }
    return maxTime > 0 ? new Date(maxTime).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  }, [tickets]);

  // Ramadan Helper
  const isRamadanDate = (day: number) => {
    if (!ramadanMeta) return false;
    const dStr = dateKey(year, monthIndex1, day);
    return dStr >= ramadanMeta.ramadan_start && dStr <= ramadanMeta.ramadan_end;
  };

  const getSunData = (day: number) => {
    if (!ramadanMeta || !ramadanTimings || !ramadanTimings.length) return null;
    const dStr = dateKey(year, monthIndex1, day);
    if (dStr >= ramadanMeta.ramadan_start && dStr <= ramadanMeta.ramadan_end) {
      return ramadanTimings.find(t => t.date === dStr);
    }
    return null;
  };

  // Keyboard navigation across cells (Edit mode)
  const focusCell = (employeeIndex: number, day: number) => {
    const el = tableRef.current?.querySelector<HTMLTableCellElement>(
      `[data-emp-index="${employeeIndex}"][data-day="${day}"]`
    );
    el?.focus();
  };

  const employees = Object.keys(schedule);
  const canNav = false; // Removed feature for now or kept as inactive
  const canCtx = true;  // Always enable context menu for now

  // [NEW] Violations Map
  const violationsMap = useMemo(() => {
    const m = new Map<string, ShiftViolation[]>();
    for (const v of violations || []) {
      const d = new Date(v.date);
      const day = d.getDate();
      const key = cellKey(v.employee_name, day);
      const arr = m.get(key) ?? [];
      arr.push(v);
      m.set(key, arr);
    }
    return m;
  }, [violations]);

  const warningByDateKey = useMemo(() => {
    const m = new Map<string, UnderstaffWarning[]>();
    for (const w of warnings || []) {
      const arr = m.get(w.dateKey) ?? [];
      arr.push(w);
      m.set(w.dateKey, arr);
    }
    return m;
  }, [warnings]);

  // Inside loop...
  // These lines are likely meant to be inside the cell rendering loop, not at the top level.
  // const cellViolations = violationsMap.get(cellKey(name, day));
  // const hasViolation = cellViolations && cellViolations.length > 0;

  // This `return` statement was misplaced. It should be at the end of the component.
  // The user's provided snippet indicates the `weekGroups` useMemo should be here.

  const weekGroups = useMemo(() => {
    const groups: Array<{ label: string; span: number }> = [];
    let i = 1;
    while (i <= daysInMonth) {
      const d = new Date(year, monthIndex1 - 1, i);
      const { weekNo } = isoWeek(d);
      const label = `KW ${weekNo}`;

      let span = 0;
      while (i + span <= daysInMonth) {
        const d2 = new Date(year, monthIndex1 - 1, i + span);
        const { weekNo: w2 } = isoWeek(d2);
        if (w2 !== weekNo) break;
        span++;
      }

      groups.push({ label, span });
      i += span;
    }
    return groups;
  }, [year, monthIndex1, daysInMonth]);

  // Scroll to today if requested
  useEffect(() => {
    if (!highlightRequest) return;
    const today = new Date();

    if (today.getFullYear() !== year || today.getMonth() + 1 !== monthIndex1) {
      return;
    }

    const day = today.getDate();
    // Find th for this day
    const th = tableRef.current?.querySelector(`th[data-day-header="${day}"]`);
    if (th) {
      th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      // Add a temporary highlight effect
      th.classList.add("ring-4", "ring-primary", "z-50");
      setTimeout(() => {
        th.classList.remove("ring-4", "ring-primary", "z-50");
      }, 2000);
    }
  }, [highlightRequest, year, monthIndex1]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!tableRef.current) return;
      if (!tableRef.current.contains(e.target as Node)) {
        setSelectedRow(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthIndex1;
  const currentDay = today.getDate();

  return (
    <Card className="rounded-2xl flex-1 overflow-visible border-0 shadow-none bg-transparent flex flex-col min-h-0">

      {/* C3: Last Update Banner */}
      {lastUpdate && (
        <div className="flex justify-end mb-2">
          <div className="text-[10px] font-mono tracking-wider font-semibold text-slate-400/80 bg-black/20 px-2.5 py-1 rounded-md border border-white/5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Letztes Crawler-Update: {lastUpdate}
            <span className="text-white/20">|</span>
            {tickets.length} Assets geladen
          </div>
        </div>
      )}

      <CardContent className="p-0 h-full overflow-visible flex-1 min-h-0">
        <div className="overflow-x-auto h-full rounded-xl border border-white/10 bg-[#0f111a]">
          <table ref={tableRef} className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-[#0f111a]/95 backdrop-blur-md z-40 border-b border-white/10 shadow-sm">
              {/* KW GROUPS */}
              {/* wir überspringen die KW Gruppe, weil das im Screenshot nicht mehr drin ist, aber wir behalten es falls gewünscht - minimal invasiv: wir machen es extrem flach / borderles */}
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th
                  className="sticky left-0 bg-[#0f111a] border-r border-white/5 p-3 text-left min-w-[220px] z-50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                  rowSpan={2}
                >
                  Mitarbeiter
                </th>
                <th className="sticky bg-[#0f111a] border-r border-white/5 p-2 w-8" rowSpan={2}>
                  <span className="sr-only">Stats</span>
                </th>
                {weekGroups.map((g, idx) => (
                  <th
                    key={`${g.label}-${idx}`}
                    colSpan={g.span}
                    className="border-r border-white/5 p-1.5 text-center text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60"
                  >
                    {g.label}
                  </th>
                ))}

                {/* 2027+ Header Logic */}
                {year >= 2027 && (
                  <>
                    <th className="sticky right-[100px] bg-[#0f111a] border-l border-white/5 p-2 w-[50px] z-50 shadow-[-1px_0_0_0_rgba(255,255,255,0.05)] text-[10px] text-muted-foreground tracking-widest uppercase text-center" rowSpan={2}>Soll</th>
                    <th className="sticky right-[50px] bg-[#0f111a] border-l border-white/5 p-2 w-[50px] z-50 text-[10px] text-muted-foreground tracking-widest uppercase text-center" rowSpan={2}>Ist</th>
                    <th className="sticky right-0 bg-[#0f111a] border-l border-white/5 p-2 w-[50px] z-50 text-[10px] text-muted-foreground tracking-widest uppercase text-center" rowSpan={2}>Diff</th>
                  </>
                )}
              </tr>

              {/* DAY HEADERS */}
              <tr>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const d = new Date(year, monthIndex1 - 1, day);
                  const dow = d.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const key = dateKey(year, monthIndex1, day);
                  const isToday = isCurrentMonth && day === currentDay;

                  const holidayName = holidays?.[key];
                  const dayWarnings = warningByDateKey.get(key) ?? [];
                  const hasWarning = dayWarnings.length > 0;

                  // [NEW] C2: Red Highlight for Empty Days
                  const isDayEmpty = !employees.some((name) => schedule[name] && schedule[name][day]);

                  const titleParts: string[] = [];
                  titleParts.push(`${weekdayAbbrev(d)} ${day}.${pad2(monthIndex1)}.${year}`);
                  if (holidayName) titleParts.push(`Feiertag: ${holidayName}`);
                  if (hasWarning) titleParts.push(`Unterbesetzung: ${dayWarnings.map((w) => w.label).join(" | ")}`);

                  // [NEW] Staffing Status Indicator
                  const dateStr = dateKey(year, monthIndex1, day);
                  const resultForDay = staffingResults.filter(r => r.date.startsWith(dateStr));
                  const isFail = resultForDay.some(r => r.status === "FAIL");
                  const isWarn = resultForDay.some(r => r.status === "WARN");
                  const isOk = resultForDay.length > 0 && !isFail && !isWarn;

                  let dotColor = "bg-gray-200"; // No data / Neutral
                  if (isFail) dotColor = "bg-red-500";
                  else if (isWarn) dotColor = "bg-yellow-500";
                  else if (isOk) dotColor = "bg-green-500";

                  const staffingTooltip = resultForDay.length > 0
                    ? "\n\nStaffing:\n" + resultForDay.map(r => `${r.shift_type}: ${r.actual}/${r.min} (${r.status})`).join("\n")
                    : "";

                  const thContent = (
                    <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                      <div className={`text-[10px] font-bold tracking-widest uppercase ${isWeekend ? 'text-indigo-300/80' : 'text-muted-foreground'}`}>
                        {weekdayAbbrev(d)}
                      </div>

                      {/* [NEW] Ramadan Tooltip Trigger */}
                      {showRamadanOverlay && isRamadanDate(day) ? (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`text-[11px] font-medium flex items-center justify-center gap-0.5 cursor-help decoration-dotted underline decoration-purple-500/50 ${isToday ? 'text-indigo-300 font-bold' : 'text-foreground'}`}>
                                {day}.{pad2(monthIndex1)}.
                                <Moon size={8} className="fill-current text-purple-400 ml-0.5" />
                                {holidayName && <span className="text-[10px] text-red-400 font-bold drop-shadow-[0_0_4px_rgba(248,113,113,0.8)]">✦</span>}
                                {hasWarning && <span className="text-[11px] font-extrabold text-red-400">!!</span>}
                              </div>
                            </TooltipTrigger>
                            {/* Content... */}
                            {getSunData(day) && (
                              <TooltipContent side="bottom" className="text-xs bg-[#0f111a]/95 backdrop-blur text-white border-white/10 p-2 shadow-xl z-50 text-left">
                                {/* ... existing content ... */}
                                <div className="font-bold mb-1 text-purple-400 flex items-center gap-2 border-b border-white/10 pb-1">
                                  <Moon size={10} /> {d.toLocaleDateString("de-DE", { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
                                  <span className="text-muted-foreground">Fajr:</span> <span className="text-right font-mono text-purple-200">{getSunData(day)?.fajr || "-"}</span>
                                  <span className="text-muted-foreground">Maghrib:</span> <span className="text-right font-mono text-purple-200">{getSunData(day)?.maghrib || "-"}</span>
                                  <span className="text-muted-foreground col-span-2 pt-1 mt-1 border-t border-white/5 text-center block">
                                    ☀️ {getSunData(day)?.sunrise} - {getSunData(day)?.sunset}
                                  </span>
                                </div>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className={`text-[11px] font-medium flex items-center justify-center gap-0.5 ${isToday ? 'text-indigo-300 font-bold' : 'text-foreground'}`}>
                          {day}.{pad2(monthIndex1)}.
                          {holidayName && <span className="text-[10px] text-red-400 font-bold drop-shadow-[0_0_4px_rgba(248,113,113,0.8)] ml-0.5">✦</span>}
                          {hasWarning && <span className="text-[11px] font-extrabold text-red-400 ml-0.5">!!</span>}
                        </div>
                      )}

                      {/* Traffic Light Dot */}
                      {resultForDay.length > 0 && (
                        <div
                          className={`w-2 h-2 rounded-full ${dotColor} mt-1`}
                        />
                      )}
                    </div>
                  );

                  return (
                    <th
                      key={i}
                      data-day-header={day}
                      title={titleParts.join("\n") + staffingTooltip}
                      className={`border-r border-white/5 p-2 min-w-[50px] select-none relative group transition-colors
                        ${isWeekend ? "bg-white/[0.015]" : ""}
                        ${holidayName ? "bg-red-500/10 hover:bg-red-500/20" : ""}
                        ${isDayEmpty ? "border-x border-red-500/30 bg-red-500/[0.04] shadow-[inset_0_0_12px_rgba(239,68,68,0.2)]" : ""}
                        ${hasWarning ? "bg-red-600/25 ring-2 ring-red-300/70 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.25)]" : ""}
                        ${isToday ? "bg-indigo-500/10 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.5)] z-30" : ""}
                        ${holidayName ? "cursor-context-menu" : ""}
                      `}
                    >
                      {holidayName ? (
                        <ContextMenu.Root>
                          <ContextMenu.Trigger className="w-full h-full block">
                            {thContent}
                          </ContextMenu.Trigger>
                          <ContextMenu.Portal>
                            <ContextMenu.Content className="min-w-[220px] bg-[#0a1228]/95 backdrop-blur-2xl text-white rounded-lg border border-red-500/50 p-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] z-[99999] animate-in fade-in-80 zoom-in-95">
                              <div className="font-extrabold text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.8)] uppercase tracking-widest text-[12px] mb-2 px-1 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                Feiertag
                              </div>
                              <div className="text-[13px] font-bold text-slate-100 px-1 pb-1">{holidayName}</div>
                              <div className="text-[11px] text-muted-foreground px-1 mb-2">
                                {d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
                              </div>
                            </ContextMenu.Content>
                          </ContextMenu.Portal>
                        </ContextMenu.Root>
                      ) : (
                        thContent
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {employees.map((name) => {
                const isSelected = selectedRow === name;
                const hasRowSelected = selectedRow !== null;
                return (
                  <>
                    <tr
                      key={name}
                      className={`cursor-pointer transition-colors border-b border-white/5
                      ${isSelected ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 z-10 relative" : ""}
                      ${hasRowSelected && !isSelected ? "opacity-35" : ""}
                      hover:bg-white/[0.04] group
                    `}
                    >
                      <td
                        className={`sticky left-0 border-r border-white/5 p-3 min-w-[220px] bg-[#0f111a] group-hover:bg-[#1a1c23] transition-colors
                        ${isSelected ? "bg-[#1a1c23] border-indigo-500/30" : ""}
                        z-30
                      `}
                        onClick={(e) => {
                          // Highlight row toggle for easier comparison
                          e.stopPropagation();
                          setSelectedRow((prev) => (prev === name ? null : name));
                        }}
                      >
                        <div className="flex flex-col justify-center min-h-[44px]">
                          {/* Name + Hide Button */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[13px] font-semibold tracking-wide ${isSelected ? "text-indigo-400" : "text-white group-hover:text-indigo-300 transition-colors"}`}>{name}</span>
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md hover:bg-white/10 text-muted-foreground"
                              title="Mitarbeiter ausblenden"
                              onClick={(e) => {
                                e.stopPropagation();
                                onHideEmployee(name);
                              }}
                            >
                              <EyeOff size={14} />
                            </button>
                          </div>

                          {/* [NEW] Skills Overlay */}
                          {showSkillsOverlay && employeeSkills?.has(name) && (
                            <div className="flex items-center gap-1 mt-1">
                              {employeeSkills.get(name)?.can_sh && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-500/10 text-blue-400 border-blue-500/20">SH</Badge>}
                              {employeeSkills.get(name)?.can_tt && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-purple-500/10 text-purple-400 border-purple-500/20">TT</Badge>}
                              {employeeSkills.get(name)?.can_cc && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-500/10 text-green-400 border-green-500/20">CC</Badge>}
                            </div>
                          )}

                          {/* [NEW] Wellbeing Badges & Score Ampel */}
                          {getMetric(name) && wellbeingConfig && (
                            <div className="flex items-center gap-1.5 mt-1 test-[9px] font-mono leading-none text-muted-foreground/60">
                              {/* Compact Stats */}
                              <div className="flex gap-1.5">
                                <span title="Nachtschichten">N:{getMetric(name)!.night_count}</span>
                                <span className="opacity-20 text-white/50">|</span>
                                <span title="Wochenenden">WE:{getMetric(name)!.weekend_count}</span>
                                <span className="opacity-20 text-white/50">|</span>
                                <span title="Frühschichten">E:{getMetric(name)!.early_count ?? 0}</span>
                                <span className="opacity-20 text-white/50">|</span>
                                <span title="Spätschichten">L:{getMetric(name)!.late_count ?? 0}</span>
                              </div>
                            </div>
                          )}

                          {/* 2027 Hours */}
                          {employeeHours && (
                            <div className="text-[10px] text-muted-foreground font-normal mt-1 grid grid-cols-2 gap-x-2">
                              <span>Soll: {employeeHours.get(name)?.soll ?? "—"}h</span>
                              <span>Ist: {employeeHours.get(name)?.ist ?? "—"}h</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td
                        className="border-r border-white/5 p-1 text-center w-8 bg-[#0f111a] group-hover:bg-[#1a1c23] transition-colors cursor-pointer text-muted-foreground/50 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedEmp(prev => prev === name ? null : name);
                        }}
                        title="Jahresstatistik anzeigen"
                      >
                        {expandedEmp === name ? <ChevronDown size={14} className="mx-auto" /> : <ChevronRight size={14} className="mx-auto" />}
                      </td>

                      {Array.from({ length: daysInMonth }, (_, d) => {
                        const day = d + 1;
                        const shift = schedule[name]?.[day];
                        const info = shift ? shiftTypes[shift] : null;
                        const key = dateKey(year, monthIndex1, day);
                        const hasWarning = (warningByDateKey.get(key) ?? []).length > 0;
                        const isToday = isCurrentMonth && day === currentDay;
                        const isRamadan = showRamadanOverlay && isRamadanDate(day);

                        // [NEW] Check for violations & coverage
                        const cellViolations = violationsMap.get(cellKey(name, day));
                        const hasViolation = cellViolations && cellViolations.length > 0;

                        // [NEW] Coverage Warning (simplified: check if day has ANY coverage issue)
                        // Ideally coverage is per shift type, but we show a generic badge here if the day has issues
                        // We check if this cell's shift type matches a coverage violation for this day
                        let hasCoverageIssue = false;
                        if (coverageViolations && shift) {
                          const s = String(shift).toUpperCase();
                          // Find violation for this day
                          const dayIssues = coverageViolations.filter(v => {
                            const vd = new Date(v.date);
                            return vd.getDate() === day;
                          });

                          // Check if current shift matches violation type
                          for (const issue of dayIssues) {
                            if (s.startsWith(issue.shift_type)) {
                              hasCoverageIssue = true;
                              break;
                            }
                          }
                        }

                        const isCellSelected = selectedCells?.has(cellKey(name, day)) ?? false;

                        // [NEW] Absence Logic
                        // Check if this cell falls into an absence range
                        const currentDate = new Date(year, monthIndex1 - 1, day);
                        const absence = absences.find(a => {
                          if (a.employee_name !== name) return false;
                          const start = new Date(a.start_date);
                          const end = new Date(a.end_date);
                          // Reset times for safe comparison
                          start.setHours(0, 0, 0, 0);
                          end.setHours(0, 0, 0, 0);
                          currentDate.setHours(0, 0, 0, 0);
                          return currentDate >= start && currentDate <= end;
                        });

                        // [NEW] Absence Conflict Logic
                        const conflict = absenceConflicts.find(c => {
                          if (c.employee_name !== name) return false;
                          const d = new Date(c.date);
                          return d.getDate() === day && d.getMonth() === monthIndex1 - 1 && d.getFullYear() === year;
                        });

                        return (
                          <td
                            key={day}
                            data-emp-index={employees.indexOf(name)}
                            data-day={day}
                            tabIndex={canNav ? 0 : -1}
                            className={`border-r border-white/5 p-1 text-center relative transition-colors group-hover:bg-white/[0.02] 
                              ${hasWarning ? "bg-red-600/10" : ""}
                              ${hasViolation ? "ring-2 ring-red-500/50 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)] bg-red-500/5" : ""} 
                              ${hasCoverageIssue ? "bg-orange-500/10" : ""}
                              ${(isEditMode || !!onCellClick) ? "cursor-pointer" : ""}
                              ${isCellSelected ? "ring-2 ring-indigo-400 bg-indigo-500/20" : ""}
                              ${isToday ? "bg-indigo-500/5" : ""}
                              ${conflict ? "bg-red-900/40" : ""} 
                            `}
                            onKeyDown={(e) => {
                              if (!canNav) return;

                              const empIdx = employees.indexOf(name);
                              if (empIdx < 0) return;

                              const move = (nextEmpIdx: number, nextDay: number) => {
                                e.preventDefault();
                                const boundedEmp = Math.max(0, Math.min(employees.length - 1, nextEmpIdx));
                                const boundedDay = Math.max(1, Math.min(daysInMonth, nextDay));
                                focusCell(boundedEmp, boundedDay);
                              };

                              // Navigate only when SHIFT is held (matches user expectation: "per Shift über Felder")
                              if (!e.shiftKey) return;

                              switch (e.key) {
                                case "ArrowLeft":
                                  move(empIdx, day - 1);
                                  break;
                                case "ArrowRight":
                                  move(empIdx, day + 1);
                                  break;
                                case "ArrowUp":
                                  move(empIdx - 1, day);
                                  break;
                                case "ArrowDown":
                                  move(empIdx + 1, day);
                                  break;
                                default:
                                  break;
                              }
                            }}
                            onContextMenu={(e) => {
                              if (!canCtx) return;
                              e.preventDefault();
                              e.stopPropagation();
                              onCellContextMenu(e, {
                                employeeName: name,
                                day,
                                current: String(shift || ""),
                              });
                            }}
                            onClick={(e) => {
                              if (onCellClick) {
                                onCellClick(name, day, {
                                  shiftKey: e.shiftKey,
                                  ctrlKey: e.ctrlKey,
                                  metaKey: e.metaKey
                                });
                                e.stopPropagation();
                                return;
                              }

                              if (!isEditMode) return;
                              e.stopPropagation();
                            }}
                          >
                            {/* [NEW] Violation Marker */}
                            {hasViolation && (
                              <div className="absolute -top-1 -right-1 z-20">
                                <div
                                  className="text-[10px] cursor-help bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-md animate-pulse"
                                  title={cellViolations?.map(v =>
                                    v.violation_type === "REST_TIME" ? `Ruhezeit! ${v.details.msg}` : `Wechsel! ${v.details.msg}`
                                  ).join("\n")}
                                >
                                  !
                                </div>
                              </div>
                            )}

                            {/* [NEW] Conflict Warning */}
                            {conflict && (
                              <div className="absolute -top-1.5 -left-1.5 z-30">
                                <div className="text-[10px] bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-md animate-bounce" title={conflict.details.msg}>
                                  ⚠
                                </div>
                              </div>
                            )}

                            {/* [NEW] Absence Chip (only if NO shift is present OR if we want to overlay) */}
                            {/* Design choice: If shift exists, show shift + Conflict Badge. If no shift, show Absence Chip. */}
                            {!shift && absence && (
                              <div className="flex justify-center">
                                <Badge variant="outline" className={`
                                        h-6 px-1.5 text-[10px] border-dashed
                                        ${absence.type === 'VACATION' ? 'bg-green-500/10 text-green-400 border-green-500/50' : ''}
                                        ${absence.type === 'SICK' ? 'bg-red-500/10 text-red-400 border-red-500/50' : ''}
                                        ${absence.type === 'TRAINING' ? 'bg-blue-500/10 text-blue-400 border-blue-500/50' : ''}
                                        ${absence.type === 'OFFSITE' ? 'bg-purple-500/10 text-purple-400 border-purple-500/50' : ''}
                                    `} title={absence.note}>
                                  {absence.type === 'VACATION' ? 'U' :
                                    absence.type === 'SICK' ? 'K' :
                                      absence.type === 'TRAINING' ? 'T' : 'O'}
                                </Badge>
                              </div>
                            )}

                            {info || shift ? (
                              <div className="flex justify-center w-full">
                                <ShiftBadge code={shift} hasWarning={hasWarning} />
                              </div>
                            ) : (
                              <div className="text-[12px] font-bold text-white/10 group-hover:text-white/20 transition-colors select-none flex items-center justify-center w-full h-[22px]">—</div>
                            )}
                          </td>
                        );
                      })}

                      {/* 2027 Stats Columns */}
                      {year >= 2027 && (
                        (() => {
                          const stats = employeeHours?.get(name);
                          const isOver = stats ? stats.diff > 0 : false;
                          const isUnder = stats ? stats.diff < 0 : false;
                          return (
                            <>
                              <td className="p-2 border-l border-white/5 text-center text-xs font-semibold bg-[#0f111a] group-hover:bg-[#1a1c23] sticky right-[100px] z-30 shadow-[-1px_0_0_0_rgba(255,255,255,0.05)] text-muted-foreground/80">
                                {stats?.soll ?? "—"}
                              </td>
                              <td className="p-2 border-l border-white/5 text-center text-xs font-semibold bg-[#0f111a] group-hover:bg-[#1a1c23] sticky right-[50px] z-30 text-muted-foreground/80">
                                {stats?.ist ?? "—"}
                              </td>
                              <td className={`p-2 border-l border-white/5 text-center text-xs font-bold bg-[#0f111a] group-hover:bg-[#1a1c23] sticky right-0 z-30
                                    ${isOver ? "text-green-400" : ""}
                                    ${isUnder ? "text-red-400" : ""}
                                `}>
                                {stats ? (stats.diff > 0 ? `+${stats.diff}` : stats.diff) : "—"}
                              </td>
                            </>
                          );
                        })()
                      )}
                    </tr>

                    {/* EXPANDABLE CHART ROW */}
                    {
                      expandedEmp === name && (
                        <tr className="bg-muted/10">
                          <td colSpan={daysInMonth + 1} className="p-4 border-b border-border">
                            <EmployeeYearlyStats
                              employeeName={name}
                              year={year}
                            // Preloaded not strictly available here unless passed via props, 
                            // but component handles fetching if missing.
                            />
                          </td>
                        </tr>
                      )
                    }
                  </>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="p-4 text-center text-muted-foreground">
              Lade Schichtplan …
            </div>
          )}
        </div>
      </CardContent>
    </Card >
  );
}

/* ------------------------------------------------ */
/* WEEKPLAN – PAGE (current KW)                      */
/* ------------------------------------------------ */

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useAuth } from "../../context/AuthContext";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu";

import { fetchSchedule, importSchedule } from "../shiftplan/shiftplan.api";
import { formatMonthLabel } from "../../utils/dateFormat";
import { getGermanHolidaysNationwide } from "../../utils/deHolidays";
import { shiftTypes } from "../../store/shiftStore";
import { useHiddenEmployees } from "../../hooks/useHiddenEmployees"; // [NEW] import
import { useWeekplanRoleStore, WEEKPLAN_ROLES, getRoleDef } from "../../store/weekplanRoleStore";

type Schedule = Record<string, Record<number, string>>;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNo, weekYear: d.getUTCFullYear() };
}

function startOfIsoWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  // Monday as start
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekdayAbbrev(date: Date) {
  const raw = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(date);
  return raw.replace(".", "");
}

export default function Weekplan() {
  const { canWrite } = useAuth();
  const canEdit = canWrite("shiftplan");

  /* NAVIGATION STATE */
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper to jump weeks
  const traverseWeek = (delta: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + (delta * 7));
    setCurrentDate(next);

    // Log navigation
    import("../../api/api").then(({ api }) => {
      api.post("/activity/log", {
        action: "weekplan_navigate",
        module: "WEEKPLAN",
        details: {
          direction: delta > 0 ? "next" : "prev",
          targetDate: next.toISOString().split("T")[0]
        }
      }).catch(() => { });
    });
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentDate(now);
  };

  const { weekNo } = isoWeek(currentDate);

  const weekStart = useMemo(() => startOfIsoWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const locale: "de-DE" | "en-US" = "de-DE";

  const monthLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const d of weekDays) {
      labels.add(formatMonthLabel(d.getFullYear(), d.getMonth() + 1, locale));
    }
    return Array.from(labels);
  }, [weekDays]);

  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [dirtyMonths, setDirtyMonths] = useState<Set<string>>(new Set());
  const [schedulesByMonth, setSchedulesByMonth] = useState<Record<string, Schedule>>({});

  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Employee highlight (click name to highlight row, click again or ESC to clear)
  const [highlightedEmployee, setHighlightedEmployee] = useState<string | null>(null);

  // Multi-day selection for role assignment (Shift+Click)
  const [selectedCells, setSelectedCells] = useState<{ employee: string; dayIndices: Set<number> } | null>(null);

  // Role store
  const { fetchRoles, getRole, setRole, setBulkRoles, removeRole } = useWeekplanRoleStore();

  // Edit dialog (set code)
  const EMPTY = "__EMPTY__";
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState<string>(EMPTY);
  const [editTarget, setEditTarget] = useState<null | { employeeName: string; date: Date; current: string }>(null);

  const holidays = useMemo(() => {
    // union of years (week can cross year)
    const years = new Set(weekDays.map((d) => d.getFullYear()));
    const combined: Record<string, string> = {};
    for (const y of years) {
      Object.assign(combined, getGermanHolidaysNationwide(y));
    }
    return combined;
  }, [weekDays]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const out: Record<string, Schedule> = {};
        for (const label of monthLabels) {
          const data = await fetchSchedule(label);
          out[label] = data?.schedule || {};
        }
        setSchedulesByMonth(out);
        setDirtyMonths(new Set());
      } catch (e) {
        console.error("WEEKPLAN load error", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [monthLabels.join("|")]);

  const { isHidden } = useHiddenEmployees(); // [NEW] hook usage

  // Fetch weekplan roles for the current week range
  useEffect(() => {
    if (weekDays.length < 7) return;
    const from = dateKey(weekDays[0]);
    const to = dateKey(weekDays[6]);
    fetchRoles(from, to);
  }, [weekDays, fetchRoles]);

  // Helper to check if code is "working"
  const isWorkingShift = (code: string) => {
    if (!code) return false;
    const nonWorking = ["FS", "ABW", "OFF", "", "DBS"]; // DBS added per context? Requirement: FS, ABW, OFF, null, ""
    if (nonWorking.includes(code.toUpperCase())) return false;
    return true; // E1, E2, L1, N etc.
  };

  const employees = useMemo(() => {
    const s = new Set<string>();
    // Collect all employees from loaded months
    for (const sched of Object.values(schedulesByMonth || {})) {
      Object.keys(sched || {}).forEach((n) => s.add(n));
    }

    let list = Array.from(s).filter((n) => !isHidden(n));

    // ACTIVE FILTER (Server preferred, but we have partial data loaded. 
    // "Filter employees... only if they have at least one shift in the displayed week... that is NOT FS, ABW, OFF".
    if (showActiveOnly) {
      list = list.filter(emp => {
        // Check if emp has ANY working shift in `weekDays`
        return weekDays.some(d => {
          const label = formatMonthLabel(d.getFullYear(), d.getMonth() + 1, locale);
          const day = d.getDate();
          const code = schedulesByMonth?.[label]?.[emp]?.[day] || "";
          return isWorkingShift(code);
        });
      });
    }

    return list.sort();
  }, [schedulesByMonth, isHidden, showActiveOnly, weekDays]);

  const getMonthLabelForDate = (d: Date) => formatMonthLabel(d.getFullYear(), d.getMonth() + 1, locale);

  const getShift = (employeeName: string, d: Date) => {
    const label = getMonthLabelForDate(d);
    const day = d.getDate();
    return schedulesByMonth?.[label]?.[employeeName]?.[day] || "";
  };

  const setShift = (employeeName: string, d: Date, value: string) => {
    const label = getMonthLabelForDate(d);
    const day = d.getDate();
    setSchedulesByMonth((prev) => {
      const next = { ...(prev || {}) };
      const month = { ...(next[label] || {}) };
      const row = { ...(month[employeeName] || {}) };
      const v = String(value || "").trim().toUpperCase();
      if (!v || v === EMPTY) {
        delete row[day];
      } else {
        row[day] = v;
      }
      month[employeeName] = row;
      next[label] = month;
      return next;
    });
    setDirtyMonths((prev) => new Set([...(prev || new Set()), label]));
  };

  const openEditCell = (employeeName: string, d: Date) => {
    if (!canEdit) return;
    if (!isEditMode) return;
    const current = getShift(employeeName, d);
    setEditTarget({ employeeName, date: d, current });
    setEditValue(current ? current.toUpperCase() : EMPTY);
    setEditOpen(true);
  };

  const applyEdit = () => {
    if (!editTarget) return;
    setShift(editTarget.employeeName, editTarget.date, editValue);
    setEditOpen(false);
  };

  // ESC clears employee highlight + selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHighlightedEmployee(null);
        setSelectedCells(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const saveChanges = async () => {
    if (!canEdit) return;
    if (dirtyMonths.size === 0) return;

    try {
      setLoading(true);
      for (const label of Array.from(dirtyMonths)) {
        await importSchedule(label, schedulesByMonth[label] || {});
      }
      setDirtyMonths(new Set());
    } catch (e) {
      console.error("WEEKPLAN save error", e);
      alert("Speichern fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  // Toggle cell selection (Shift+Click)
  const toggleCellSelect = useCallback((employeeName: string, dayIdx: number) => {
    setSelectedCells((prev) => {
      if (!prev || prev.employee !== employeeName) {
        // Start new selection for this employee
        return { employee: employeeName, dayIndices: new Set([dayIdx]) };
      }
      const next = new Set(prev.dayIndices);
      if (next.has(dayIdx)) {
        next.delete(dayIdx);
      } else {
        next.add(dayIdx);
      }
      // If empty, clear selection
      if (next.size === 0) return null;
      return { employee: employeeName, dayIndices: next };
    });
  }, []);

  // Apply role to selected cells or a single cell
  const applyRoleToSelection = useCallback(
    async (employeeName: string, dayIndices: number[], roleKey: string) => {
      const dates = dayIndices.map((i) => dateKey(weekDays[i]));
      if (dates.length === 1) {
        await setRole(employeeName, dates[0], roleKey as any);
      } else {
        await setBulkRoles(employeeName, dates, roleKey as any);
      }
      setSelectedCells(null);
    },
    [weekDays, setRole, setBulkRoles]
  );

  // Remove role from a cell
  const removeRoleFromCell = useCallback(
    async (employeeName: string, dayIdx: number) => {
      const date = dateKey(weekDays[dayIdx]);
      await removeRole(employeeName, date);
      setSelectedCells(null);
    },
    [weekDays, removeRole]
  );

  // Check if a cell is selected
  const isCellSelected = useCallback(
    (employeeName: string, dayIdx: number) => {
      return selectedCells?.employee === employeeName && selectedCells.dayIndices.has(dayIdx);
    },
    [selectedCells]
  );

  // keyboard navigation (Shift + Arrows)
  const focusCell = (employeeIndex: number, dayIndex: number) => {
    const el = document.querySelector<HTMLElement>(
      `[data-week-emp-index="${employeeIndex}"][data-week-day-index="${dayIndex}"]`
    );
    el?.focus();
  };

  return (
    <div className="space-y-6 flex flex-col">
      <div className="p-5 bg-[#0f111a]/80 backdrop-blur-md rounded-2xl border border-white/10 space-y-4 shadow-lg flex-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-wide">Wochenplanung – KW {weekNo}</h2>
            <div className="text-[13px] font-medium text-muted-foreground mt-1">
              {weekdayAbbrev(weekDays[0])} {weekDays[0].getDate()}.{pad2(weekDays[0].getMonth() + 1)}.{weekDays[0].getFullYear()} – {weekdayAbbrev(weekDays[6])} {weekDays[6].getDate()}.{pad2(weekDays[6].getMonth() + 1)}.{weekDays[6].getFullYear()}
            </div>
          </div>

        </div>

        <div className="flex items-center gap-4">
          {/* NAVIGATION */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => traverseWeek(-1)}>
              &larr;
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={jumpToToday}>
              Heute
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => traverseWeek(1)}>
              &rarr;
            </Button>
          </div>

          {/* FILTER */}
          <div
            className={`text-xs flex items-center gap-2 cursor-pointer select-none px-2 py-1 rounded-md transition-colors ${showActiveOnly ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => {
              setShowActiveOnly(!showActiveOnly);
              // Log filter change
              import("../../api/api").then(({ api }) => {
                api.post("/activity/log", {
                  action: "weekplan_filter_nonworking",
                  module: "WEEKPLAN",
                  details: { active: !showActiveOnly }
                }).catch(() => { });
              });
            }}
          >
            <div className={`w-3 h-3 rounded-full border ${showActiveOnly ? "bg-primary border-primary" : "border-muted-foreground"}`} />
            Nur aktive anzeigen
          </div>

          {canEdit ? (
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <Button
                variant={isEditMode ? "default" : "secondary"}
                className={isEditMode ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"}
                onClick={() => setIsEditMode((v) => !v)}
                disabled={loading}
              >
                {isEditMode ? "Bearbeiten: an" : "Bearbeiten"}
              </Button>
              <Button className="bg-green-600/90 hover:bg-green-600 text-white" onClick={saveChanges} disabled={loading || dirtyMonths.size === 0}>
                Speichern
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schicht ändern</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {editTarget ? (
                <>
                  <span className="font-semibold text-foreground">{editTarget.employeeName}</span> – {weekdayAbbrev(editTarget.date)} {editTarget.date.getDate()}.{pad2(editTarget.date.getMonth() + 1)}
                </>
              ) : null}
            </div>

            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger>
                <SelectValue placeholder="Schicht wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>(leer)</SelectItem>
                <SelectItem value="E1">E1</SelectItem>
                <SelectItem value="E2">E2</SelectItem>
                <SelectItem value="L1">L1</SelectItem>
                <SelectItem value="L2">L2</SelectItem>
                <SelectItem value="N">N</SelectItem>
                <SelectItem value="FS">FS</SelectItem>
                <SelectItem value="ABW">ABW</SelectItem>
                <SelectItem value="DBS">DBS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={applyEdit}>Übernehmen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TABLE */}
      <div className="bg-[#0f111a] rounded-2xl border border-white/10 overflow-x-auto shadow-xl flex-1 min-h-0">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-[#0f111a]/95 backdrop-blur-md z-40 border-b border-white/10 shadow-sm">
            <tr>
              <th className="sticky left-0 bg-[#0f111a] border-r border-white/5 p-3 text-left min-w-[220px] z-50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mitarbeiter</th>
              {weekDays.map((d, idx) => {
                const key = dateKey(d);
                const holiday = holidays?.[key];
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;

                return (
                  <th
                    key={idx}
                    className={`border-r border-white/5 p-2 text-center min-w-[90px] leading-tight select-none transition-colors ${holiday ? "bg-red-500/10" : ""} ${isWeekend && !holiday ? "bg-white/[0.015]" : ""}`}
                    title={holiday ? `Feiertag: ${holiday}` : undefined}
                  >
                    <div className={`text-[10px] font-bold tracking-widest uppercase ${isWeekend ? 'text-indigo-300/80' : 'text-muted-foreground'}`}>{weekdayAbbrev(d)}</div>
                    <div className="text-[11px] font-medium text-foreground flex items-center justify-center gap-0.5 mt-0.5">
                      {d.getDate()}.{pad2(d.getMonth() + 1)}.
                      {holiday && <span className="text-[10px] text-red-500 ml-0.5 drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]">✦</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {employees.map((name, empIdx) => (
              <tr
                key={name}
                className={`cursor-pointer transition-colors border-b border-white/5 hover:bg-white/[0.04] group ${name === highlightedEmployee ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 z-10 relative" : ""}`}
              >
                <td className={`sticky left-0 border-r border-white/5 p-3 min-w-[220px] bg-[#0f111a] group-hover:bg-[#1a1c23] transition-colors z-30 ${name === highlightedEmployee ? "bg-[#1a1c23] border-indigo-500/30" : ""}`}>
                  <button
                    className={`text-left w-full transition-colors text-[13px] tracking-wide ${name === highlightedEmployee ? "text-indigo-400 font-bold" : "text-white font-semibold group-hover:text-indigo-300"}`}
                    onClick={() => setHighlightedEmployee(prev => prev === name ? null : name)}
                    title="Klicken um Zeile hervorzuheben (ESC zum Aufheben)"
                  >
                    {name}
                  </button>
                  {/* Role badges for each day of the week */}
                  {(() => {
                    const dayRoles = weekDays
                      .map((d, i) => ({ dayIdx: i, role: getRole(name, dateKey(d)) }))
                      .filter((r) => r.role);
                    if (dayRoles.length === 0) return null;
                    // Deduplicate — if same role all week, just show one badge
                    const uniqueRoles = [...new Set(dayRoles.map((r) => r.role!))];
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {uniqueRoles.map((rk) => {
                          const def = getRoleDef(rk);
                          if (!def) return null;
                          return (
                            <span
                              key={rk}
                              className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border ${def.color}`}
                            >
                              {def.label}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>

                {weekDays.map((d, dayIdx) => {
                  const code = getShift(name, d);
                  const info = code ? shiftTypes[code] : null;
                  const cellDateStr = dateKey(d);
                  const cellRole = getRole(name, cellDateStr);
                  const cellRoleDef = cellRole ? getRoleDef(cellRole) : null;
                  const isSelected = isCellSelected(name, dayIdx);

                  // Shift Badge Colors matching ShiftBadge in ShiftplanTable
                  let colorClass = "bg-white/5 text-muted-foreground border-white/10";
                  if (code) {
                    const c = code.toUpperCase();
                    if (c.startsWith("E")) colorClass = "bg-orange-500/15 text-orange-400 border-orange-500/20";
                    else if (c.startsWith("L")) colorClass = "bg-yellow-500/15 text-yellow-500 border-yellow-500/20";
                    else if (c === "N") colorClass = "bg-blue-500/15 text-blue-400 border-blue-500/20";
                    else if (c === "FS") colorClass = "bg-teal-500/15 text-teal-400 border-teal-500/20";
                    else if (c === "DBS") colorClass = "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20";
                    else if (c === "S" || c === "ABW" || c === "SEMINAR") colorClass = "bg-purple-500/15 text-purple-400 border-purple-500/20";
                  }

                  const cellContent = (
                    <td
                      key={dayIdx}
                      tabIndex={canEdit ? 0 : -1}
                      data-week-emp-index={empIdx}
                      data-week-day-index={dayIdx}
                      className={`border-r border-white/5 p-2 text-center transition-colors ${isEditMode ? "cursor-pointer hover:bg-white/10" : ""} ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-500/15" : ""}`}
                      onKeyDown={(e) => {
                        if (!canEdit) return;
                        if (!e.shiftKey) return;

                        const move = (nextEmp: number, nextDay: number) => {
                          e.preventDefault();
                          const boundedEmp = Math.max(0, Math.min(employees.length - 1, nextEmp));
                          const boundedDay = Math.max(0, Math.min(6, nextDay));
                          focusCell(boundedEmp, boundedDay);
                        };

                        switch (e.key) {
                          case "ArrowLeft":
                            move(empIdx, dayIdx - 1);
                            break;
                          case "ArrowRight":
                            move(empIdx, dayIdx + 1);
                            break;
                          case "ArrowUp":
                            move(empIdx - 1, dayIdx);
                            break;
                          case "ArrowDown":
                            move(empIdx + 1, dayIdx);
                            break;
                          default:
                            break;
                        }
                      }}
                      onClick={(e) => {
                        if (e.shiftKey && canEdit) {
                          e.preventDefault();
                          toggleCellSelect(name, dayIdx);
                          return;
                        }
                        openEditCell(name, d);
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {code ? (
                          <div className={`inline-flex items-center justify-center min-w-[32px] h-[22px] px-2 text-[11px] font-bold rounded-md border ${colorClass}`}>
                            {code}
                          </div>
                        ) : (
                          isEditMode ? <div className="text-[10px] text-muted-foreground/30">—</div> : null
                        )}
                        {cellRoleDef && (
                          <span className={`text-[8px] font-bold px-1 py-px rounded border leading-tight ${cellRoleDef.color}`}>
                            {cellRoleDef.label}
                          </span>
                        )}
                      </div>
                    </td>
                  );

                  // Wrap cell in ContextMenu for role assignment if user can edit
                  if (canEdit) {
                    // Determine target days for the context menu action
                    const targetDayIndices = (isSelected && selectedCells?.employee === name)
                      ? Array.from(selectedCells.dayIndices)
                      : [dayIdx];

                    return (
                      <ContextMenu key={dayIdx}>
                        <ContextMenuTrigger asChild>
                          {cellContent}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56">
                          <ContextMenuLabel className="text-xs text-muted-foreground">
                            {targetDayIndices.length > 1
                              ? `Rolle für ${name} (${targetDayIndices.length} Tage)`
                              : `Rolle für ${name} – ${weekdayAbbrev(d)} ${d.getDate()}.${pad2(d.getMonth() + 1)}`}
                          </ContextMenuLabel>
                          <ContextMenuSeparator />
                          {WEEKPLAN_ROLES.map((r) => (
                            <ContextMenuItem
                              key={r.key}
                              onClick={() => applyRoleToSelection(name, targetDayIndices, r.key)}
                              className="flex items-center gap-2"
                            >
                              <span className={`inline-block w-2.5 h-2.5 rounded-full border ${r.color}`} />
                              <span className="font-medium">{r.label}</span>
                              {targetDayIndices.length === 1 && cellRole === r.key && (
                                <span className="ml-auto text-xs text-primary">✓</span>
                              )}
                            </ContextMenuItem>
                          ))}
                          {cellRole && targetDayIndices.length === 1 && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => removeRoleFromCell(name, dayIdx)}
                                className="text-red-400"
                              >
                                Rolle entfernen
                              </ContextMenuItem>
                            </>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  }

                  return cellContent;
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Lade Wochenplan …</div>
        ) : null}
      </div>
    </div >
  );
}

/* ------------------------------------------------ */
/* SHIFTPLAN – PAGE                                 */
/* FINAL stabile Version (Restored Layout)          */
/* ------------------------------------------------ */

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, ChevronLeft, ChevronRight, RefreshCw, Download, Calendar } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";

import { Button } from "../ui/button";
import { toast } from "sonner"; // [NEW]
import { ShiftplanTable } from "../shiftplan/ShiftplanTable";
import { ShiftContextMenu } from "../shiftplan/ShiftContextMenu";
import { useShiftSelection } from "../../hooks/useShiftSelection";
import { useHiddenEmployees } from "../../hooks/useHiddenEmployees";
import { useMonthlyStats } from "../../hooks/useShiftStats";
import { ShiftStatsPanel } from "../shiftplan/ShiftStatsPanel";
import { ShiftImportDialog } from "../shiftplan/ShiftImportDialog"; // [NEW] Excel Import
import { ExportMenu } from "../shiftplan/ExportMenu"; // [NEW]
import { HistoryDialog } from "../shiftplan/HistoryDialog"; // [NEW]
import { CompetencyModal } from "../shiftplan/CompetencyModal";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useAuth } from "../../context/AuthContext";

import {
  fetchSchedule,
  importSchedule,
} from "../shiftplan/shiftplan.api";
import { useShiftplanActions } from "../../hooks/useShiftplanActions";

import { normalizePlansByMonth } from "../shiftplan/shiftplan.months";
import { parseShiftplanExcel } from "../../utils/shiftplanExcelImporter";
import { useShiftStore } from "../../store/shiftStore";
import { formatMonthLabel } from "../../utils/dateFormat";
import { getHessenHolidayMap, HolidayMap } from "../../utils/deHolidays";
import { api } from "../../api/api";
import { computeUnderstaffWarnings } from "../shiftplan/shiftplan.warnings";
import { calculateEmployeeHours, EmployeeMonthlyStats } from "../shiftplan/shiftplan.hours";
import { useWellbeingStore } from "../../store/wellbeingStore"; // [NEW]

import { fetchViolations, validateShiftplan, ShiftViolation } from "../../api/shiftValidation"; // [NEW]

// [NEW] Coverage Imports
import {
  EmployeeSkills,
  CoverageViolation,
  fetchSkills,
  fetchCoverageViolations,
  computeCoverage
} from "../../api/coverage";
import { usePersistentToggle } from "../../hooks/usePersistentToggle";
import { fetchStaffingResults, recomputeStaffing, StaffingResult } from "../../api/staffing";
import { fetchAbsences, fetchAbsenceConflicts, Absence, AbsenceConflict, createAbsence, deleteAbsence } from "../../api/absences";
import { fetchConstraints, fetchViolations as fetchConstraintViolations, EmployeeConstraints, ConstraintViolation } from "../../api/constraints";
import { ConstraintDialog } from "../shiftplan/ConstraintDialog";
import { RamadanBadge } from "../shiftplan/RamadanBadge"; // [NEW]
import { NewStartersTab } from "../shiftplan/NewStartersTab"; // [NEW] Neustarter
import { getShiftplanPreferences, updateShiftplanPreferences } from "../../api/userPreferences";
import { generateReport, downloadReport } from "../../api/reports"; // [NEW]
import { fetchRamadanMeta, fetchSunTimes, RamadanMeta, SunTime } from "../../api/ramadan"; // [NEW]

/* ------------------------------------------------ */
/* PAGE                                             */
/* ------------------------------------------------ */

export default function Shiftplan() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shiftStore = useShiftStore();
  const { canWrite } = useAuth();
  const wellbeingStore = useWellbeingStore(); // [NEW]

  const locale: "de-DE" | "en-US" = "de-DE";

  /* ------------------------------------------------ */
  /* STATE                                            */
  /* ------------------------------------------------ */

  /* monthsWithData + API mutations provided by hook */
  const { monthsWithData, refreshMonths } = useShiftplanActions();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(
    new Date().getMonth()
  );

  // View mode: month (default) or full-year overview
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  // Main section tab: shiftplan or new starters
  const [mainView, setMainView] = useState<"plan" | "neustarter">("plan");

  const [schedule, setSchedule] = useState<Record<string, any>>({});
  const [daysInMonth, setDaysInMonth] = useState<number>(31);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // [NEW] Shift Violations
  const [violations, setViolations] = useState<ShiftViolation[]>([]);

  // Full-year view data (loaded only in year mode)
  const [yearSchedules, setYearSchedules] = useState<Record<string, Record<string, any>>>({});
  const [yearLoading, setYearLoading] = useState(false);

  // Panels visibility
  const [warningsVisible, setWarningsVisible] = useState(false);
  const [hiddenPanelVisible, setHiddenPanelVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  // [NEW] Wellbeing Panel
  const [wellbeingVisible, setWellbeingVisible] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<null | { employeeName: string; day: number; current: string }>(null);
  const EMPTY = "__EMPTY__";
  const [editValue, setEditValue] = useState<string>(EMPTY);

  // [NEW] Skills & Coverage State
  const [showSkills, setShowSkills] = usePersistentToggle("shiftplan-show-skills", false);
  const [employeeSkills, setEmployeeSkills] = useState<Map<string, EmployeeSkills>>(new Map());
  const [coverageViolations, setCoverageViolations] = useState<CoverageViolation[]>([]);

  // [NEW] Staffing Results
  const [staffingResults, setStaffingResults] = useState<StaffingResult[]>([]);

  // [NEW] Absences & Conflicts
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [absenceConflicts, setAbsenceConflicts] = useState<AbsenceConflict[]>([]);

  // New Selection Hook
  const { selection, selectCell, clearSelection, isSelected, getSelectedKeys } = useShiftSelection();

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; employeeName: string } | null>(null);

  // Swap Dialog State
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapFrom, setSwapFrom] = useState<null | { employeeName: string; day: number }>(null);
  const [swapToEmployee, setSwapToEmployee] = useState<string>("");
  const [swapToDay, setSwapToDay] = useState<string>("");

  // Hide employees (global hook)
  const { hiddenEmployees, hideEmployee, unhideEmployee, unhideAll, isHidden } = useHiddenEmployees();

  // Highlight Today Request
  const [highlightRequest, setHighlightRequest] = useState<number>(0);

  // [NEW] Hessen Holidays
  const [showHolidayOverlay, setShowHolidayOverlay] = useState(false);
  const [holidayListOpen, setHolidayListOpen] = useState(false);
  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});

  // [NEW] Changelog Exists (for conditional export)
  const [changelogExists, setChangelogExists] = useState(false);

  // [NEW] History Dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<string | undefined>(undefined);

  // [NEW] Constraints Dialog
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [constraintsTarget, setConstraintsTarget] = useState<string | undefined>(undefined);

  // [NEW] Competency Modal
  const [competencyOpen, setCompetencyOpen] = useState(false);
  const [competencyTarget, setCompetencyTarget] = useState<string>("");

  // [NEW] Constraints Data
  const [constraintsMap, setConstraintsMap] = useState<Record<string, EmployeeConstraints>>({});
  const [constraintViolations, setConstraintViolations] = useState<ConstraintViolation[]>([]);

  // [NEW] Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [showNightOnly, setShowNightOnly] = useState(false);
  const [showWeekendOnly, setShowWeekendOnly] = useState(false);
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);
  const [showUnderstaffedOnly, setShowUnderstaffedOnly] = useState(false); // Not used yet in logic but requested
  const [showRamadanOverlay, setShowRamadanOverlay] = useState(false);
  const [showSunTimesHints, setShowSunTimesHints] = useState(false);

  // [NEW] Ramadan State (Centralized)
  const [ramadanMeta, setRamadanMeta] = useState<RamadanMeta | null>(null);
  const [ramadanTimings, setRamadanTimings] = useState<SunTime[]>([]);
  const [ramadanLoading, setRamadanLoading] = useState(false);

  // Load Preferences
  useEffect(() => {
    getShiftplanPreferences().then(prefs => {
      if (prefs.searchTerm !== undefined) setSearchTerm(prefs.searchTerm);
      if (prefs.showNightOnly !== undefined) setShowNightOnly(prefs.showNightOnly);
      if (prefs.showWeekendOnly !== undefined) setShowWeekendOnly(prefs.showWeekendOnly);
      if (prefs.showWarningsOnly !== undefined) setShowWarningsOnly(prefs.showWarningsOnly);
      if (prefs.showRamadanOverlay !== undefined) setShowRamadanOverlay(prefs.showRamadanOverlay);
      if (prefs.showSunTimesHints !== undefined) setShowSunTimesHints(prefs.showSunTimesHints);
    });
  }, []);

  // Load Changelog Exists (once on mount)
  useEffect(() => {
    api.get("/reports/changelog/exists")
      .then(res => setChangelogExists(!!res.data?.exists))
      .catch(() => setChangelogExists(false));
  }, []);

  // Load Hessen Holidays per year
  useEffect(() => {
    // Use frontend calculation for instant results (no backend call needed)
    setHolidayMap(getHessenHolidayMap(selectedYear));
  }, [selectedYear]);

  // Save Preferences (Debounced for search?) 
  // For simplicity, save strictly when values change.
  useEffect(() => {
    const timer = setTimeout(() => {
      updateShiftplanPreferences({
        searchTerm,
        showNightOnly,
        showWeekendOnly,
        showWarningsOnly,
        showRamadanOverlay,
        showSunTimesHints
      }).catch(err => console.error("Failed to save prefs", err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchTerm, showNightOnly, showWeekendOnly, showWarningsOnly]);

  const cellKey = (employeeName: string, day: number) => `${employeeName}|||${day}`;

  const canEdit = canWrite("shiftplan");

  /* ------------------------------------------------ */
  /* HELPERS                                         */
  /* ------------------------------------------------ */

  const activeMonthLabel = formatMonthLabel(
    selectedYear,
    selectedMonthIndex + 1,
    locale
  );

  const monthIndex1 = selectedMonthIndex + 1;

  const holidays = useMemo(() => getHessenHolidayMap(selectedYear), [selectedYear]);

  const warningsComputed = useMemo(
    () => computeUnderstaffWarnings(schedule || {}, selectedYear, monthIndex1, daysInMonth),
    [schedule, selectedYear, monthIndex1, daysInMonth]
  );

  const warningsForMonthTable = warningsVisible ? warningsComputed : [];

  const warningsSummary = useMemo(() => {
    const night = warningsComputed.filter((w) => w.kind === "night");
    const late = warningsComputed.filter((w) => w.kind === "late");
    const early = warningsComputed.filter((w) => w.kind === "early");
    return { night, late, early, total: warningsComputed.length };
  }, [warningsComputed]);

  const visibleSchedule = useMemo(() => {
    const out: Record<string, any> = {};
    const searchLower = searchTerm.toLowerCase();

    const safeSchedule = (schedule && typeof schedule === 'object') ? schedule : {};
    for (const [name, plan] of Object.entries(safeSchedule)) {
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)) continue;
      if (hiddenEmployees.has(name)) continue;

      // [NEW] SEARCH FILTER
      if (searchTerm && !name.toLowerCase().includes(searchLower)) continue;

      // [NEW] WARNINGS FILTER (Only show employees with warnings?)
      if (showWarningsOnly) {
        const hasWarning = Array.isArray(warningsComputed) && warningsComputed.some(w => w.label === name);
        if (!hasWarning) continue;
      }

      const planTyped = plan as Record<number, string>;
      const shifts = Object.values(planTyped);

      if (showNightOnly) {
        const hasNight = shifts.some(s => s === 'N');
        if (!hasNight) continue;
      }

      if (showWeekendOnly) {
        let hasWeekendShift = false;
        for (const [dayKey, code] of Object.entries(planTyped)) {
          const d = Number(dayKey);
          const date = new Date(selectedYear, monthIndex1 - 1, d);
          const dow = date.getDay();
          if ((dow === 0 || dow === 6) && code && code !== 'FS' && code !== 'ABW') {
            hasWeekendShift = true;
            break;
          }
        }
        if (!hasWeekendShift) continue;
      }

      out[name] = plan;
    }
    return out;
  }, [schedule, hiddenEmployees, searchTerm, showWarningsOnly, showNightOnly, showWeekendOnly, warningsComputed, selectedYear, monthIndex1]);

  const monthlyStats = useMonthlyStats(schedule, selectedYear, selectedMonthIndex);

  // 2027 Logic
  const employeeHours = useMemo(() => {
    if (selectedYear < 2027) return undefined;
    const map = new Map<string, EmployeeMonthlyStats>();
    for (const [name, row] of Object.entries(visibleSchedule)) {
      const rowTyped = row as Record<number, string>;
      const stats = calculateEmployeeHours(name, rowTyped, selectedYear, monthIndex1, daysInMonth, holidays);
      map.set(name, stats);
    }
    return map;
  }, [visibleSchedule, selectedYear, monthIndex1, daysInMonth, holidays]);

  /* ------------------------------------------------ */
  /* WELLBEING LOGIC (NEW)                            */
  /* ------------------------------------------------ */
  useEffect(() => {
    if (viewMode === "month") {
      wellbeingStore.loadConfig();
      wellbeingStore.loadMetrics(selectedYear, monthIndex1);
    }
  }, [selectedYear, monthIndex1, viewMode]);

  const wellbeingMetrics = wellbeingStore.getMetricsForMonth(selectedYear, monthIndex1);
  const topCriticalEmployees = useMemo(() => {
    if (!wellbeingMetrics) return [];
    return [...wellbeingMetrics]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter(m => m.score > 0);
  }, [wellbeingMetrics]);

  const handleComputeWellbeing = async () => {
    await wellbeingStore.computeMetrics(selectedYear, monthIndex1);
  };

  /* ------------------------------------------------ */
  /* DATA LOADING                                     */
  /* ------------------------------------------------ */

  // [NEW] Load Staffing Results
  const loadData = async (year: number, month: number) => {
    // 1. Ramadan Fetch (Independent)
    try {
      if (!ramadanMeta || ramadanMeta.year !== year) {
        setRamadanLoading(true);
        const meta = await fetchRamadanMeta(year);
        setRamadanMeta(meta);
        if (meta) {
          const times = await fetchSunTimes(meta.ramadan_start, meta.ramadan_end);
          setRamadanTimings(times);
        } else {
          setRamadanTimings([]);
        }
        setRamadanLoading(false);
      }
    } catch (e) {
      console.error("Ramadan load failed:", e);
      setRamadanLoading(false);
    }

    // 2. Main Month Data Fetch
    try {
      const label = formatMonthLabel(year, month, locale);
      const [
        violationsData,
        coverageViolationsData,
        staffingData,
        absencesData,
        conflictsData,
        constraintsData,
        constraintViolationsData
      ] = await Promise.all([
        fetchViolations(year, month).catch(e => { console.error("Violations failed", e); return []; }),
        fetchCoverageViolations(year, month).catch(e => { console.error("Coverage failed", e); return []; }),
        fetchStaffingResults(year, month).catch(e => { console.error("Staffing failed", e); return []; }),
        fetchAbsences(year, month).catch(e => { console.error("Absences failed", e); return []; }),
        fetchAbsenceConflicts(year, month).catch(e => { console.error("Absence conflicts failed", e); return []; }),
        fetchConstraints().catch(e => { console.error("Constraints failed", e); return {}; }),
        fetchConstraintViolations(label).catch(e => { console.error("Constraint violations failed", e); return []; })
      ]);

      setViolations(Array.isArray(violationsData) ? violationsData : []);
      setCoverageViolations(Array.isArray(coverageViolationsData) ? coverageViolationsData : []);
      setStaffingResults(Array.isArray(staffingData) ? staffingData : []);
      setAbsences(Array.isArray(absencesData) ? absencesData : []);
      setAbsenceConflicts(Array.isArray(conflictsData) ? conflictsData : []);
      setConstraintsMap(constraintsData);
      setConstraintViolations(Array.isArray(constraintViolationsData) ? constraintViolationsData : []);
    } catch (err) {
      console.error("Error loading month data:", err);
    }
  };

  // Load Violations when year/month changes
  useEffect(() => {
    if (viewMode === "month") {
      fetchViolations(selectedYear, selectedMonthIndex + 1)
        .then(v => setViolations(Array.isArray(v) ? v : []))
        .catch(err => console.error("Violations Load Error:", err));

      loadData(selectedYear, selectedMonthIndex + 1);
    }
  }, [selectedYear, selectedMonthIndex, viewMode]);

  // [NEW] Load Skills if toggle is ON
  useEffect(() => {
    if (showSkills) {
      fetchSkills().then(list => {
        const map = new Map<string, EmployeeSkills>();
        for (const s of list) map.set(s.employee_name, s);
        setEmployeeSkills(map);
      });
    }
  }, [showSkills]);

  // Month list is managed by useShiftplanActions; seed it on mount.
  useEffect(() => { refreshMonths(); }, []);

  useEffect(() => {
    if (viewMode !== "month") return;
    const cached = shiftStore.schedulesByMonth?.[activeMonthLabel];
    if (cached && Object.keys(cached).length > 0) {
      setSchedule(cached);
      const days = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
      setDaysInMonth(days);
      shiftStore.setDaysInMonth(days);
    }
    loadSchedule(activeMonthLabel);
  }, [viewMode, selectedYear, selectedMonthIndex]);

  const loadSchedule = async (monthLabel: string) => {
    try {
      setLoading(true);
      setIsEditMode(false);
      setIsDirty(false);
      clearSelection();

      const data = await fetchSchedule(monthLabel);
      const sched = (data && typeof data === 'object' && data.schedule) ? data.schedule : {};
      const meta = (data && typeof data === 'object') ? data.meta : null;

      setSchedule(sched);
      shiftStore.setSchedule(monthLabel, sched);
      shiftStore.setSelectedMonth(monthLabel);

      if (meta && typeof meta === 'object' && meta.year && meta.month) {
        const days = new Date(meta.year, meta.month, 0).getDate();
        setDaysInMonth(days);
        shiftStore.setDaysInMonth(days);
      } else {
        setDaysInMonth(31);
        shiftStore.setDaysInMonth(31);
      }
    } catch (err) {
      console.error("LOAD SCHEDULE ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadYear = async (yearToLoad: number) => {
    try {
      setYearLoading(true);
      const out: Record<string, Record<string, any>> = {};
      const tasks = Array.from({ length: 12 }).map(async (_, idx) => {
        const label = formatMonthLabel(yearToLoad, idx + 1, locale);
        try {
          const data = await fetchSchedule(label);
          out[label] = data?.schedule || {};
        } catch (e) {
          out[label] = {};
        }
      });
      await Promise.all(tasks);
      setYearSchedules(out);
    } finally {
      setYearLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode !== "year") return;
    setIsEditMode(false);
    setIsDirty(false);
    clearSelection();
    setEditOpen(false);
    loadYear(selectedYear);
  }, [viewMode, selectedYear]);

  /* ------------------------------------------------ */
  /* INTERACTIONS                                     */
  /* ------------------------------------------------ */

  const toggleEditMode = () => {
    if (!canEdit) return;
    setIsEditMode((prev) => {
      const next = !prev;
      if (!next) {
        clearSelection();
        setEditOpen(false);
        setContextMenu(null);
      }
      return next;
    });
  };

  const handleCellClick = (employeeName: string, day: number, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    selectCell(employeeName, day, modifiers);
    setContextMenu(null);
  };

  const handleCellContextMenu = (e: React.MouseEvent, args: { employeeName: string; day: number; current: string }) => {
    e.preventDefault(); // Ensure native menu is prevented
    if (!isSelected(args.employeeName, args.day)) {
      selectCell(args.employeeName, args.day, { shiftKey: false, ctrlKey: false, metaKey: false });
    }
    // Align menu to the row's top edge (not cursor Y) to prevent visual downward shift.
    // clientX stays as-is (horizontal = cursor position is fine).
    const rowTop = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    setContextMenu({ x: e.clientX, y: rowTop, employeeName: args.employeeName });
  };

  const applyShiftChange = async (value: string) => {
    const keys = getSelectedKeys();
    if (!keys.size) return;

    // [NEW] ABESENCE HANDLING
    if (value === "HISTORY") {
      // Pick the first employee from selection
      const keysArr = Array.from(keys);
      if (keysArr.length > 0) {
        const [emp] = keysArr[0].split("|||");
        setHistoryTarget(emp);
        setHistoryOpen(true);
      }
      setContextMenu(null);
      return;
    }

    if (value === "CONSTRAINTS") {
      const keysArr = Array.from(keys);
      if (keysArr.length > 0) {
        const [emp] = keysArr[0].split("|||");
        setConstraintsTarget(emp);
        setConstraintsOpen(true);
      }
      setContextMenu(null);
      return;
    }

    if (value === "COMPETENCIES") {
      const keysArr = Array.from(keys);
      const emp = keysArr.length > 0
        ? keysArr[0].split("|||")[0]
        : (contextMenu as any)?.employeeName ?? "";
      if (emp) {
        setCompetencyTarget(emp);
        setCompetencyOpen(true);
      }
      setContextMenu(null);
      return;
    }

    if (value.startsWith("ABSENCE:")) {
      const type = value.split(":")[1] as any; // VACATION, SICK...

      // Group by Employee
      const empMap = new Map<string, number[]>();
      for (const k of keys) {
        const [employeeName, dayRaw] = k.split("|||");
        const day = Number(dayRaw);
        if (!employeeName || !Number.isFinite(day)) continue;
        const list = empMap.get(employeeName) ?? [];
        list.push(day);
        empMap.set(employeeName, list);
      }

      if (!window.confirm(`Abwesenheit (${type}) für ${empMap.size} Mitarbeiter erstellen?`)) {
        setContextMenu(null);
        return;
      }

      setLoading(true);
      try {
        for (const [emp, days] of empMap.entries()) {
          // Find continuous ranges? For simplicity, we take min and max day and claim the whole range.
          // Or strictly creates multiple if gaps? 
          // Implementation Plan Assumption: "Create Absence ... Type and End Date (Start matches clicked cell)".
          // Use selection range.
          if (days.length === 0) continue;
          days.sort((a, b) => a - b);

          // Simple approach: One absence from Min to Max.
          // Ideally we check for gaps, but user typically selects a range.
          const minDay = days[0];
          const maxDay = days[days.length - 1];

          const startDate = new Date(Date.UTC(selectedYear, selectedMonthIndex, minDay)).toISOString().split('T')[0];
          const endDate = new Date(Date.UTC(selectedYear, selectedMonthIndex, maxDay)).toISOString().split('T')[0];

          await createAbsence({
            employee_name: emp,
            start_date: startDate,
            end_date: endDate,
            type,
            note: "Via Context Menu"
          });
        }

        // Reload Absences
        alert("Abwesenheit erstellt!");
        const freshAbsences = await fetchAbsences(selectedYear, selectedMonthIndex + 1);
        setAbsences(freshAbsences);
        // Reload Conflicts
        const freshConflicts = await fetchAbsenceConflicts(selectedYear, selectedMonthIndex + 1);
        setAbsenceConflicts(freshConflicts);

      } catch (err) {
        console.error(err);
        alert("Fehler beim Erstellen der Abwesenheit");
      } finally {
        setLoading(false);
        setContextMenu(null);
        clearSelection();
      }
      return;
    }

    if (!window.confirm(`Möchten Sie die Änderung für ${keys.size} ${keys.size === 1 ? 'Eintrag' : 'Einträge'} übernehmen?`)) {
      setContextMenu(null);
      return;
    }

    setSchedule((prev: any) => {
      const next = { ...(prev || {}) };
      for (const k of keys) {
        const [employeeName, dayRaw] = k.split("|||");
        const day = Number(dayRaw);
        if (!employeeName || !Number.isFinite(day)) continue;
        const row = { ...(next[employeeName] || {}) };
        if (!value || value === "") delete row[day];
        else row[day] = value;
        next[employeeName] = row;
      }
      shiftStore.setSchedule(activeMonthLabel, next);
      return next;
    });
    setIsDirty(true);
    setContextMenu(null);
  };

  const applyEdit = () => {
    if (!editTarget) return;
    const { employeeName, day } = editTarget;
    setSchedule((prev: any) => {
      const next = { ...(prev || {}) };
      const row = { ...(next[employeeName] || {}) };
      const value = String(editValue || "").trim().toUpperCase();
      if (!value || value === EMPTY) delete row[day];
      else row[day] = value;
      next[employeeName] = row;
      shiftStore.setSchedule(activeMonthLabel, next);
      return next;
    });
    setIsDirty(true);
    setEditOpen(false);
  };

  const saveChanges = async () => {
    if (!canEdit) return;
    if (!isDirty) return;
    try {
      setLoading(true);
      await importSchedule(activeMonthLabel, schedule);

      // [NEW] Trigger Wellbeing Compute
      if (wellbeingVisible) {
        await wellbeingStore.computeMetrics(selectedYear, monthIndex1);
      }

      // [NEW] Trigger Shift Validation
      validateShiftplan(selectedYear, monthIndex1)
        .then(res => {
          if (res.success) setViolations(res.violations);
        })
        .catch(err => console.error("Validation Error:", err));

      // [NEW] Recompute Staffing
      recomputeStaffing(selectedYear, monthIndex1)
        .then(() => fetchStaffingResults(selectedYear, monthIndex1))
        .then(setStaffingResults)
        .catch(err => console.error("Staffing Recompute Error:", err));

      shiftStore.setSchedule(activeMonthLabel, schedule);
      setIsDirty(false);
      toast.success("Änderungen erfolgreich gespeichert"); // [NEW]
    } catch (err) {
      console.error("SAVE ERROR:", err);
      toast.error("Speichern fehlgeschlagen"); // [NEW]
    } finally {
      setLoading(false);
    }
  };

  const openExcelDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const yearMatch = file.name.match(/(20\d{2})/);
    if (!yearMatch) {
      alert("Dateiname muss ein Jahr enthalten (z. B. 2026)");
      return;
    }
    const importYear = Number(yearMatch[1]);

    try {
      setImporting(true);
      const rawPlans = await parseShiftplanExcel(file);
      const normalized = normalizePlansByMonth(rawPlans, importYear);

      for (const { label, plan } of normalized) {
        const parsed: Record<string, Record<number, string>> = {};
        for (const emp of plan.employees || []) {
          const dayMap: Record<number, string> = {};
          for (const [dayKey, shiftCode] of Object.entries(emp.shifts)) {
            const day = Number(dayKey);
            if (!Number.isFinite(day)) continue;
            if (shiftCode) dayMap[day] = String(shiftCode).trim();
          }
          if (Object.keys(dayMap).length > 0) parsed[emp.name] = dayMap;
        }
        await importSchedule(label, parsed);
      }
      await refreshMonths();
      if (viewMode === "year") await loadYear(selectedYear);
      else await loadSchedule(activeMonthLabel);
    } catch (err) {
      console.error("IMPORT ERROR:", err);
      alert("Fehler beim Excel-Import");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // [NEW] EXPORT
  const handleExport = async () => {
    try {
      setLoading(true);
      const res = await generateReport(selectedYear, selectedMonthIndex + 1);
      if (res.success && res.reportId) {
        await downloadReport(res.reportId);
      }
    } catch (e) {
      console.error("EXPORT FAILED:", e);
      alert("Export fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------ */
  /* RENDER                                           */
  /* ------------------------------------------------ */

  // REMOVED: h-[calc(100vh-20px)] overflow-hidden => allowed page scroll
  return (
    <EnterprisePageShell className="pb-20">
      {/* HIDDEN FILE INPUT */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".xls,.xlsx,.xlsm"
        onChange={handleExcelImport}
      />

      {/* HEADER */}
      <EnterpriseHeader
        title="SCHICHTPLAN"
        icon={<Calendar className="w-5 h-5 text-indigo-400" />}
        rightContent={
          <div className="flex items-center gap-2 flex-wrap">
            <RamadanBadge
              meta={ramadanMeta}
              timings={ramadanTimings}
              loading={ramadanLoading}
              isActive={showRamadanOverlay}
              onToggle={() => {
                const newState = !showRamadanOverlay;
                setShowRamadanOverlay(newState);
                setShowSunTimesHints(newState);
              }}
            />

            {/* FEIERTAGE BUTTON: left-click toggles overlay, right-click shows list */}
            <div className="relative">
              <Button
                variant={showHolidayOverlay ? "default" : "secondary"}
                size="sm"
                className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${showHolidayOverlay ? 'bg-indigo-600/80 hover:bg-indigo-600 text-white border-transparent' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm'}`}
                onClick={() => setShowHolidayOverlay(v => !v)}
                onContextMenu={(e) => { e.preventDefault(); setHolidayListOpen(v => !v); }}
                title="Feiertage (Hessen) – Links: overlay, Rechts: Liste"
              >
                {showHolidayOverlay ? "Feiertage: an" : "Feiertage"}
              </Button>
              {holidayListOpen && (
                <div className="absolute top-full left-0 mt-1 z-[100] bg-[#0c1428] border border-indigo-500/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] p-3 min-w-[240px] max-h-80 overflow-auto">
                  <div className="text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wider">Feiertage Hessen {selectedYear}</div>
                  <div className="space-y-1">
                    {Object.entries(holidayMap)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([date, name]) => (
                        <div key={date} className="flex items-center justify-between gap-3 text-xs text-white py-0.5">
                          <span className="font-mono text-indigo-300 shrink-0">{date.slice(5).split('-').reverse().join('.')}</span>
                          <span className="font-medium">{name}</span>
                        </div>
                      ))}
                  </div>
                  <button onClick={() => setHolidayListOpen(false)} className="mt-3 text-xs text-indigo-400 hover:text-white w-full text-right transition">Schließen ×</button>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-white/10 mx-1" />

            <Button
              variant={warningsVisible ? "default" : "secondary"}
              size="sm"
              className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${warningsVisible ? 'bg-red-500/80 hover:bg-red-500 text-white border-transparent' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm'}`}
              onClick={() => setWarningsVisible(!warningsVisible)}
            >
              {warningsVisible ? "Warnungen: an" : "Warnungen"}
            </Button>

            <Button
              variant={wellbeingVisible ? "default" : "secondary"}
              size="sm"
              className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${wellbeingVisible ? 'bg-blue-500/80 hover:bg-blue-500 text-white border-transparent' : 'bg-white/5 hover:bg-white/10 text-blue-400 border border-blue-500/30 auto shadow-sm'}`}
              onClick={() => setWellbeingVisible(!wellbeingVisible)}
            >
              Wellbeing
            </Button>

            <Button
              variant={hiddenPanelVisible ? "default" : "secondary"}
              size="sm"
              className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${hiddenPanelVisible ? 'bg-sky-600/80 hover:bg-sky-600 text-white border-transparent' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm'}`}
              onClick={() => setHiddenPanelVisible(!hiddenPanelVisible)}
            >
              {hiddenPanelVisible ? `Ausgebl.: ${hiddenEmployees.size}` : `Ausgebl. (${hiddenEmployees.size})`}
            </Button>

            {canEdit && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <Button
                  size="sm"
                  className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-green-600/80 hover:bg-green-600 text-white disabled:opacity-50"
                  onClick={saveChanges}
                  disabled={!isDirty || loading}
                >
                  Speichern
                </Button>
              </>
            )}

            <div className="w-px h-5 bg-white/10 mx-1" />

            <ExportMenu
              currentYear={selectedYear}
              currentMonth={selectedMonthIndex + 1}
              loading={loading}
              changelogExists={changelogExists}
            />

            <ShiftImportDialog
              onImportSuccess={() => {
                if (viewMode === "year") loadYear(selectedYear);
                else loadSchedule(activeMonthLabel);
                refreshMonths();
              }}
            />
          </div>
        }
      />

      {/* VIEW TABS */}
      <EnterpriseCard className="!py-2 !px-3 bg-black/20" noPadding={false}>
        <div className="flex items-center gap-1">
          {(["plan", "neustarter"] as const).map(view => {
            const labels: Record<string, string> = { plan: "Schichtplan", neustarter: "Neustarter" };
            const active = view === mainView;
            return (
              <button
                key={view}
                onClick={() => setMainView(view)}
                className={`
                  px-4 py-1.5 text-[11px] rounded-md transition-all font-bold uppercase tracking-wider
                  whitespace-nowrap border
                  ${active
                    ? "bg-indigo-600/90 text-white shadow-sm border-indigo-500"
                    : "text-muted-foreground/50 border-white/5 bg-white/5 hover:bg-white/10"
                  }
                `}
              >
                {labels[view]}
              </button>
            );
          })}
        </div>
      </EnterpriseCard>

      {/* ── PLAN VIEW ── */}
      {mainView === "plan" && (<>

      {/* MONTH NAVIGATION */}
      <EnterpriseCard className="flex items-center justify-center relative !py-2 !px-4 bg-black/20" noPadding={false}>
        <div className="absolute left-4 flex items-center gap-2 p-1 rounded-md bg-white/5 border border-white/10">
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10 hover:text-white text-muted-foreground" onClick={() => setSelectedYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold min-w-[3rem] text-center text-white">{selectedYear}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10 hover:text-white text-muted-foreground" onClick={() => setSelectedYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-x">
          {Array.from({ length: 12 }).map((_, idx) => {
            const label = formatMonthLabel(selectedYear, idx + 1, locale);
            const active = idx === selectedMonthIndex;
            const hasData = monthsWithData.includes(label);

            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedMonthIndex(idx);
                  if (viewMode === "year") {
                    const el = document.getElementById(`shiftplan-month-${idx + 1}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={`
                            px-4 py-1.5 text-[11px] rounded-md transition-all font-bold uppercase tracking-wider whitespace-nowrap border
                            ${active
                    ? "bg-indigo-600/90 text-white shadow-sm border-indigo-500"
                    : hasData
                      ? "text-emerald-400/90 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20"
                      : "text-muted-foreground/50 border-white/5 bg-white/5 hover:bg-white/10"
                  }
                          `}
              >
                {label.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </EnterpriseCard>

      {/* PANELS */}
      {
        (warningsVisible || hiddenPanelVisible || statsVisible || wellbeingVisible) && (
          <div className="flex flex-col gap-4">

            {/* WELLBEING / FAIRNESS PANEL */}
            {wellbeingVisible && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-blue-400">Wellbeing</h3>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleComputeWellbeing} disabled={wellbeingStore.loading}>
                      {wellbeingStore.loading ? <RefreshCw className="animate-spin w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                      <span className="ml-1">Aktualisieren</span>
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Grenzwerte: Nacht {wellbeingStore.config?.night_threshold || 4},
                    WE {wellbeingStore.config?.weekend_threshold || 2},
                    Streak {wellbeingStore.config?.streak_threshold || 7}
                  </div>
                </div>

                {/* TOP CRITICAL EMPLOYEES */}
                {topCriticalEmployees.length > 0 ? (
                  <div className="space-y-1">
                    {topCriticalEmployees.map((emp) => (
                      <div key={emp.employee_name} className="flex items-center justify-between bg-background/50 p-2 rounded text-sm">
                        <span className="font-medium">{emp.employee_name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          {emp.night_count > (wellbeingStore.config?.night_threshold || 4) && (
                            <span className="bg-red-500/20 text-red-500 px-1 rounded">{emp.night_count} Nacht</span>
                          )}
                          {emp.weekend_count > (wellbeingStore.config?.weekend_threshold || 2) && (
                            <span className="bg-orange-500/20 text-orange-500 px-1 rounded">{emp.weekend_count} WE</span>
                          )}
                          {emp.max_streak > (wellbeingStore.config?.streak_threshold || 7) && (
                            <span className="bg-yellow-500/20 text-yellow-500 px-1 rounded">{emp.max_streak} Streak</span>
                          )}
                          <span className="font-bold text-blue-300">Score: {emp.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-green-400">Alles im grünen Bereich!</div>
                )}
              </div>
            )}

            {/* STATS PANEL */}
            {statsVisible && (
              <div className="bg-card rounded-xl border p-0 overflow-hidden">
                <ShiftStatsPanel stats={monthlyStats} />
              </div>
            )}

            {warningsVisible && warningsSummary.total > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-red-400 font-medium">Unterbesetzung erkannt ({warningsSummary.total})</span>
                </div>

                {/* LIST OF WARNINGS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  {warningsComputed.map((w, idx) => (
                    <div key={idx} className="text-xs bg-red-500/10 p-2 rounded border border-red-500/20 flex flex-col">
                      <span className="font-bold text-red-300">{w.label} – {w.dateKey}</span>
                      <span className="text-muted-foreground">{w.kind.toUpperCase()} (Ist: {w.actual} / Soll: {w.target})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hiddenPanelVisible && (
              <div className="bg-secondary/20 border rounded-xl p-3 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">Ausgeblendet:</span>
                {Array.from(hiddenEmployees).map(name => (
                  <span key={name} className="px-2 py-0.5 bg-background rounded border text-xs flex items-center gap-1">
                    {name}
                    <button className="hover:text-red-400" onClick={() => unhideEmployee(name)}>×</button>
                  </span>
                ))}
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={unhideAll}>Alle zeigen</Button>
              </div>
            )}
          </div>
        )
      }

      {/* MAIN CONTENT */}
      <EnterpriseCard noPadding className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {viewMode === "month" && (
          <>
            <div className="flex-1 min-h-0 relative">
              <ShiftplanTable
                schedule={visibleSchedule}
                daysInMonth={daysInMonth}
                loading={loading}
                year={selectedYear}
                monthIndex1={selectedMonthIndex + 1}
                holidays={showHolidayOverlay ? holidays as any : {}}
                warnings={warningsForMonthTable}
                isEditMode={isEditMode}
                onCellClick={handleCellClick}
                selectedCells={getSelectedKeys()}
                onCellContextMenu={handleCellContextMenu}
                onHideEmployee={hideEmployee}
                employeeHours={employeeHours}
                highlightRequest={highlightRequest}
                // [NEW] Pass metrics
                // [NEW] Coverage Props
                showSkillsOverlay={showSkills}
                employeeSkills={employeeSkills}
                coverageViolations={coverageViolations}
                // [NEW] Staffing
                staffingResults={staffingResults}
                // [NEW] Absences
                absences={absences}
                absenceConflicts={absenceConflicts}
                constraintsMap={constraintsMap}
                constraintViolations={constraintViolations}
                // [NEW] Ramadan Props
                ramadanMeta={ramadanMeta}
                ramadanTimings={ramadanTimings}
                showRamadanOverlay={showRamadanOverlay}
                showSunTimesHints={showSunTimesHints}
              />
              {contextMenu && (
                <ShiftContextMenu
                  x={contextMenu!.x}
                  y={contextMenu!.y}
                  employeeName={contextMenu!.employeeName || ""} // [NEW] Pass Name
                  selectedCount={getSelectedKeys().size}
                  onClose={() => setContextMenu(null)}
                  onSelect={applyShiftChange}
                />
              )}
            </div>
          </>
        )}
        {viewMode === "year" && (
          <div className="flex-1 overflow-auto p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Placeholder for Year View */}
              <div className="col-span-full text-center text-muted-foreground py-20">
                Jahresübersicht Implementierung folgt...
              </div>
            </div>
          </div>
        )}
      </EnterpriseCard>

      </>)}

      {/* ── NEUSTARTER VIEW ── */}
      {mainView === "neustarter" && (
        <EnterpriseCard noPadding={false} className="flex-1 min-h-0" style={{ minHeight: "60vh" }}>
          <NewStartersTab />
        </EnterpriseCard>
      )}

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schicht ändern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Mitarbeiter</label>
                <div className="font-medium">{editTarget?.employeeName}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Datum</label>
                <div className="font-medium">{editTarget?.day}. {activeMonthLabel}</div>
              </div>
            </div>
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger>
                <SelectValue placeholder="Schicht wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>(Leer / Löschen)</SelectItem>
                <SelectItem value="E1">E1 (Früh 1)</SelectItem>
                <SelectItem value="E2">E2 (Früh 2)</SelectItem>
                <SelectItem value="L1">L1 (Spät 1)</SelectItem>
                <SelectItem value="L2">L2 (Spät 2)</SelectItem>
                <SelectItem value="N">N  (Nacht)</SelectItem>
                <SelectItem value="FS">FS (Frei/WE)</SelectItem>
                <SelectItem value="ABW">ABW (Abwesend)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={applyEdit}>Übernehmen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        year={selectedYear}
        month={selectedMonthIndex + 1}
        employeeName={historyTarget}
      />

      <ConstraintDialog
        open={constraintsOpen}
        onOpenChange={setConstraintsOpen}
        employeeName={constraintsTarget}
        onSave={() => loadData(selectedYear, selectedMonthIndex + 1)}
      />

      <CompetencyModal
        employeeName={competencyTarget}
        isOpen={competencyOpen}
        onClose={() => setCompetencyOpen(false)}
      />
    </EnterprisePageShell>
  );
}

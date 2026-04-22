/* ------------------------------------------------ */
/* DASHBOARD – Tagesgeschäft-Light (Refined)        */
/* ------------------------------------------------ */

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { AlertTriangle, Clock, Filter, Ticket, Users, Check, MessageSquare, X, ChevronRight, ChevronDown, RefreshCw, BarChart2 as ChartIcon } from "lucide-react";
import { CopyTicketButton } from "../common/CopyTicketButton";
import { EnterprisePageShell, EnterpriseHeader, EnterpriseCard, ENT_CARD_BASE, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

/* AUTH */
import { useAuth } from "../../context/AuthContext";
import { getUserDisplayName } from "../../utils/userDisplay";

/* STORES */
import { EARLY_SHIFT_CODES, LATE_SHIFT_CODES, useShiftStore, shiftTypes, type Employee } from "../../store/shiftStore";
import { useCommitStore } from "../../store/commitStore";
import { useEmployeeMetaStore } from "../../store/employeeMetaStore";
import { calcCommitHours } from "../commit/commit.logic";
import { getRemainingMs, getColorTier, tierClasses, tierGlow, getTicketSortKey, formatRemainingTime } from "../../utils/ticketColors";
import { computeUnderstaffWarnings } from "../shiftplan/shiftplan.warnings";

/* HELPERS */
import { usePersistentToggle } from "../../hooks/usePersistentToggle";
import { useHiddenEmployees } from "../../hooks/useHiddenEmployees";
import { api } from "../../api/api"; // Added missing import
import { useCrawlerStaleness } from "../../hooks/useCrawlerStaleness";
import { useWeekplanRoleStore, WEEKPLAN_ROLES, getRoleDef } from "../../store/weekplanRoleStore";
import { getLanguageLocale, useLanguage, type LanguageCode } from "../../context/LanguageContext";

/* UI */
import { DateTimeBadge } from "../ui/DateTimeBadge";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useDashboardData } from "../../hooks/useDashboardData";
import { useRealtimeUpdates } from "../../hooks/useRealtimeUpdates";
// DashboardInfoBar and DashboardToggles are now rendered in Header modals

const DASHBOARD_COPY: Partial<Record<LanguageCode, {
  greeting: string;
  startsIn: string;
  from: string;
  endsIn: string;
  until: string;
  ended: string;
  noData: string;
  showLess: string;
  showMore: string;
  loadingStats: string;
  ticketTypes: string;
  commitHealth: string;
  ticketStatus: string;
  earlyShift: string;
  lateShift: string;
  nightShift: string;
  staffingOk: string;
  understaffing: string;
  understaffingDetails: string;
  today: string;
  noUnderstaffing: string;
  warning: string;
  commitToday: string;
  commitTodayTitle: string;
  serviceToday: string;
  ownersOnly: string;
  activeOnly: string;
  warnings: string;
  criticalOnly: string;
  noShifts: string;
  activity: string;
  owner: string;
  employeesLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  removeRole: string;
  remainingTime: string;
  systemName: string;
  scheduled: string;
  revisedCommit: string;
  assignCategory: string;
  projectCategory: string;
  dbsProjectCategory: string;
  newJoinersCategory: string;
  clearCategory: string;
}>> = {
  de: {
    greeting: "Hallo",
    startsIn: "Beginnt in",
    from: "ab",
    endsIn: "Endet in",
    until: "bis",
    ended: "Beendet",
    noData: "Keine Daten",
    showLess: "Weniger anzeigen",
    showMore: "weitere anzeigen",
    loadingStats: "Lade Statistiken...",
    ticketTypes: "Tickertypes",
    commitHealth: "Commit Health",
    ticketStatus: "Ticket Status",
    earlyShift: "Frühschicht",
    lateShift: "Spätschicht",
    nightShift: "Nachtschicht",
    staffingOk: "Besetzung OK",
    understaffing: "Unterbesetzung",
    understaffingDetails: "Unterbesetzung Details",
    today: "Heute",
    noUnderstaffing: "Keine Unterbesetzung erkannt.",
    warning: "Warnung",
    commitToday: "Terminiert heute",
    commitTodayTitle: "COMMIT ≤ 72h / HEUTE",
    serviceToday: "DIENST HEUTE",
    ownersOnly: "Nur Ticket-Owner",
    activeOnly: "Nur Aktive",
    warnings: "Warnungen",
    criticalOnly: "Nur Kritische",
    noShifts: "Keine Schichten verfügbar",
    activity: "Aktivität",
    owner: "Owner",
    employeesLabel: "MA",
    activeLabel: "AKTIV",
    inactiveLabel: "INAKTIV",
    removeRole: "ROLLE ENTFERNEN",
    remainingTime: "Restzeit",
    systemName: "Systemname",
    scheduled: "Terminiert",
    revisedCommit: "Geänderter Commit",
    assignCategory: "Kategorie zuweisen",
    projectCategory: "Projekt",
    dbsProjectCategory: "DBS Projekt",
    newJoinersCategory: "Neueinsteiger",
    clearCategory: "Zurücksetzen",
  },
  en: {
    greeting: "Hello",
    startsIn: "Starts in",
    from: "from",
    endsIn: "Ends in",
    until: "until",
    ended: "Ended",
    noData: "No data",
    showLess: "Show less",
    showMore: "more",
    loadingStats: "Loading statistics...",
    ticketTypes: "Ticket types",
    commitHealth: "Commit health",
    ticketStatus: "Ticket status",
    earlyShift: "Early shift",
    lateShift: "Late shift",
    nightShift: "Night shift",
    staffingOk: "Staffing OK",
    understaffing: "Understaffing",
    understaffingDetails: "Understaffing details",
    today: "Today",
    noUnderstaffing: "No understaffing detected.",
    warning: "Warning",
    commitToday: "Scheduled today",
    commitTodayTitle: "COMMIT ≤ 72h / TODAY",
    serviceToday: "SERVICE TODAY",
    ownersOnly: "Ticket owners only",
    activeOnly: "Active only",
    warnings: "Warnings",
    criticalOnly: "Critical only",
    noShifts: "No shifts available",
    activity: "Activity",
    owner: "Owner",
    employeesLabel: "Employees",
    activeLabel: "ACTIVE",
    inactiveLabel: "INACTIVE",
    removeRole: "REMOVE ROLE",
    remainingTime: "Remaining time",
    systemName: "System name",
    scheduled: "Scheduled",
    revisedCommit: "Revised commit",
    assignCategory: "Assign category",
    projectCategory: "Project",
    dbsProjectCategory: "DBS project",
    newJoinersCategory: "New joiners",
    clearCategory: "Reset",
  },
};

/* ------------------------------------------------ */
/* HELPERS                                          */
/* ------------------------------------------------ */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDuration(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function buildRangeForToday(timeRange: string, base: Date) {
  const [s, e] = timeRange.split("-").map((x) => x.trim());
  if (!s || !e) return null;

  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return null;

  const start = new Date(base);
  start.setHours(sh, sm, 0, 0);

  const end = new Date(base);
  end.setHours(eh, em, 0, 0);

  // falls Ende am Folgetag liegt (z.B. 15:00-00:00 oder N 21:15-06:45)
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

function timerLabel(now: Date, range: { start: Date; end: Date } | null, copy: NonNullable<(typeof DASHBOARD_COPY)["en"]>) {
  if (!range) return "—";

  const { start, end } = range;

  if (now.getTime() < start.getTime()) {
    return `${copy.startsIn} ${formatDuration(start.getTime() - now.getTime())} (${copy.from} ${pad2(
      start.getHours()
    )}:${pad2(start.getMinutes())})`;
  }

  if (now.getTime() <= end.getTime()) {
    // "Endet in ..." logic
    const diff = end.getTime() - now.getTime();
    return `${copy.endsIn} ${formatDuration(diff)} (${copy.until} ${pad2(end.getHours())}:${pad2(end.getMinutes())})`;
  }

  return `${copy.ended} (${pad2(end.getHours())}:${pad2(end.getMinutes())})`;
}

function isRangeActive(now: Date, range: { start: Date; end: Date } | null) {
  if (!range) return false;
  return now.getTime() >= range.start.getTime() && now.getTime() <= range.end.getTime();
}

function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/* ------------------------------------------------ */
/* SUB-COMPONENTS                                   */
/* ------------------------------------------------ */

function EmployeeItem({
  employee,
  ticketsByOwner,
  criticalTicketsByOwner,
  showOnlyCritical,
  crawlerStale,
  todayDateStr,
}: {
  employee: Employee;
  ticketsByOwner: Map<string, any[]>;
  criticalTicketsByOwner: Map<string, any[]>;
  showOnlyCritical: boolean;
  crawlerStale?: boolean;
  todayDateStr?: string;
}) {
  const { language } = useLanguage();
  const copy = DASHBOARD_COPY[language] || DASHBOARD_COPY.en!;
  const { setCategory, getCategory } = useEmployeeMetaStore();
  const currentCategory = getCategory(employee.name);
  const [expanded, setExpanded] = useState(false);
  const categoryOptions = [
    { value: "CC", label: "CC" },
    { value: "Projekt", label: copy.projectCategory },
    { value: "DBS Projekt", label: copy.dbsProjectCategory },
    { value: "SH", label: "SH" },
    { value: "Other", label: "Other" },
    { value: "Neueinsteiger", label: copy.newJoinersCategory },
  ];
  const currentCategoryLabel = categoryOptions.find((option) => option.value === currentCategory)?.label || currentCategory;

  // Weekplan role for this employee today
  const { getRole, setRole: setWeekplanRole, removeRole } = useWeekplanRoleStore();
  const currentRole = todayDateStr ? getRole(employee.name, todayDateStr) : undefined;
  const roleDef = currentRole ? getRoleDef(currentRole) : undefined;

  // Render logic for tickets
  const renderOwnerTickets = () => {
    // Crawler stale guard: hide tickets when crawler data is unreliable
    if (crawlerStale) {
      return (
        <div className="mt-2 px-2 py-3 text-center">
          <div className="text-red-400 font-bold text-[0.85em] uppercase tracking-wider">
            {language === 'de' ? 'KEINE AKTUELLEN CRAWLER-DATEN' : 'NO RECENT CRAWLER DATA INPUT'}
          </div>
        </div>
      );
    }

    const list = showOnlyCritical
      ? (criticalTicketsByOwner.get(employee.name) ?? [])
      : (ticketsByOwner.get(employee.name) ?? []);

    if (list.length === 0) {
      return (
        <div className="text-[13px] text-[#4b5563] px-2 pb-2">
          {copy.noData}
        </div>
      );
    }

    const visibleList = expanded ? list : list.slice(0, 4);

    return (
      <div className="mt-2 space-y-1">
        {/* Header for Ticket Grid */}
        <div className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr] gap-2 px-2 py-1 text-[0.7em] uppercase font-bold text-muted-foreground/80 border-b border-white/5 bg-black/40 rounded-t-sm tracking-wider">
          <div>ID</div>
          <div>{language === 'de' ? 'System' : 'System'}</div>
          <div>{copy.activity}</div>
          <div className="text-right">{copy.remainingTime}</div>
        </div>

        {/* Ticket Rows */}
        <div className="space-y-1 pt-1">
          {visibleList.map((t: any) => {
            const uniqueKey = String(t.id ?? t.external_id ?? Math.random());
            const displayIdRaw = String(t.ticketNumber ?? t.ticket ?? t.external_id ?? t.number ?? "").trim();
            if (!displayIdRaw || /^\d{1,5}$/.test(displayIdRaw)) return null;

            const displayId = displayIdRaw;
            const sysName = String(t.system_name ?? t.systemName ?? "—").trim();
            const activity = String(t.activity ?? t.activityType ?? t.subtype ?? "—").trim();
            const ms = getRemainingMs(t);
            const time = ms !== null ? formatRemainingTime(ms) : "";
            const tTier = getColorTier(ms);
            const tierColor = tierClasses[tTier];

            return (
              <div
                key={`${employee.name}-${uniqueKey}`}
                data-testid="employee-ticket-grid"
                className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr] gap-2 px-2 py-1.5 items-center bg-black/20 rounded-sm hover:bg-black/40 border border-white/2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors mb-0.5"
              >
                <div className="truncate font-medium flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 text-[0.95em] rounded ${tierColor} text-white font-mono`}>
                    {displayId}
                  </span>
                  <CopyTicketButton ticketId={displayId} />
                </div>
                <div className="text-muted-foreground text-[0.9em] wrap-break-word whitespace-normal leading-snug" title={sysName}>{sysName}</div>
                <div className="text-muted-foreground text-[0.9em] wrap-break-word whitespace-normal leading-snug" title={activity}>{activity}</div>
                <div className={`text-right font-bold font-mono text-[0.9em] ${ms !== null && ms < 0 ? "text-red-400" : "text-white/90"}`}>
                  {time}
                </div>
              </div>
            );
          })}
        </div>

        {list.length > 4 ? (
          <div
            className="text-[0.75em] text-muted-foreground cursor-pointer hover:text-white mt-1 pt-1 select-none flex items-center justify-center gap-1 border-t border-white/5"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <>
                <ChevronDown className="w-3 h-3" /> {copy.showLess}
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3" /> +{list.length - 4} {copy.showMore}
              </>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const owned = ticketsByOwner.get(employee.name) ?? [];

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div className="theme-glass-panel group rounded-xl border border-indigo-500/20 px-4 py-3 select-none transition-all hover:border-indigo-500/50 hover:bg-accent/70 hover:shadow-[0_8px_24px_rgba(59,130,246,0.15)]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[1.05em] font-bold text-foreground transition-colors tracking-wide">{employee.name}</div>
              {currentCategory && (
                <div className="bg-indigo-500/20 text-indigo-300 text-[0.65em] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-extrabold border border-indigo-500/30">
                  {currentCategoryLabel}
                </div>
              )}
              {roleDef && (
                <div className={`text-[0.6em] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-extrabold border ${roleDef.color}`}>
                  {roleDef.label}
                </div>
              )}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Tickets <span className="theme-glass-inset ml-1 rounded px-1.5 py-0.5 text-foreground">{owned.length}</span>
            </div>
          </div>
          {renderOwnerTickets()}
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="theme-popover-surface min-w-45 rounded-md border p-1 shadow-md animate-in fade-in-80 z-50">
          <ContextMenu.Label className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {copy.assignCategory}
          </ContextMenu.Label>
          <ContextMenu.Separator className="theme-divider my-1 h-px" />

          {categoryOptions.map((cat) => (
            <ContextMenu.Item
              key={cat.value}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 pl-8 text-[0.9em] outline-none focus:bg-accent focus:text-foreground"
              onSelect={() => setCategory(employee.name, cat.value === currentCategory ? "" : cat.value)}
            >
              {currentCategory === cat.value && (
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <Check className="h-4 w-4" />
                </span>
              )}
              {cat.label}
            </ContextMenu.Item>
          ))}

          <ContextMenu.Separator className="theme-divider my-1 h-px" />
          <ContextMenu.Item
            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 pl-8 text-[0.9em] outline-none focus:bg-accent focus:text-foreground"
            onSelect={() => setCategory(employee.name, "")}
          >
            {currentCategory === "" || !currentCategory ? (
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <Check className="h-4 w-4" />
              </span>
            ) : null}
            {copy.clearCategory}
          </ContextMenu.Item>

          {/* ROLLE ZUWEISEN */}
          {todayDateStr && (
            <>
              <ContextMenu.Separator className="theme-divider my-1 h-px" />
              <ContextMenu.Label className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                ROLLE ZUWEISEN
              </ContextMenu.Label>
              <ContextMenu.Separator className="theme-divider my-1 h-px" />

              {WEEKPLAN_ROLES.map((role) => (
                <ContextMenu.Item
                  key={role.key}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 pl-8 text-[0.9em] outline-none focus:bg-accent focus:text-foreground"
                  onSelect={() => {
                    if (currentRole === role.key) {
                      removeRole(employee.name, todayDateStr);
                    } else {
                      setWeekplanRole(employee.name, todayDateStr, role.key);
                    }
                  }}
                >
                  {currentRole === role.key && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  {role.label}
                </ContextMenu.Item>
              ))}

                <ContextMenu.Separator className="theme-divider my-1 h-px" />
              <ContextMenu.Item
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 pl-8 text-[0.9em] outline-none focus:bg-accent focus:text-foreground"
                onSelect={() => {
                  if (currentRole) removeRole(employee.name, todayDateStr);
                }}
              >
                {!currentRole ? (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
                {copy.removeRole}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function ShiftCodeGroup({
  code,
  item,
  now,
  showOnlyActiveShifts,
  ticketsByOwner,
  criticalTicketsByOwner,
  showOnlyCritical,
  crawlerStale,
  todayDateStr,
}: {
  code: string;
  item: any;
  now: Date;
  showOnlyActiveShifts: boolean;
  ticketsByOwner: Map<string, any[]>;
  criticalTicketsByOwner: Map<string, any[]>;
  showOnlyCritical: boolean;
  crawlerStale?: boolean;
  todayDateStr?: string;
}) {
  const { language } = useLanguage();
  const copy = DASHBOARD_COPY[language] || DASHBOARD_COPY.en!;
  const { employees, range, active, ownersWithTickets, topOwners } = item;
  const info = shiftTypes[code];
  const ticketCount = (employees ?? []).reduce(
    (acc: number, e: any) => acc + (ticketsByOwner.get(e.name)?.length ?? 0),
    0
  );

  return (
    <div className="theme-glass-panel rounded-lg border overflow-hidden flex flex-col">
      <div className="flex flex-none items-center justify-between border-b border-border/50 bg-background/70 px-2 py-1.5 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`rounded-md px-2 py-0.5 text-[0.85em] font-semibold text-foreground ${info?.color ?? "bg-slate-600"}`}
          >
            {code}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{timerLabel(now, range, copy)}</span>
          {showOnlyActiveShifts ? null : (
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {active ? `• ${copy.activeLabel}` : `• ${copy.inactiveLabel}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[0.85em] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Ticket className="w-3 h-3" />
            <span className="font-semibold text-foreground">{ticketCount}</span>
          </span>
        </div>
      </div>

      <div className="px-2 pb-2 space-y-1 mt-1">
        {(employees?.length ?? 0) === 0 ? (
          <div className="py-1 text-[13px] text-muted-foreground">{copy.noData}</div>
        ) : (
          (employees ?? []).map((e: any) => (
            <EmployeeItem
              key={e.name}
              employee={e}
              ticketsByOwner={ticketsByOwner}
              criticalTicketsByOwner={criticalTicketsByOwner}
              showOnlyCritical={showOnlyCritical}
              crawlerStale={crawlerStale}
              todayDateStr={todayDateStr}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ShiftGroup({
  group,
  ticketsByOwner,
  criticalTicketsByOwner,
  now,
  showOnlyActiveShifts,
  showOnlyCritical,
  crawlerStale,
  todayDateStr,
}: {
  group: any;
  ticketsByOwner: Map<string, any[]>;
  criticalTicketsByOwner: Map<string, any[]>;
  now: Date;
  showOnlyActiveShifts: boolean;
  showOnlyCritical: boolean;
  crawlerStale?: boolean;
  todayDateStr?: string;
}) {
  const { language } = useLanguage();
  const copy = DASHBOARD_COPY[language] || DASHBOARD_COPY.en!;
  const groupEmployees = group.items.reduce((acc: number, it: any) => acc + (it.employees?.length ?? 0), 0);
  const groupTickets = group.items.reduce(
    (acc: number, it: any) =>
      acc + (it.employees ?? []).reduce((a: number, e: any) => a + (ticketsByOwner.get(e.name)?.length ?? 0), 0),
    0
  );

  return (
    <div className="stat-card" style={{ ...ENT_CARD_BASE, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 flex-none bg-white/2">
        <div style={ENT_SECTION_TITLE} className="mb-0! uppercase tracking-wider">{group.title}</div>
        <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>{groupEmployees} {copy.employeesLabel}</span>
          <span className="text-white/20">•</span>
          <span>{groupTickets} Tickets</span>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2 mt-2 flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-white/10">
        {group.items.map((item: any) => (
          <ShiftCodeGroup
            key={item.code}
            code={item.code}
            item={item}
            now={now}
            showOnlyActiveShifts={showOnlyActiveShifts}
            ticketsByOwner={ticketsByOwner}
            criticalTicketsByOwner={criticalTicketsByOwner}
            showOnlyCritical={showOnlyCritical}
            crawlerStale={crawlerStale}
            todayDateStr={todayDateStr}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* KPI TILE (collapsible)                           */
/* ------------------------------------------------ */

function KpiTile({ icon, title, count, children, className }: {
  icon: React.ReactNode;
  title: string;
  count: number | string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`theme-glass-panel rounded-xl border overflow-hidden flex flex-col ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/60 flex-none"
      >
        <div className="text-[0.8em] text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[1.5em] font-semibold">{count}</div>
          {children ? (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : null}
        </div>
      </button>
      {open && children && (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto border-t border-border/50 px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ */
/* HELPER: Shift Classification                     */
/* ------------------------------------------------ */
function getShiftInfoForTime(date: Date) {
  const h = date.getHours();
  if (h >= 6 && h < 14) return { code: "E", label: "Early", color: "bg-amber-500" };
  if (h >= 14 && h < 22) return { code: "L", label: "Late", color: "bg-blue-500" };
  return { code: "N", label: "Night", color: "bg-slate-600" };
}

/* ------------------------------------------------ */
/* STATISTICS PANEL (Modal Content)                 */
/* ------------------------------------------------ */
/* ------------------------------------------------ */
/* STATISTICS PANEL (Card Content - DONUTS Only)    */
/* ------------------------------------------------ */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = {
  types: { sh: "#3b82f6", tt: "#ef4444", cc: "#f59e0b" },
  status: {
    dispatch: "#f97316", // Orange
    accepted: "#3b82f6", // Blue
    wip: "#10b981", // Green
    closed: "#64748b", // Slate
    unknown: "#78716c", // Stone
    // Fallbacks
    _default: [
      "#8b5cf6", // Violet
      "#ec4899", // Pink
      "#06b6d4", // Cyan
      "#eab308", // Yellow
    ]
  },
  health: { ok: "#10b981", expired: "#ef4444" }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const total = data.payload.totalVal || 1;
    const val = data.value;
    const percent = ((val / total) * 100).toFixed(0);

    return (
      <div className="theme-popover-surface z-50 rounded border p-2 text-[0.85em] shadow-xl">
        <div className="mb-1 font-semibold text-foreground">{data.name}</div>
        <div className="text-foreground">
          {val} <span className="text-muted-foreground">({percent}%)</span>
        </div>
      </div>
    );
  }
  return null;
};

function StatisticsPanel() {
  const { language } = useLanguage();
  const copy = DASHBOARD_COPY[language] || DASHBOARD_COPY.en!;
  // data.status is now a Map<string, number>
  const [data, setData] = useState<{ types: any, status: Record<string, number>, health: any }>({ types: {}, status: {}, health: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[StatisticsPanel] Mounting, starting fetch...");
    setLoading(true);
    // Use top-level api import directly
    api.get("/stats/weekly-pie")
      .then(res => {
        console.log("[StatisticsPanel] Success:", res.data);
        setData(res.data);
      })
      .catch(e => {
        console.error("[StatisticsPanel] Stats load failed", e);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-[0.9em] text-muted-foreground">{copy.loadingStats}</div>;

  // Prepare Data helpers
  const prep = (obj: any, keys: string[], labels: string[], colors: string[]) => {
    const totalVal = keys.reduce((a, k) => a + (obj?.[k] || 0), 0);
    return keys.map((k, i) => ({
      name: labels[i],
      value: obj?.[k] || 0,
      color: colors[i],
      totalVal
    })).filter(d => d.value > 0);
  };

  const typeData = prep(
    data.types,
    ['sh', 'tt', 'cc'],
    ['Smart Hands', 'Trouble Tickets', 'Cross Connects'],
    [COLORS.types.sh, COLORS.types.tt, COLORS.types.cc]
  );

  const healthData = prep(
    data.health,
    ['ok', 'expired'],
    ['Commit OK', 'Expired'],
    [COLORS.health.ok, COLORS.health.expired]
  );

  // Status Data (Dynamic)
  const statusKeys = Object.keys(data.status || {});
  const totalStatus = statusKeys.reduce((a, k) => a + (data.status[k] || 0), 0);

  const statusData = statusKeys.map((k, i) => {
    const lower = k.toLowerCase();
    let color = COLORS.status._default[i % COLORS.status._default.length];

    if (lower.includes("dispatch") || lower.includes("received")) color = COLORS.status.dispatch;
    else if (lower.includes("accept")) color = COLORS.status.accepted;
    else if (lower.includes("wip") || lower.includes("progress")) color = COLORS.status.wip;
    else if (lower.includes("close") || lower.includes("cancel")) color = COLORS.status.closed;
    else if (lower.includes("unknown")) color = COLORS.status.unknown;

    return {
      name: k,
      value: data.status[k],
      color,
      totalVal: totalStatus
    };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  // Grid Layout Implementation with Legend
  const renderSection = (title: string, data: any[]) => (
    <div className="flex flex-col h-full bg-white/5 rounded-lg border border-white/5 overflow-hidden">
      <div className="bg-white/5 px-2 py-1 text-[0.75em] font-semibold text-muted-foreground uppercase tracking-wider text-center border-b border-white/5">
        {title}
      </div>
      <div className="flex items-center flex-1 min-h-0 p-2">
        {/* Donut Chart */}
        <div className="w-20 h-20 flex-none relative">
          {data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-[0.7em] text-muted-foreground/30">No Data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={38}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 pl-2 space-y-1 overflow-y-auto max-h-25 scrollbar-thin scrollbar-thumb-white/10">
          {data.length === 0 ? (
            <div className="text-[0.75em] text-muted-foreground italic text-center">—</div>
          ) : (
            data.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[0.75em]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
                </div>
                <span className="font-mono font-bold ml-2">{item.value}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 h-full">
      {renderSection(copy.ticketTypes, typeData)}
      {renderSection(copy.commitHealth, healthData)}
      {renderSection(copy.ticketStatus, statusData)}
    </div>
  );
}

/* ------------------------------------------------ */
/* PAGE                                             */
/* ------------------------------------------------ */

export default function Dashboard() {
  const { language } = useLanguage();
  const copy = DASHBOARD_COPY[language] || DASHBOARD_COPY.en!;
  const locale = getLanguageLocale(language);
  const { user } = useAuth();
  const displayName = getUserDisplayName(user);
  const { isHidden } = useHiddenEmployees();

  /* NOW (Timer) */
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* FONT SIZE CONTROLS */
  const [gridFontSize, setGridFontSize] = useState<number>(15);
  useEffect(() => {
    const stored = localStorage.getItem("dashboard-grid-font-size");
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 12 && parsed <= 18) {
        setGridFontSize(parsed);
      }
    }
  }, []);

  const adjustFontSize = (delta: number) => {
    const next = Math.min(18, Math.max(12, gridFontSize + delta));
    setGridFontSize(next);
    localStorage.setItem("dashboard-grid-font-size", String(next));
  };


  /* SHIFT STORE (persist hydration) */
  const [hydrated, setHydrated] = useState(false);
  const getEmployeesForTodayAll = useShiftStore((s) => (s as any).getEmployeesForTodayAll);
  const getActiveSchedule = useShiftStore((s) => s.getActiveSchedule);
  const schedulesByMonth = useShiftStore((s) => s.schedulesByMonth);

  /* UI STATE (persisted) */
  const [showOnlyOwnersWithTickets, toggleOwners] = usePersistentToggle("dashboard.filter.ownersWithTickets", false);
  const [showOnlyActiveShifts, toggleActive] = usePersistentToggle("dashboard.filter.activeShifts", false);
  const [showOnlyCritical, toggleCritical] = usePersistentToggle("dashboard.filter.critical", false);
  const [showWarnings, toggleWarnings] = usePersistentToggle("dashboard.filter.warnings", false);

  /* COLLAPSIBLE SECTIONS UND CONFIG */
  const [dbConfig, setDbConfig] = useState<{ info_expanded: boolean; settings_expanded: boolean }>({
    info_expanded: true,
    settings_expanded: false
  });

  useEffect(() => {
    import("../../api/api").then(({ api }) => {
      api.get("/user/settings").then(res => {
        const cfg = res.data?.dashboard_config;
        if (cfg) setDbConfig(cfg);
      }).catch(e => console.warn("Failed to load dashboard_config", e));
    });
  }, []);

  const toggleSection = (key: 'info_expanded' | 'settings_expanded') => {
    const next = { ...dbConfig, [key]: !dbConfig[key] };
    setDbConfig(next);

    import("../../api/api").then(({ api }) => {
      api.put("/user/settings", { dashboard_config: next }).catch(e => console.error(e));
      api.post("/activity/log", {
        action: "dashboard_section_toggle",
        module: "DASHBOARD",
        details: { section: key, state: next[key] ? "open" : "closed" }
      }).catch(e => console.error("Log failed", e));
    });
  };

  /* ---- Remote data: handover, commit polling, kiosk messages ---- */
  const {
    handoverMap,
    crawlerStatus,
    kioskMessages,
    refreshCommit,
    dismissKioskMessage: dismissMsg,
  } = useDashboardData();

  /* ---- Crawler staleness detection (> 5 min = stale) ---- */
  const crawlerStaleness = useCrawlerStaleness(crawlerStatus.lastUpdate || null);

  /* ---- Weekplan roles for today (for role badges) ---- */
  const { fetchTodayRoles, getRole, setRole: setWeekplanRole, removeRole } = useWeekplanRoleStore();
  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    fetchTodayRoles();
    const interval = setInterval(fetchTodayRoles, 60_000);
    return () => clearInterval(interval);
  }, [fetchTodayRoles]);

  /* ---- Realtime SSE: refresh when data changes server-side ---- */
  useRealtimeUpdates({
    ingest_complete: () => { void refreshCommit(); },
    project_created: () => { void refreshCommit(); },
    project_updated: () => { void refreshCommit(); },
  });

  useEffect(() => {
    const persistApi = (useShiftStore as any).persist;
    if (persistApi?.hasHydrated?.()) setHydrated(true);
    const unsub = persistApi?.onFinishHydration?.(() => setHydrated(true));
    return () => typeof unsub === "function" && unsub();
  }, []);

  const employeesAll: Employee[] = useMemo(() => {
    if (!hydrated) return [];
    const all = (getEmployeesForTodayAll?.() as Employee[]) ?? [];
    return all.filter((e) => !isHidden(e.name));
  }, [hydrated, getEmployeesForTodayAll, isHidden]);

  const tickets = useCommitStore((s) => s.tickets);

  const ticketsByOwner = useMemo(() => {
    const map = new Map<string, any[]>();
    const rawMap = new Map<string, any[]>();
    for (const t of tickets as any[]) {
      const ownerRaw = (t?.owner ?? t?.Owner ?? "") as string;
      const owner = String(ownerRaw).trim();
      if (!owner) continue;
      const ownerClean = owner.replace(/[0-9]+$/, "").toUpperCase();
      const arr = rawMap.get(ownerClean) ?? [];
      arr.push(t);
      rawMap.set(ownerClean, arr);
    }

    for (const emp of employeesAll) {
      const parts = emp.name.split(" ");
      if (parts.length === 0) continue;
      const surname = parts[0].trim().replace(/[^a-zA-Z0-9-]/g, "");
      if (surname.length < 2) continue;
      const surnameUpper = surname.toUpperCase();

      const matches: any[] = [];
      for (const [ownerClean, tix] of rawMap.entries()) {
        if (ownerClean.endsWith(surnameUpper)) {
          matches.push(...tix);
        }
      }

      if (matches.length > 0) {
        matches.sort((a, b) => {
          const ah = calcCommitHours(a);
          const bh = calcCommitHours(b);
          if (ah == null && bh == null) return 0;
          if (ah == null) return 1;
          if (bh == null) return -1;
          return ah - bh;
        });
        map.set(emp.name, matches);
      }
    }
    return map;
  }, [tickets, employeesAll]);

  const { overdueTickets, dueSoon2hTickets, scheduledTodayTickets } = useMemo(() => {
    const nowMs = now.getTime();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    const overdueList: any[] = [];
    const dueSoon2hList: any[] = [];
    const scheduledList: any[] = [];

    for (const t of tickets as any[]) {
      const rcd = t.revised_commit_date ?? t.revisedCommitDate ?? t.commitDate;
      if (rcd) {
        const rcdDate = new Date(rcd);
        if (!Number.isNaN(rcdDate.getTime())) {
          const remainMs = rcdDate.getTime() - nowMs;
          const remainMin = remainMs / 60_000;
          if (remainMin < 0) {
            overdueList.push(t);
          } else if (remainMin <= 120) {
            dueSoon2hList.push(t);
          }
        }
      }

      const ss = t.sched_start || t.schedStart;
      if (ss) {
        const ssDate = new Date(ss);
        if (!Number.isNaN(ssDate.getTime())) {
          if (ssDate.getFullYear() === y && ssDate.getMonth() === m && ssDate.getDate() === d) {
            scheduledList.push(t);
          }
        }
      }
    }
    return { overdueTickets: overdueList, dueSoon2hTickets: dueSoon2hList, scheduledTodayTickets: scheduledList };
  }, [tickets, now]);

  const criticalTicketsByOwner = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tickets as any[]) {
      const h = calcCommitHours(t);
      if (h == null) continue;
      if (!(h < 0 || h <= 2)) continue;
      const ownerRaw = (t?.owner ?? t?.Owner ?? "") as string;
      const owner = String(ownerRaw).trim();
      if (!owner) continue;
      const arr = map.get(owner) ?? [];
      arr.push(t);
      map.set(owner, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ah = calcCommitHours(a) ?? 999;
        const bh = calcCommitHours(b) ?? 999;
        return ah - bh;
      });
      map.set(k, arr);
    }
    return map;
  }, [tickets]);

  const grouped = useMemo(() => {
    // ------------------------------------------------
    // NIGHT SHIFT LOGIC (Monday < 07:00 -> Previous Day)
    // ------------------------------------------------
    let nightEmployeesToUse: Employee[] = [];
    const isMonday = now.getDay() === 1;
    const h = now.getHours();

    // Extend until 07:00 (since Night Shift is until 06:45)
    const isBefore0700 = h < 7;

    if (isMonday && isBefore0700) {
      // Use SUNDAY's Night Shift
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const key = monthKeyOf(yesterday);
      const schedule = (schedulesByMonth && schedulesByMonth[key]) ? schedulesByMonth[key] : (getActiveSchedule?.() ?? {});
      const day = yesterday.getDate();

      // DEBUG LOG
      console.log("[Dashboard] Night Shift Fix (Monday < 7h):", {
        now: now.toISOString(),
        yesterday: yesterday.toISOString(),
        key,
        scheduleFound: !!schedule,
        day
      });

      if (schedule) {
        Object.entries(schedule).forEach(([employeeRaw, days]) => {
          const shiftCode = days?.[day];
          if (shiftCode === "N") {
            const info = shiftTypes[shiftCode];
            if (info) {
              const normalized = employeeRaw.replace(",", "").trim();
              nightEmployeesToUse.push({
                name: normalized,
                shift: shiftCode,
                time: info.time,
                info
              });
            }
          }
        });
      }

      console.log("[Dashboard] Night Employees Found:", nightEmployeesToUse.length);

      // FALLBACK: If "Yesterday N" is empty (e.g. key missing/empty schedule), verify if we should show standard "Today N".
      if (nightEmployeesToUse.length === 0) {
        console.warn("[Dashboard] Night Shift empty, falling back to Today");
        nightEmployeesToUse = employeesAll.filter(e => e.shift === "N");
      }
    } else {
      // Use TODAY's Night Shift (Standard)
      nightEmployeesToUse = employeesAll.filter(e => e.shift === "N");
    }

    // ------------------------------------------------
    // PREPARE LISTS
    // ------------------------------------------------
    const early = employeesAll.filter(e => EARLY_SHIFT_CODES.includes(e.shift as (typeof EARLY_SHIFT_CODES)[number]));
    const late = employeesAll.filter(e => LATE_SHIFT_CODES.includes(e.shift as (typeof LATE_SHIFT_CODES)[number]));
    // Night is 'nightEmployeesToUse'

    // Helper to group by code
    const groupEmployeesByCode = (list: Employee[]) => {
      const byCode: Record<string, Employee[]> = {};
      list.forEach(e => {
        if (!byCode[e.shift]) byCode[e.shift] = [];
        byCode[e.shift].push(e);
      });
      return byCode;
    };

    const earlyByCode = groupEmployeesByCode(early);
    const lateByCode = groupEmployeesByCode(late);
    const nightByCode = groupEmployeesByCode(nightEmployeesToUse);

    const sortByName = (arr: Employee[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name));

    const make = (title: string, codes: string[], sourceByCode: Record<string, Employee[]>) => {
      const items = codes
        .filter((c) => (sourceByCode[c]?.length ?? 0) > 0)
        .map((c) => {
          const employeesRaw = sortByName(sourceByCode[c] ?? []);
          const employees = employeesRaw.filter((e) => {
            const owned = ticketsByOwner.get(e.name) ?? [];
            const crit = criticalTicketsByOwner.get(e.name) ?? [];
            if (showOnlyOwnersWithTickets && owned.length === 0) return false;
            if (showOnlyCritical && crit.length === 0) return false;
            return true;
          });

          const info = shiftTypes[c];
          // For Night Shift on Monday < 06:30, we might want to adjust the range display or keep it generic?
          // Using 'now' for range calculation assumes the shift IS active or relevant to 'now'.
          // If we show yesterday's night shift, it technically started yesterday.
          // But timerLabel handles "Ends in..." or "Starts in..." relative to 'now'.
          // If it started yesterday 21:15 and ends today 06:45, it is ACTIVE now (sub 06:30).
          // So the standard Monday range logic checking against "06:30" is actually tricky if we passed specific dates.
          // But 'buildRangeForToday' builds a range for the passed DATE (which is 'now').
          // If we are showing yesterday's night shift (N: 21:15-06:45), and it is Monday 05:00.
          // The shift code "N" implies 21:15-06:45.
          // If we use today's date + N time, it implies Monday 21:15.
          // If we want to show it as ACTIVE, we need the logic to understand it spans midnight.
          // Existing 'buildRangeForToday' might default to "Start/End today".
          // However, for visualization primarily:
          // We just want to list the PEOPLE. The 'range' / 'active' badges are secondary but should be correct.
          // Let's assume standard behavior for now.

          const range = info?.time && info.time !== "—" ? buildRangeForToday(info.time, now) : null;

          // Special Case: Should checking "active" be adjusted? 
          // If it is Monday 05:00, "N" (21:15-06:45) built for "Today" (Monday) would range Mon 21:15 - Tue 06:45.
          // So it would show "Starts in 16h".
          // Ideally we want it to show "Active (Ends in 1h 45m)".
          // But the user request said: "Reuse existing ISO week helpers... Only adjust the selection logic".
          // So minimal change -> Just show the correct PEOPLE.

          const active = isRangeActive(now, range);
          if (showOnlyActiveShifts && !active && !(isMonday && isBefore0700 && c === "N")) {
            // Exception: If it's Monday morning and we show night shift, it IS active essentially.
            // But let's stick to standard logic unless forced.
            return null;
          }

          // Force include if we are in the special Monday Morning Night Mode? 
          // If user toggles "Only Active", and generic N is "future", it hides.
          // Let's rely on standard logic filters.

          const ownersWithTickets = employees.reduce((acc, e) => acc + (((ticketsByOwner.get(e.name)?.length ?? 0) > 0) ? 1 : 0), 0);
          const topOwners = [...employees]
            .map((e) => ({ name: e.name, n: (ticketsByOwner.get(e.name)?.length ?? 0) }))
            .filter((x) => x.n > 0)
            .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
            .slice(0, 3);

          return { code: c, employees, active, range, ownersWithTickets, topOwners };
        })
        .filter((x): x is any => x !== null);

      const cleaned = items.filter((x) => (x.employees?.length ?? 0) > 0);
      return { title, items: cleaned };
    };

    const groups = [
      make(copy.earlyShift, [...EARLY_SHIFT_CODES], earlyByCode),
      make(copy.lateShift, [...LATE_SHIFT_CODES], lateByCode),
      make(copy.nightShift, ["N"], nightByCode),
    ];

    return groups.filter((g) => g.items.length > 0);
  }, [employeesAll, ticketsByOwner, criticalTicketsByOwner, showOnlyOwnersWithTickets, showOnlyActiveShifts, showOnlyCritical, now, schedulesByMonth]);

  const understaffToday = useMemo(() => {
    const key = monthKeyOf(now);
    const schedule = (schedulesByMonth && schedulesByMonth[key]) ? schedulesByMonth[key] : (getActiveSchedule?.() ?? {});
    const y = now.getFullYear();
    const m1 = now.getMonth() + 1;
    const daysInMonth = new Date(y, now.getMonth() + 1, 0).getDate();
    const warnings = computeUnderstaffWarnings(schedule as any, y, m1, daysInMonth);
    const dateKey = `${y}-${pad2(m1)}-${pad2(now.getDate())}`;
    const today = warnings.filter((w) => w.dateKey === dateKey);
    return { count: today.length, labels: today.map((w) => w.label) };
  }, [now, schedulesByMonth, getActiveSchedule]);

  /* ------------------------------------------------ */
  /* MERGED LIST: Commit < 72h + Terminiert Heute    */
  /* ------------------------------------------------ */
  const urgentTickets = useMemo(() => {
    const list: any[] = [];
    const nowMs = now.getTime();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    for (const t of tickets as any[]) {
      const act = String(t.activity ?? t.activityType ?? "").toLowerCase();
      // Robust TT check: TTs always start with a "5"
      const cleanAct = act.replace(/^fr2-/, "").replace(/\s+/g, " ");
      const isTT = cleanAct.includes("trouble ticket") || (cleanAct.includes("trouble") && cleanAct.includes("ticket")) || /^5\d+/.test(String(t.external_id ?? t.ticketNumber ?? t.ticket ?? t.id ?? ""));

      // 1. Check Remaining Time (< 72h)
      const ms = getRemainingMs(t);
      let isUrgentTime = false;
      if (ms !== null) {
        const hours = ms / 3600000;
        // Include < 72h but NOT overdue (expired)
        if (hours >= 0 && hours <= 72) isUrgentTime = true;
      }

      // 2. Check Scheduled Today
      let isScheduledToday = false;
      const ss = t.sched_start || t.schedStart;
      if (ss) {
        const ssDate = new Date(ss);
        if (!Number.isNaN(ssDate.getTime())) {
          if (ssDate.getFullYear() === y && ssDate.getMonth() === m && ssDate.getDate() === d) {
            isScheduledToday = true;
          }
        }
      }

      // 3. ALWAYS include TT (and valid < 72h)
      // Requested: "Ensure Trouble Tickets are included"
      // Requested: "Filter out expired non-TT?" -> The request says "TT ... immer ganz oben".
      // We keep the logic: TT always included. <72h (non-expired) included.
      // Refined logic: 
      // - If TT: Include.
      // - If < 72h AND >= 0 (not expired): Include.
      // - If scheduled today: Include.

      let include = false;
      if (isTT) include = true;
      else if (isUrgentTime) include = true;
      else if (isScheduledToday) include = true;

      if (include) {
        list.push({ ...t, _isScheduledToday: isScheduledToday, _remainingMs: ms, _isTT: isTT });
      }
    }

    // Sort: expired at bottom, then by remaining time ascending (soonest deadline first)
    list.sort((a, b) => {
      const msA = a._remainingMs;
      const msB = b._remainingMs;

      const expiredA = msA !== null && msA < 0;
      const expiredB = msB !== null && msB < 0;

      // Expired entries go to the bottom
      if (expiredA && !expiredB) return 1;
      if (!expiredA && expiredB) return -1;

      // TT always before non-TT (within same expired/non-expired group)
      if (a._isTT && !b._isTT) return -1;
      if (!a._isTT && b._isTT) return 1;

      // Sort by remaining time (lowest/soonest first)
      const sortA = getTicketSortKey(msA);
      const sortB = getTicketSortKey(msB);
      return sortA - sortB;
    });

    return list;
  }, [tickets, now]);

  const stats = useMemo(() => {
    let termToday = 0;
    let sh = 0;
    let tt = 0;
    let cc = 0;

    for (const t of urgentTickets) {
      if (t._isScheduledToday) termToday++;

      const act = String(t.activity ?? t.activityType ?? "").toLowerCase().trim();
      // Normalize: remove prefix like 'fr2-'
      const norm = act.replace(/^[a-z0-9]+-/, "").replace(/\s+/g, " ");

      if (norm.includes("smart hand") || norm.includes("smarthand")) sh++;
      else if (norm.includes("trouble ticket") || (norm.includes("trouble") && norm.includes("ticket"))) tt++;
      else if (norm.includes("cross connect") || norm.includes("cross-connect")) cc++;
    }
    return { termToday, sh, tt, cc };
  }, [urgentTickets]);


  /* ------------------------------------------------ */
  /* COLUMN RESIZING                                  */
  /* ------------------------------------------------ */
  const DEFAULT_WIDTHS = {
    ticketId: 150,
    system: 360,
    activity: 180,
    handover: 80, // New Column
    terminiert: 110,
    start: 170,
    owner: 140,
    rest: 110
  };

  const [colWidths, setColWidths] = useState(() => {
    try {
      const stored = localStorage.getItem("dashboard.commit72h.columnWidths");
      if (stored) return { ...DEFAULT_WIDTHS, ...JSON.parse(stored) };
    } catch (e) { /* ignore */ }
    return DEFAULT_WIDTHS;
  });

  const resizingRef = React.useRef<{ key: string, startX: number, startWidth: number } | null>(null);

  const handleResizeStart = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = (colWidths as any)[key] || 100;
    resizingRef.current = { key, startX: e.clientX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', handleResizeEnd);
  };

  const handleResizeMove = (e: PointerEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    const newWidth = Math.max(80, Math.min(800, startWidth + diff));
    setColWidths((prev: any) => ({ ...prev, [key]: newWidth }));
  };

  const handleResizeEnd = () => {
    if (resizingRef.current) {
      const currentWidths = colWidths; // closure captures old state? No, we need fresh state for save...
      // Actually we are updating state in Move, so we can just verify content.
      // Better to rely on effect for saving to LS or just save here using functional update to be sure?
      // Since setting state is async, best to use an effect that watches colWidths for saving (debounced usually)
      // or just save the final result in the state setter?
      // Let's use an effect for persistence to be clean.
    }
    resizingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', handleResizeMove);
    window.removeEventListener('pointerup', handleResizeEnd);
  };

  useEffect(() => {
    localStorage.setItem("dashboard.commit72h.columnWidths", JSON.stringify(colWidths));
  }, [colWidths]);

  /* ------------------------------------------------ */
  /* RENDER                                          */
  /* ------------------------------------------------ */
  // Use CSS variable injection for dynamic grid font size
  const dashboardStyle = {
    "--dashboard-grid-font-size": `${gridFontSize}px`,
    fontSize: `var(--dashboard-grid-font-size)`, // Apply to root for inheritance
  } as React.CSSProperties;

  const Resizer = ({ colKey }: { colKey: string }) => (
    <div
      onPointerDown={(e) => handleResizeStart(e, colKey)}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10 touch-none"
      onClick={(e) => e.stopPropagation()}
    />
  );

  return (
    <div
      className="w-full h-screen flex flex-col overflow-hidden text-foreground"
      style={{ ...dashboardStyle, backgroundColor: "#070d1e", backgroundImage: "radial-gradient(ellipse at top, rgba(30,42,80,0.3), transparent 80%)" }}
    >
      <EnterprisePageShell className="relative">
        {/* Header Row */}
        <EnterpriseHeader
          icon={<ChartIcon style={{ width: 18, height: 18, color: "#818cf8" }} />}
          title={<>{copy.greeting}, <span className="text-foreground">{displayName}</span></>}
          rightContent={
            <div className="flex items-center gap-2">
              <DateTimeBadge />

              {/* UNTERBESETZUNG BADGE */}
              {showWarnings && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[0.85em] rounded-lg border transition-colors ${understaffToday.count === 0 ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20" : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"}`}>
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-semibold">{understaffToday.count === 0 ? copy.staffingOk : copy.understaffing}</span>
                      {understaffToday.count > 0 && <span className="ml-1 bg-red-500/20 px-1 rounded text-[0.7em] font-bold">{understaffToday.count}</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="theme-popover-surface w-80 p-0 shadow-xl backdrop-blur-md" align="end">
                    <div className="flex items-center justify-between border-b border-border/60 p-3 font-medium">
                      <span>{copy.understaffingDetails}</span>
                      <span className="text-xs text-muted-foreground">{copy.today}</span>
                    </div>
                    <div className="p-2 space-y-1">
                      {understaffToday.count === 0 ? (
                        <div className="flex items-center gap-2 p-2 text-green-400 text-sm">
                          <Check className="w-4 h-4" />
                          <span>{copy.noUnderstaffing}</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {understaffToday.labels.map((label, i) => (
                            <div key={i} className="flex items-start gap-2 rounded p-2 text-sm hover:bg-accent/70">
                              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                              <div>
                                <div className="font-semibold text-red-300">{copy.warning}</div>
                                <div className="text-muted-foreground text-xs">{label}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          }
        />

        {/* COMMIT ≤72h / HEUTE – Full Width */}
        <div className="theme-glass-panel stat-card flex flex-col rounded-2xl border border-indigo-500/30 transition-all hover:shadow-[0_8px_32px_rgba(79,70,229,0.15)]" style={{ maxHeight: '40vh', animationDelay: '120ms' }}>
          <div className="flex flex-none items-center justify-between rounded-t-2xl border-b border-border/60 bg-indigo-500/10 px-5 py-3">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                <Clock className="w-4 h-4 text-indigo-400" />
                {copy.commitTodayTitle}
              </div>

              {/* SUMMARY BADGES */}
              <div className="flex items-center gap-3 text-[0.75em] font-bold text-muted-foreground">
                <span className="theme-glass-inset flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-indigo-700 dark:text-indigo-200">{copy.commitToday}: <span className="font-mono text-foreground">{stats.termToday}</span></span>
                <span className="theme-glass-inset flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-blue-700 dark:text-blue-300">SH: <span className="font-mono text-foreground">{stats.sh}</span></span>
                <span className="theme-glass-inset flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-red-600 dark:text-red-400">TT: <span className="font-mono text-foreground">{stats.tt}</span></span>
                <span className="theme-glass-inset flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-amber-700 dark:text-amber-400">CC: <span className="font-mono text-foreground">{stats.cc}</span></span>
              </div>
            </div>

            <div className="px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-200 text-[0.9em] font-extrabold font-mono border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
              {urgentTickets.length}
            </div>
          </div>

          <div className="flex-1 overflow-auto rounded-b-2xl scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {crawlerStaleness.isStale ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2">
                <div className="text-red-400 font-bold text-sm uppercase tracking-wider">{language === 'de' ? 'KEINE AKTUELLEN CRAWLER-DATEN' : 'NO RECENT CRAWLER DATA INPUT'}</div>
                <div className="text-[13px] text-muted-foreground">{language === 'de' ? 'Ticket-Daten werden ausgeblendet, da keine aktuellen Crawler-Daten vorliegen.' : 'Ticket data is hidden because no recent crawler data is available.'}</div>
              </div>
            ) : urgentTickets.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-[13px] text-muted-foreground">{copy.noData}</div>
            ) : (
              <div className="min-w-275 w-full flex flex-col h-full relative">
                {/* HEADERS */}
                <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_100px_100px_1.2fr_1.2fr_120px] gap-4 px-4 py-2 text-[11px] font-extrabold text-indigo-300/80 uppercase tracking-wider border-b border-indigo-500/20 bg-indigo-500/5 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                  <div>{copy.activity}</div>
                  <div>{copy.systemName}</div>
                  <div>Status</div>
                  <div>{copy.owner}</div>
                  <div className="text-center">{copy.scheduled}</div>
                  <div className="text-center">Expedite</div>
                  <div className="text-right">{language === 'de' ? 'Geplanter Start' : 'Scheduled start'}</div>
                  <div className="text-right">{copy.revisedCommit}</div>
                  <div className="text-right">{copy.remainingTime}</div>
                </div>

                {/* ROWS */}
                <div className="flex-1 divide-y divide-white/3">
                  {urgentTickets.map((t: any, i) => {
                    const id = String(t.external_id ?? t.ticketNumber ?? t.ticket ?? t.id ?? "?");
                    const sysName = String(t.systemName ?? t.system_name ?? "—").trim();
                    const activity = String(t.activityType ?? t.activity ?? t.subtype ?? "—").trim();
                    const status = String(t.activityStatus ?? t.status ?? t.activity_status ?? "—").toUpperCase();
                    const ownerFull = String(t.owner ?? t.Owner ?? "—").trim();
                    const ownerInitials = ownerFull.split(' ')[0];
                    const rcd = t.revised_commit_date ?? t.revisedCommitDate ?? t.commitDate ?? null;
                    const rcdFormat = rcd && !Number.isNaN(new Date(rcd).getTime())
                      ? new Date(rcd).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : "—";

                    const ms = t._remainingMs;
                    const rem = ms !== null ? formatRemainingTime(ms) : "—";
                    const tTier = getColorTier(ms);
                    const tierColor = tierClasses[tTier];
                    const rowGlow = tierGlow[tTier];

                    const hasHandover = handoverMap.get(id);
                    const isScheduled = !!(t.sched_start || t.schedStart);

                    const ss = t.sched_start || t.schedStart;
                    const ssFormat = ss && !Number.isNaN(new Date(ss).getTime())
                      ? new Date(ss).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : "—";

                    const rawExpedite = t.expedite ?? t.Expedite;
                    const isExpedite = rawExpedite === true || String(rawExpedite).toLowerCase() === "yes" || String(rawExpedite).toLowerCase() === "true";

                    const isTTStyling = t._isTT ? "border-l-2 border-l-yellow-500 bg-yellow-500/[0.02]" : "border-l-2 border-l-transparent";

                    return (
                      <div
                        key={`${id}-${i}`}
                        className={`grid grid-cols-[1.5fr_1.5fr_1fr_1fr_100px_100px_1.2fr_1.2fr_120px] gap-4 px-4 py-3 items-center hover:bg-white/4 transition-all group rounded-lg mb-0.5 ${isTTStyling} ${rowGlow}`}
                      >
                        {/* 1) Activity */}
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`px-1.5 py-px text-[10px] font-bold rounded ${tierColor} text-white font-mono shadow-sm`}>
                              {id}
                            </span>
                            <div className="scale-75 origin-left -ml-0.5"><CopyTicketButton ticketId={id} /></div>
                            {hasHandover && <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-1 py-px rounded text-[9px] uppercase font-bold tracking-wider">HND</span>}
                          </div>
                          <span className="text-[13px] font-medium text-slate-100 truncate" title={activity}>{activity}</span>
                        </div>

                        {/* 2) Systemname */}
                        <div className="text-[12px] text-slate-300 wrap-break-word whitespace-normal leading-snug pr-2 font-mono" title={sysName}>
                          {sysName}
                        </div>

                        {/* 3) Status */}
                        <div className="flex items-center min-w-0">
                          <span className="truncate bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-300" title={status}>
                            {status}
                          </span>
                        </div>

                        {/* 4) Owner */}
                        <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-slate-300">
                          <Users className="w-3.5 h-3.5 text-indigo-400/70 shrink-0" />
                          <span className="truncate" title={ownerFull}>{ownerInitials}</span>
                        </div>

                        {/* 5) Terminiert (Yes/No) */}
                        <div className="flex justify-center items-center">
                          {isScheduled ? (
                            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'de' ? 'Ja' : 'Yes'}</span>
                          ) : (
                            <span className="bg-slate-800 text-slate-500 border border-slate-700 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'de' ? 'Nein' : 'No'}</span>
                          )}
                        </div>

                        {/* 6) Expedite (Yes/No) */}
                        <div className="flex justify-center items-center">
                          {isExpedite ? (
                            <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'de' ? 'Ja' : 'Yes'}</span>
                          ) : (
                            <span className="bg-slate-800 text-slate-500 border border-slate-700 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'de' ? 'Nein' : 'No'}</span>
                          )}
                        </div>

                        {/* 7) Sched Start */}
                        <div className="text-right text-[12px] font-mono text-blue-300 opacity-90">
                          {ssFormat}
                        </div>

                        {/* 8) Revised Commit Date */}
                        <div className="text-right text-[12px] font-mono text-slate-400 opacity-90">
                          {rcdFormat}
                        </div>

                        {/* 8) Restzeit */}
                        <div className={`text-right font-black font-mono text-[14px] ${ms !== null && ms < 0 ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]" : "text-slate-100"}`}>
                          {rem}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TAGESGESCHÄFT – FULL HEIGHT FILLER */}
        <div className="flex-1 min-h-0 flex flex-col mt-2">
          <div className="theme-glass-panel z-10 flex flex-none flex-col rounded-t-2xl border-b border-indigo-500/20 bg-indigo-500/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.15em] text-indigo-700 dark:text-indigo-300">
              {copy.serviceToday}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={showOnlyOwnersWithTickets ? "default" : "secondary"} size="sm" className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${showOnlyOwnersWithTickets ? 'bg-indigo-600/80 hover:bg-indigo-600 text-white border-transparent' : 'theme-toolbar-button border border-border bg-background/85 text-foreground shadow-sm hover:bg-accent'}`} onClick={toggleOwners}>
                {copy.ownersOnly}
              </Button>
              <Button variant={showOnlyActiveShifts ? "default" : "secondary"} size="sm" className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${showOnlyActiveShifts ? 'bg-indigo-600/80 hover:bg-indigo-600 text-white border-transparent' : 'theme-toolbar-button border border-border bg-background/85 text-foreground shadow-sm hover:bg-accent'}`} onClick={toggleActive}>
                {copy.activeOnly}
              </Button>
              <Button variant={showWarnings ? "default" : "secondary"} size="sm" className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${showWarnings ? (understaffToday.count > 0 ? 'bg-red-600/80 hover:bg-red-600 text-white border-transparent' : 'bg-emerald-600/80 hover:bg-emerald-600 text-white border-transparent') : 'theme-toolbar-button border border-border bg-background/85 text-foreground shadow-sm hover:bg-accent'}`} onClick={toggleWarnings}>
                {copy.warnings}{understaffToday.count > 0 ? ` (${understaffToday.count})` : ""}
              </Button>
              <Button variant={showOnlyCritical ? "default" : "secondary"} size="sm" className={`h-7 px-3 text-[11px] font-bold tracking-wider uppercase ${showOnlyCritical ? 'bg-indigo-600/80 hover:bg-indigo-600 text-white border-transparent' : 'theme-toolbar-button border border-border bg-background/85 text-foreground shadow-sm hover:bg-accent'}`} onClick={toggleCritical}>
                {copy.criticalOnly}
              </Button>
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-[13px] text-muted-foreground">{copy.noShifts}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
              {grouped.map((g) => (
                <ShiftGroup
                  key={g.title}
                  group={g}
                  ticketsByOwner={ticketsByOwner}
                  criticalTicketsByOwner={criticalTicketsByOwner}
                  now={now}
                  showOnlyActiveShifts={showOnlyActiveShifts}
                  showOnlyCritical={showOnlyCritical}
                  crawlerStale={crawlerStaleness.isStale}
                  todayDateStr={todayDateStr}
                />
              ))}
            </div>
          )}
        </div>
      </EnterprisePageShell>
    </div>
  );
}
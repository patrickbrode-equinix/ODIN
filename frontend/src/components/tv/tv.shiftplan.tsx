/* ------------------------------------------------ */
/* TV SCHICHTEN HEUTE                               */
/* Compact-card style matching "Owned Tickets"      */
/* ------------------------------------------------ */

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { TvShiftEmployee, TvShiftplanProps } from "./tv.types";
import { getRemainingMs, getColorTier, tierClasses, formatRemainingTime } from "../../utils/ticketColors";

/* ------------------------------------------------ */
/* SHIFT COLORS                                     */
/* ------------------------------------------------ */
const SHIFT_COLORS = {
  // Frühschicht → Orange
  early: {
    header: "border-orange-400/40 shadow-[0_2px_12px_rgba(251,146,60,0.12)]",
    badge: "bg-orange-400 text-black",
    title: "text-orange-400",
  },
  // Spätschicht → Yellow
  late: {
    header: "border-yellow-400/40 shadow-[0_2px_12px_rgba(250,204,21,0.12)]",
    badge: "bg-yellow-400 text-black",
    title: "text-amber-400",
  },
  // Nachtschicht → Blue
  night: {
    header: "border-blue-500/40 shadow-[0_2px_12px_rgba(59,130,246,0.12)]",
    badge: "bg-blue-500 text-white",
    title: "text-blue-500",
  },
};

/* ------------------------------------------------ */
/* EMPLOYEE CARD                                    */
/* ------------------------------------------------ */
function EmployeeCard({
  shift,
  name,
  shiftLabel,
  time,
  category,
  tickets,
  shiftKind,
}: {
  shift: string;
  name: string;
  shiftLabel: string;
  time: string;
  category?: string;
  tickets?: any[];
  shiftKind: "early" | "late" | "night";
}) {
  const colors = SHIFT_COLORS[shiftKind];
  const displayedTickets = (tickets ?? []).slice(0, 3);
  const extra = (tickets?.length ?? 0) - 3;

  return (
    <div className={`flex flex-col rounded-md bg-card border ${colors.header} overflow-hidden`}>
      {/* NAME ROW */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-white/5">
        <span className={`text-[11px] font-bold px-1.5 py-1 rounded uppercase tracking-wider shrink-0 ${colors.badge}`}>
          {shift}
        </span>
        <span className="flex-1 font-bold text-[14px] truncate leading-tight">{name}</span>
        {category && (
          <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border border-primary/20 shrink-0">
            {category}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground font-mono hidden xl:inline shrink-0">{time}</span>
      </div>

      {/* TICKETS */}
      {displayedTickets.length > 0 ? (
        <div className="flex flex-col divide-y divide-white/5">
          {displayedTickets.map((t, idx) => {
            const ms = getRemainingMs(t);
            const tier = getColorTier(ms);
            const css = tierClasses[tier];
            const rem = ms !== null ? formatRemainingTime(ms) : "";
            const id = String(t.external_id ?? t.ticketNumber ?? t.id ?? "").trim();
            const activity = String(t.activity ?? t.title ?? t.subtype ?? "–").trim();
            const system = String(t.systemName ?? t.component_name ?? t.system_name ?? t.db_name ?? t.Area ?? "").trim();
            const gruppe = String(t.assignment_group ?? t.assignmentGroup ?? t.group ?? "").trim();
            const status = String(t.status ?? t.state ?? t.Status ?? "").trim();

            return (
              <div key={`${id}-${idx}`} className={`flex items-start justify-between px-2.5 py-2 gap-2 ${css}`}>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 flex-1 text-[12px] leading-snug">
                  <span className="font-mono font-bold text-[13px] text-white/95">{id}</span>
                  <span className="text-white/30 font-light">|</span>
                  <span className="font-medium text-white/90">{activity}</span>
                  {system && (
                    <>
                      <span className="text-white/30 font-light">|</span>
                      <span className="opacity-85">{system}</span>
                    </>
                  )}
                  {gruppe && (
                    <>
                      <span className="text-white/30 font-light">|</span>
                      <span className="opacity-85">{gruppe}</span>
                    </>
                  )}
                  {status && (
                    <>
                      <span className="text-white/30 font-light">|</span>
                      <span className="opacity-85">{status}</span>
                    </>
                  )}
                </div>
                {rem && <span className="font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded text-[11px] shrink-0 mt-px">{rem}</span>}
              </div>
            );
          })}
          {extra > 0 && (
            <div className="text-[11px] font-semibold text-muted-foreground italic text-center py-1 bg-white/5">
              + {extra} weitere {extra === 1 ? "Ticket" : "Tickets"}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------ */
/* SHIFT BLOCK                                      */
/* ------------------------------------------------ */
function ShiftBlock({
  title,
  list,
  shiftKind,
  ticketsByOwner,
}: {
  title: string;
  list: TvShiftEmployee[];
  shiftKind: "early" | "late" | "night";
  ticketsByOwner?: Map<string, any[]>;
}) {
  const colors = SHIFT_COLORS[shiftKind];

  return (
    <div className="space-y-3">
      <div className={`text-lg font-black tracking-wide flex items-center gap-2 ${colors.title}`}>
        <span>{title}</span>
        <span className="text-muted-foreground text-sm font-normal">{list.length} MA</span>
      </div>

      {list.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl bg-background/20 border border-white/5 text-muted-foreground text-[16px] py-4">
          Keine Mitarbeiter anwesend
        </div>
      ) : (
        <div className="columns-1 md:columns-2 xl:columns-3 2xl:columns-4 gap-4">
          {list.map((e) => (
            <div key={`${e.shift}-${e.name}`} className="break-inside-avoid mb-3">
              <EmployeeCard
                shift={e.shift}
                name={e.name}
                shiftLabel={title}
                time={e.time}
                category={e.category}
                tickets={ticketsByOwner?.get(e.name)}
                shiftKind={shiftKind}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ */
/* MAIN COMPONENT                                   */
/* ------------------------------------------------ */

export function TvShiftplan({
  early = [],
  late = [],
  night = [],
  ticketsByOwner,
}: TvShiftplanProps) {
  return (
    <Card className="flex flex-col h-full min-h-0 bg-transparent border-0 shadow-none">
      {/* HEADER */}
      <CardHeader className="pb-0 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-black tracking-tight">Schichten Heute</CardTitle>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Früh {early.length}
            </span>
            <span className="px-3 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
              Spät {late.length}
            </span>
            <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Nacht {night.length}
            </span>
          </div>
        </div>
      </CardHeader>

      {/* CONTENT */}
      <CardContent className="flex-1 min-h-0 overflow-y-auto mt-4 px-4 pb-12">
        <div className="space-y-10">
          <ShiftBlock
            title="Frühschicht"
            list={early}
            shiftKind="early"
            ticketsByOwner={ticketsByOwner}
          />
          <ShiftBlock
            title="Spätschicht"
            list={late}
            shiftKind="late"
            ticketsByOwner={ticketsByOwner}
          />
          <ShiftBlock
            title="Nachtschicht"
            list={night}
            shiftKind="night"
            ticketsByOwner={ticketsByOwner}
          />
        </div>
      </CardContent>
    </Card>
  );
}

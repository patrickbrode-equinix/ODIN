import React, { useEffect, useState, useCallback } from "react";
import { Ticket as TicketIcon } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";
import { QueueApi, Ticket, QueueGroup } from "../../api/queue";
import { CreateHandoverModal } from "../handover/CreateHandoverModal";
import { HandoverType } from "../handover/handover.types";
import {
  getRemainingMs,
  formatRemainingTime,
  getColorTier,
  tierClasses,
} from "../../utils/ticketColors";
import * as ContextMenu from "@radix-ui/react-context-menu";

/* ------------------------------------------------ */
/* HELPERS                                          */
/* ------------------------------------------------ */

const HANDOVER_TYPES: HandoverType[] = ["Workload", "Terminiert", "Other Teams"];

/* ------------------------------------------------ */
/* TICKET TILE                                      */
/* ------------------------------------------------ */

function TicketTile({ ticket, onHandover }: { ticket: Ticket; onHandover: (t: Ticket, type: HandoverType) => void }) {
  const ms = getRemainingMs(ticket);
  const tier = getColorTier(ms);
  const tierCss = tierClasses[tier];
  const remaining = formatRemainingTime(ms);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`rounded-xl border-2 p-4 select-none transition-all hover:scale-[1.01] cursor-default ${tierCss}`}
        >
          {/* Grid row matching the header */}
          <div className="grid grid-cols-7 gap-4 items-center">
            {/* Activity */}
            <div className="font-semibold text-sm truncate" title={ticket.external_id}>
              {ticket.external_id}
            </div>

            {/* Owner */}
            <div className="text-sm truncate" title={ticket.owner || "—"}>
              {ticket.owner || "—"}
            </div>

            {/* System Name */}
            <div className="text-sm truncate" title={ticket.system_name || "—"}>
              {ticket.system_name || "—"}
            </div>

            {/* Revised Commit Date */}
            <div className="text-sm">
              {ticket.revised_commit_date
                ? new Date(ticket.revised_commit_date).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : ticket.commit_date
                  ? new Date(ticket.commit_date).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "—"}
            </div>

            {/* Remaining Time */}
            <div
              className={`text-sm font-semibold ${ms !== null && ms < 0 ? "text-red-400" : ""
                }`}
            >
              {remaining}
            </div>

            {/* Sched. Start */}
            <div className="text-sm">
              {ticket.sched_start
                ? new Date(ticket.sched_start).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "—"}
            </div>
          </div>
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[180px] bg-sky-950 text-white rounded-md border border-white/20 p-1 shadow-md animate-in fade-in-80 z-50">
          <ContextMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Handover erstellen
          </ContextMenu.Label>
          <ContextMenu.Separator className="h-px bg-white/10 my-1" />

          {HANDOVER_TYPES.map((type) => (
            <ContextMenu.Item
              key={type}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-white/10 focus:text-white"
              onSelect={() => onHandover(ticket, type)}
            >
              {type}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/* ------------------------------------------------ */
/* PAGE                                             */
/* ------------------------------------------------ */

const Tickets: React.FC = () => {
  const [activeQueue, setActiveQueue] = useState<string>("SmartHands");
  const [groups, setGroups] = useState<Record<string, QueueGroup[]>>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  /* Handover Modal State */
  const [handoverTicket, setHandoverTicket] = useState<Ticket | null>(null);
  const [handoverType, setHandoverType] = useState<HandoverType>("Workload");
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);

  const openHandover = useCallback((ticket: Ticket, type: HandoverType) => {
    setHandoverTicket(ticket);
    setHandoverType(type);
    setIsHandoverOpen(true);
  }, []);
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t: number) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Init - Fetch Groups
  useEffect(() => {
    fetchGroups();
    const interval = setInterval(fetchGroups, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Tickets when Queue Changes
  useEffect(() => {
    fetchTickets();
  }, [activeQueue]);

  const fetchGroups = async () => {
    try {
      const data = await QueueApi.getGroups();
      setGroups(data);
    } catch (err) {
      console.error("Group fetch error", err);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await QueueApi.getTickets(activeQueue);
      setTickets(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  // Render Sidebar
  const renderSidebar = () => {
    const queueTypes = ["SmartHands", "TroubleTickets", "CCInstalls"];

    return (
      <EnterpriseCard className="w-[250px] min-w-[250px] overflow-y-auto mr-4">
        <h3 className="mb-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Queues</h3>
        {queueTypes.map((type) => (
          <div key={type} className="mb-5">
            <div
              onClick={() => setActiveQueue(type)}
              className={`cursor-pointer mb-2 text-base transition-colors ${activeQueue === type
                ? "font-bold text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {type}
            </div>
            <div className="ml-3 text-sm text-muted-foreground space-y-0.5">
              {(groups[type] || []).map((g) => (
                <div key={g.name} className="flex justify-between">
                  <span>{g.name}</span>
                  <span className="font-semibold text-foreground">{g.count}</span>
                </div>
              ))}
              {(!groups[type] || groups[type].length === 0) && (
                <div className="italic text-xs">No groups</div>
              )}
            </div>
          </div>
        ))}
      </EnterpriseCard>
    );
  };

  return (
    <EnterprisePageShell style={{ flexDirection: "row", overflow: "hidden", padding: "18px" }}>
      {renderSidebar()}

      <div className="flex-1 overflow-hidden flex flex-col gap-4">
        {/* Header */}
        <EnterpriseHeader
          title={activeQueue.toUpperCase()}
          subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Last updated: {lastRefreshed.toLocaleTimeString()}</span>}
          icon={<TicketIcon className="w-5 h-5 text-indigo-400" />}
          rightContent={
            <button
              onClick={fetchTickets}
              className="px-4 py-2 rounded-lg bg-indigo-600/90 text-white hover:bg-indigo-600 transition-colors text-[11px] font-bold tracking-wider uppercase shadow-sm"
            >
              Refresh
            </button>
          }
        />

        {error && (
          <div className="text-red-400 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            Error: {error}
          </div>
        )}

        {/* Main Content Area */}
        <EnterpriseCard noPadding className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Fixed Header Row */}
          <div className="grid grid-cols-7 gap-4 px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 bg-white/[0.02]">
            <div>Activity</div>
            <div>Owner</div>
            <div>System Name</div>
            <div>Revised Commit Date</div>
            <div>Remaining Time</div>
            <div>Sched. Start</div>
          </div>

          {/* Tile Grid */}
          <div className="flex-1 overflow-auto space-y-2 p-4">
            {loading ? (
              <div className="py-8 text-center text-[13px] text-[#4b5563]">Lade Tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#4b5563]">
                Keine Daten
              </div>
            ) : (
              tickets.map((t) => (
                <TicketTile key={t.id} ticket={t} onHandover={openHandover} />
              ))
            )}
          </div>
        </EnterpriseCard>

        {handoverTicket && (
          <CreateHandoverModal
            ticket={handoverTicket}
            isOpen={isHandoverOpen}
            onClose={() => setIsHandoverOpen(false)}
            defaultType={handoverType}
          />
        )}
      </div>
    </EnterprisePageShell>
  );
};

export default Tickets;

/* ------------------------------------------------ */
/* TV DASHBOARD PAGE (FIXED LAYOUT)                 */
/* ------------------------------------------------ */

import { useEffect, useState } from "react";
import { Ticket, Monitor } from "lucide-react";
import type { DashboardInfoEntry } from "../../api/dashboard";
import { api } from "../../api/api";
import { TVContent } from "../tv/TVContent";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";
import { formatDate, formatTime } from "../../utils/dateFormat";
import { WeatherDisplay } from "../WeatherDisplay";

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

function TVDashboard() {
  const [now, setNow] = useState(new Date());
  const [tickets, setTickets] = useState<any[]>([]);
  const [infoEntries, setInfoEntries] = useState<DashboardInfoEntry[]>([]);

  const fetchTickets = async () => {
    try {
      const res = await api.get("/tv/tickets", { params: { limit: 50 } });
      const list = Array.isArray(res.data) ? res.data : [];
      setTickets(list);
    } catch (e) {
      console.error("Failed to fetch tickets for TV", e);
      setTickets([]);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/tv/info-entries");
        setInfoEntries(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        setInfoEntries([]);
      }
    };
    load();
    const int = setInterval(load, 30000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    fetchTickets();
    const int = setInterval(fetchTickets, 60000);
    return () => clearInterval(int);
  }, []);

  return (
    <EnterprisePageShell>
      {/* INFO BAR – Informationen und Anweisungen */}
      {infoEntries.length > 0 && (
        <EnterpriseCard noPadding={false} className="border-red-500/30 bg-red-500/10 mb-4 animate-in slide-in-from-top duration-500 flex flex-col items-center justify-center text-center">
          <div className="max-w-4xl text-center">
            <h2 className="text-xl font-bold text-red-500 mb-1 tracking-widest uppercase">Informationen und Anweisungen</h2>
            <div className="space-y-1">
              {infoEntries.map((e) => (
                <p key={e.id} className="text-2xl font-mono text-white whitespace-pre-wrap">{e.content}</p>
              ))}
            </div>
          </div>
        </EnterpriseCard>
      )}

      {/* HEADER */}
      <EnterpriseHeader
        title="TV DASHBOARD"
        subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ansicht für Displays im Dienstraum</span>}
        icon={<Monitor className="w-5 h-5 text-indigo-400" />}
        rightContent={
          <div className="flex items-center gap-3">
            <WeatherDisplay />
            <div className="text-[11px] font-bold tracking-wider text-muted-foreground bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center justify-center">
              {formatDate(now)}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-muted-foreground bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center justify-center">
              {formatTime(now)}
            </div>

            <button
              onClick={() => window.open("/tv-fullscreen", "_blank")}
              className="px-4 py-1.5 rounded-lg bg-indigo-600/90 text-white font-bold uppercase tracking-wider text-[11px] hover:bg-indigo-600 transition shadow-sm"
            >
              TV Ansicht
            </button>
          </div>
        }
      />

      {/* CONTENT (darf wachsen!) */}
      <div className="flex-1 min-h-0">
        <TVContent />
      </div>
    </EnterprisePageShell>
  );
}

/* ------------------------------------------------ */
/* EXPORT                                           */
/* ------------------------------------------------ */

export default TVDashboard;

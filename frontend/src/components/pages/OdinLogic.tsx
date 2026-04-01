/* ------------------------------------------------ */
/* ODIN-LOGIK – MAIN PAGE (Tabbed)                  */
/* Sub-tabs: Status, Runs & Logs, Entscheidungen,   */
/*           Manuelle Zuweisung                      */
/* ------------------------------------------------ */

import { useState } from "react";
import { Brain, Activity, ListChecks, ShieldBan, Settings2 } from "lucide-react";
import OdinStatus from "../odinlogic/OdinStatus";
import OdinRuns from "../odinlogic/OdinRuns";
import OdinDecisions from "../odinlogic/OdinDecisions";
import OdinExclusions from "../odinlogic/OdinExclusions";
import OdinConfig from "../odinlogic/OdinConfig";

const TABS = [
  { key: "status", label: "Status & Steuerung", icon: Activity },
  { key: "runs", label: "Runs & Logs", icon: ListChecks },
  { key: "decisions", label: "Ticketentscheidungen", icon: Brain },
  { key: "exclusions", label: "Manuelle Zuweisung", icon: ShieldBan },
  { key: "config", label: "Einstellungen", icon: Settings2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function OdinLogic() {
  const [activeTab, setActiveTab] = useState<TabKey>("status");

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">ODIN-Logik</h1>
          <p className="text-xs text-muted-foreground">Assignment Engine · Shadow Mode · Entscheidungstransparenz</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-white/10 pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                active
                  ? "bg-white/5 border border-white/10 border-b-transparent text-white -mb-px"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        {activeTab === "status" && <OdinStatus />}
        {activeTab === "runs" && <OdinRuns />}
        {activeTab === "decisions" && <OdinDecisions />}
        {activeTab === "exclusions" && <OdinExclusions />}
        {activeTab === "config" && <OdinConfig />}
      </div>
    </div>
  );
}

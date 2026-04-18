/* ------------------------------------------------ */
/* COLO 2.0 PAGE                                    */
/* ------------------------------------------------ */
import { useState } from "react";
import { Database, LayoutDashboard, List, Network } from "lucide-react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import { useLanguage } from "../../context/LanguageContext";

function ColoDashboard() {
  const { t } = useLanguage();
  return (
    <EnterpriseCard className="flex flex-col items-center justify-center gap-4 text-center max-w-md w-full py-10 mx-auto">
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <LayoutDashboard className="w-6 h-6 text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-white">{t("dbs.coloDashboardTitle")}</h2>
      <p className="text-[13px] text-slate-500 max-w-xs">
        {t("dbs.coloDashboardDesc")}
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold tracking-wider uppercase">
        Coming Soon
      </div>
    </EnterpriseCard>
  );
}

function ColoFullList() {
  const { t } = useLanguage();
  return (
    <EnterpriseCard className="flex flex-col items-center justify-center gap-4 text-center max-w-md w-full py-10 mx-auto">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <List className="w-6 h-6 text-amber-400" />
      </div>
      <h2 className="text-xl font-bold text-white">{t("dbs.completeListTitle")}</h2>
      <p className="text-[13px] text-slate-500 max-w-xs">
        {t("dbs.completeListDesc")}
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold tracking-wider uppercase">
        Coming Soon
      </div>
    </EnterpriseCard>
  );
}

function ColoNetworkView() {
  const { t } = useLanguage();
  return (
    <EnterpriseCard className="flex flex-col items-center justify-center gap-4 text-center max-w-md w-full py-10 mx-auto">
      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
        <Network className="w-6 h-6 text-purple-400" />
      </div>
      <h2 className="text-xl font-bold text-white">{t("dbs.networkViewTitle")}</h2>
      <p className="text-[13px] text-slate-500 max-w-xs">
        {t("dbs.networkViewDesc")}
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-bold tracking-wider uppercase">
        Coming Soon
      </div>
    </EnterpriseCard>
  );
}

export default function DBSPage() {
  const { t } = useLanguage();
  const tabs = [
    { label: "Dashboard", path: "/dbs", end: true, icon: LayoutDashboard, color: "blue" },
    { label: t("dbs.completeListTitle"), path: "/dbs/fulllist", end: false, icon: List, color: "amber" },
    { label: t("dbs.networkViewTitle"), path: "/dbs/network", end: false, icon: Network, color: "purple" },
  ];

  return (
    <EnterprisePageShell>
      {/* HEADER */}
      <EnterpriseHeader
        title="COLO 2.0"
        subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("dbs.pageSubtitle")}</span>}
        icon={<Database className="w-5 h-5 text-amber-400" />}
      />

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            end={t.end}
            className={({ isActive }) =>
              `shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
                isActive
                  ? `bg-${t.color}-500/20 border-${t.color}-500/30 text-${t.color}-300`
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10"
              }`
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </NavLink>
        ))}
      </div>

      {/* CONTENT */}
      <Routes>
        <Route index element={<ColoDashboard />} />
        <Route path="fulllist" element={<ColoFullList />} />
        <Route path="network" element={<ColoNetworkView />} />
        <Route path="*" element={<Navigate to="/dbs" replace />} />
      </Routes>
    </EnterprisePageShell>
  );
}


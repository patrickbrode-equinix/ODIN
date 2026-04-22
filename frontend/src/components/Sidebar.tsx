/* ———————————————————————————————— */
/* SIDEBAR – FINAL (ACCESS LEVEL BASED)             */
/* ———————————————————————————————— */

import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage, type TranslationKey } from "../context/LanguageContext";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { useHandoverStore } from "../store/handoverStore";
import { AppTutorialDialog } from "./AppTutorialDialog";

/* Icon glow class – consistent subtle glow on all nav icons */
const ICON_GLOW = "drop-shadow-[0_0_4px_rgba(59,130,246,0.3)]";
const ICON_ACTIVE_GLOW = "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]";


/* NAV CONFIG */
import {
  NAV_TOP,
  NAV_BOTTOM,
  groupLabel,
  normalizeGroup,
} from "../config/navigation";

/* ———————————————————————————————— */
/* COMPONENT                                        */
/* ———————————————————————————————— */

interface SidebarProps {
  isCollapsed: boolean;
}

const NAV_TRANSLATION_KEYS: Partial<Record<string, TranslationKey>> = {
  dashboard: "nav.dashboard",
  shiftplan: "nav.shiftplan",
  handover: "nav.handover",
  tickets: "nav.tickets",
  tv_dashboard: "nav.tvDashboard",
  protokoll: "nav.protokoll",
  commit_compliance: "nav.commitCompliance",
  odin_logic: "nav.odinLogic",
  shiftplan_control: "nav.shiftplanControl",
  teams_center: "nav.teamsCenter",
  admin_settings: "nav.adminSettings",
  user_management: "nav.userManagement",
  ticket_audit: "nav.ticketAudit",
};

export function Sidebar({ isCollapsed }: SidebarProps) {
  const { user, canAccess } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [shiftplanOpen, setShiftplanOpen] = useState(true);
  const [dashOpen, setDashOpen] = useState(false);
  const [protokollOpen, setProtokollOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  if (!user) return null;

  const group = normalizeGroup(user.group);
  const teamLabel = groupLabel(group);
  const shiftplanChildPaths = new Set(["/shiftplan-control"]);
  const canAccessAdminHub =
    canAccess("admin_settings", "view")
    || canAccess("teams_center", "view")
    || canAccess("shiftplan_control", "view")
    || canAccess("odin_logic", "view");

  /* ———————————————————————————————— */
  /* FILTERED NAV (FINAL)               */
  /* ———————————————————————————————— */

  const topItems = NAV_TOP.filter((item) => {
    // TV Dashboard is reserved for the master account (root)
    if (item.pageKey === "tv_dashboard" && !user?.isRoot) return false;
    return (item.pageKey === "admin_settings" ? canAccessAdminHub : canAccess(item.pageKey, "view")) && !shiftplanChildPaths.has(item.to);
  });

  const shiftplanChildItems = NAV_TOP.filter((item) =>
    shiftplanChildPaths.has(item.to) && canAccess(item.pageKey, "view")
  );

  const bottomItems = NAV_BOTTOM.filter((item) =>
    canAccess(item.pageKey, "view")
  );

  const isoWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
  };
  const currentKW = isoWeek(new Date());
  const isShiftplanActive = location.pathname.startsWith("/shiftplan")
    || shiftplanChildItems.some((item) => location.pathname.startsWith(item.to));
  const isDashActive = location.pathname.startsWith("/dashboard");
  const isProtokollActive = location.pathname.startsWith("/protokoll");
  const labelForItem = (pageKey: string, fallback: string) => {
    const translationKey = NAV_TRANSLATION_KEYS[pageKey];
    return translationKey ? t(translationKey) : fallback;
  };

  return (
    <aside
      className={`bg-sidebar border-r border-sidebar-border flex flex-col backdrop-blur-xl transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}
    >
      <AppTutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />

      {/* HEADER */}
      <div
        className={`w-full border-b border-sidebar-border flex items-center ${isCollapsed ? "justify-center" : "px-3"} transition-all ${isCollapsed ? "h-20" : "h-32"
          }`}
      >
        {!isCollapsed ? (
          <div className="flex flex-col justify-center w-full px-1 py-2 overflow-hidden gap-1">
            <div className="flex items-center gap-3 w-full pl-1">
              <img
                src="/app/ODIN_Logo.png"
                alt="ODIN Logo"
                className="w-12 h-12 md:w-14 md:h-14 object-contain shrink-0 drop-shadow-[0_0_12px_rgba(0,216,255,0.6)]"
              />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <span className="text-[28px] font-black tracking-[0.15em] text-[#00d8ff] drop-shadow-[0_0_10px_rgba(0,216,255,0.8)] leading-none">
                  O.D.I.N
                </span>
              </div>
            </div>
            <div className="text-[10px] md:text-[11px] leading-snug font-semibold text-[#00d8ff] drop-shadow-[0_0_8px_rgba(0,216,255,0.7)] text-left pl-1 whitespace-normal">
              {t("nav.operationsNode")}
            </div>
          </div>
        ) : (
          <img
            src="/app/ODIN_Logo.png"
            alt="ODIN Logo"
            className="w-12 h-12 object-contain drop-shadow-[0_0_12px_rgba(0,216,255,0.6)] mt-2"
          />
        )}
      </div>

      {/* NAV – TOP */}
      <nav className="flex-1 p-4 space-y-2">
        {topItems.map((item) => {
          // Special: expandable Dashboard
          if (item.to === "/dashboard") {
            const baseClass = ({ isActive }: { isActive: boolean }) =>
              `flex items-center rounded-xl transition-all duration-200 ${isActive || isDashActive
                ? "bg-blue-500/20 border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-blue-100"
                : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/70 hover:bg-blue-500/20 hover:border-blue-400/20 hover:shadow-[0_0_18px_rgba(59,130,246,0.25)] hover:text-blue-100 hover:scale-[1.01] transition-all duration-200 ease-out"
              } ${isCollapsed ? "justify-center h-11 w-11 mx-auto" : "gap-4 px-5 py-4 pr-12 w-full"}`;

            return (
              <div key={item.to} className="space-y-2">
                <div className="flex items-center relative">
                  <NavLink to={item.to} end className={(props) => baseClass(props)}>
                    <item.icon className={`h-6 w-6 shrink-0 ${isDashActive ? ICON_ACTIVE_GLOW : ICON_GLOW}`} />
                    {!isCollapsed && <span className="flex-1">{labelForItem(item.pageKey, item.label)}</span>}
                  </NavLink>

                  {!isCollapsed ? (
                    <button
                      type="button"
                      className={`absolute right-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition ${isDashActive ? "text-sidebar-primary" : "text-sidebar-foreground"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDashOpen((v) => !v);
                      }}
                      aria-label={dashOpen ? t("sidebar.collapseDashboard") : t("sidebar.expandDashboard")}
                    >
                      {dashOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  ) : null}
                </div>

                {!isCollapsed && dashOpen ? (
                  <div className="ml-10 space-y-1">
                    <NavLink
                      to="/dashboard/statistiken"
                      className={({ isActive }) =>
                        `block px-4 py-2 rounded-lg text-sm transition ${isActive
                          ? "bg-blue-500/20 border border-blue-400/20 text-blue-100"
                          : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/65 hover:bg-blue-500/20 hover:border-blue-400/20 hover:text-blue-100 transition-all duration-200 ease-out"
                        }`
                      }
                    >
                      {t("nav.statistics")}
                    </NavLink>
                    {user?.isRoot && (
                      <NavLink
                        to="/dashboard/ticket-audit"
                        className={({ isActive }) =>
                          `block px-4 py-2 rounded-lg text-sm transition ${isActive
                            ? "bg-indigo-500/20 border border-indigo-400/20 text-indigo-100"
                            : "bg-indigo-500/10 border border-indigo-400/10 text-sidebar-foreground/65 hover:bg-indigo-500/20 hover:border-indigo-400/20 hover:text-indigo-100 transition-all duration-200 ease-out"
                          }`
                        }
                      >
                        {t("nav.ticketAudit")}
                      </NavLink>
                    )}
                  </div>
                ) : null}
              </div>
            );
          }

          // Special: expandable Shiftplan
          if (item.to === "/shiftplan") {
            const baseClass = ({ isActive }: { isActive: boolean }) =>
              `flex items-center rounded-xl transition-all duration-200 ${isActive || isShiftplanActive
                ? "bg-blue-500/20 border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-blue-100"
                : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/70 hover:bg-blue-500/20 hover:border-blue-400/20 hover:shadow-[0_0_18px_rgba(59,130,246,0.25)] hover:text-blue-100 hover:scale-[1.01] transition-all duration-200 ease-out"
              } ${isCollapsed ? "justify-center h-11 w-11 mx-auto" : "gap-4 px-5 py-4 pr-12 w-full"}`;

            return (
              <div key={item.to} className="space-y-2">
                <div className="flex items-center relative">
                  <NavLink to={item.to} className={(props) => baseClass(props)}>
                    <item.icon className={`h-6 w-6 shrink-0 ${isShiftplanActive ? ICON_ACTIVE_GLOW : ICON_GLOW}`} />
                    {!isCollapsed && <span className="flex-1">{labelForItem(item.pageKey, item.label)}</span>}
                  </NavLink>

                  {!isCollapsed ? (
                    <button
                      type="button"
                      className={`absolute right-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition ${isShiftplanActive ? "text-sidebar-primary" : "text-sidebar-foreground"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShiftplanOpen((v) => !v);
                      }}
                      aria-label={shiftplanOpen ? t("sidebar.collapseShiftplan") : t("sidebar.expandShiftplan")}
                    >
                      {shiftplanOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  ) : null}
                </div>

                {!isCollapsed && shiftplanOpen ? (
                  <div className="ml-10 space-y-1">
                    <NavLink
                      to="/shiftplan/week"
                      className={({ isActive }) =>
                        `block px-4 py-2 rounded-lg text-sm transition ${isActive
                          ? "bg-blue-500/20 border border-blue-400/20 text-blue-100"
                          : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/65 hover:bg-blue-500/20 hover:border-blue-400/20 hover:text-blue-100 transition-all duration-200 ease-out"
                        }`
                      }
                    >
                      {t("nav.weekPlanning")}
                    </NavLink>
                    {shiftplanChildItems.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `block px-4 py-2 rounded-lg text-sm transition ${isActive
                            ? "bg-blue-500/20 border border-blue-400/20 text-blue-100"
                            : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/65 hover:bg-blue-500/20 hover:border-blue-400/20 hover:text-blue-100 transition-all duration-200 ease-out"
                          }`
                        }
                      >
                        {labelForItem(child.pageKey, child.label)}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }

          // Special: expandable Protokoll
          if (item.to === "/protokoll") {
            const baseClass = ({ isActive }: { isActive: boolean }) =>
              `flex items-center rounded-xl transition-all duration-200 ${isActive || isProtokollActive
                ? "bg-blue-500/20 border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-blue-100"
                : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/70 hover:bg-blue-500/20 hover:border-blue-400/20 hover:shadow-[0_0_18px_rgba(59,130,246,0.25)] hover:text-blue-100 hover:scale-[1.01] transition-all duration-200 ease-out"
              } ${isCollapsed ? "justify-center h-11 w-11 mx-auto" : "gap-4 px-5 py-4 pr-12 w-full"}`;

            return (
              <div key={item.to} className="space-y-2">
                <div className="flex items-center relative">
                  <NavLink to={item.to} end className={(props) => baseClass(props)}>
                    <item.icon className={`h-6 w-6 shrink-0 ${isProtokollActive ? ICON_ACTIVE_GLOW : ICON_GLOW}`} />
                    {!isCollapsed && <span className="flex-1">{labelForItem(item.pageKey, item.label)}</span>}
                  </NavLink>

                  {!isCollapsed ? (
                    <button
                      type="button"
                      className={`absolute right-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition ${isProtokollActive ? "text-sidebar-primary" : "text-sidebar-foreground"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProtokollOpen((v) => !v);
                      }}
                      aria-label={protokollOpen ? t("sidebar.collapseLog") : t("sidebar.expandLog")}
                    >
                      {protokollOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  ) : null}
                </div>

                {!isCollapsed && protokollOpen ? (
                  <div className="ml-10 space-y-1">
                    <NavLink
                      to="/protokoll/teams-benachrichtigungen"
                      className={({ isActive }) =>
                        `block px-4 py-2 rounded-lg text-sm transition ${isActive
                          ? "bg-blue-500/20 border border-blue-400/20 text-blue-100"
                          : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/65 hover:bg-blue-500/20 hover:border-blue-400/20 hover:text-blue-100 transition-all duration-200 ease-out"
                        }`
                      }
                    >
                      {t("nav.teamsNotifications")}
                    </NavLink>
                    <NavLink
                      to="/protokoll/automated-assignment"
                      className={({ isActive }) =>
                        `block px-4 py-2 rounded-lg text-sm transition ${isActive
                          ? "bg-blue-500/20 border border-blue-400/20 text-blue-100"
                          : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/65 hover:bg-blue-500/20 hover:border-blue-400/20 hover:text-blue-100 transition-all duration-200 ease-out"
                        }`
                      }
                    >
                      {t("nav.automatedAssignment")}
                    </NavLink>
                  </div>
                ) : null}
              </div>
            );
          }

          // Special: Handover Badge

          if (item.pageKey === "handover") {
            const count = useHandoverStore((s) => s.handovers.filter(h => h.status !== "Erledigt").length);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center rounded-xl transition-all duration-200 ${isActive
                    ? "bg-blue-500/20 border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-blue-100"
                    : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/70 hover:bg-blue-500/20 hover:border-blue-400/20 hover:shadow-[0_0_18px_rgba(59,130,246,0.25)] hover:text-blue-100 hover:scale-[1.01] transition-all duration-200 ease-out"
                  } ${isCollapsed ? "justify-center h-11 w-11 mx-auto" : "gap-4 px-5 py-4 w-full"}`
                }
              >
                <div className="relative">
                  <item.icon className={`h-6 w-6 shrink-0 ${ICON_GLOW}`} />
                  {count > 0 && isCollapsed && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="flex flex-1 justify-between items-center">
                    <span>{labelForItem(item.pageKey, item.label)}</span>
                    {count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                        {count}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          }

          // Standard Item
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center rounded-xl transition-all duration-200 ${isActive
                  ? "bg-blue-500/20 border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-blue-100"
                  : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/70 hover:bg-blue-500/20 hover:border-blue-400/20 hover:shadow-[0_0_18px_rgba(59,130,246,0.25)] hover:text-blue-100 hover:scale-[1.01] transition-all duration-200 ease-out"
                } ${isCollapsed ? "justify-center h-11 w-11 mx-auto" : "gap-4 px-5 py-4 w-full"}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-6 w-6 shrink-0 ${isActive ? ICON_ACTIVE_GLOW : ICON_GLOW}`} />
                  {!isCollapsed && <span>{labelForItem(item.pageKey, item.label)}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* NAV – BOTTOM */}
      <div className="p-4 space-y-2">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center rounded-xl transition-all duration-200 ${isActive
                ? "bg-blue-500/20 border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-blue-100"
                : "bg-blue-500/10 border border-blue-400/10 text-sidebar-foreground/70 hover:bg-blue-500/20 hover:border-blue-400/20 hover:shadow-[0_0_18px_rgba(59,130,246,0.25)] hover:text-blue-100 hover:scale-[1.01] transition-all duration-200 ease-out"
              } ${isCollapsed ? "justify-center h-11 w-11 mx-auto" : "gap-4 px-5 py-4 w-full"}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`h-6 w-6 shrink-0 ${isActive ? ICON_ACTIVE_GLOW : ICON_GLOW}`} />
                {!isCollapsed && <span>{labelForItem(item.pageKey, item.label)}</span>}
              </>
            )}
          </NavLink>
        ))}

      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-sidebar-border flex flex-col items-center justify-center gap-1 text-center text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{isCollapsed ? "v1" : "v1.0.0 2026"}</span>
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse tracking-widest uppercase">BETA</span>
        </div>
        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          className={`theme-glass-inset inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:border-sky-300/30 hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-100 ${isCollapsed ? "px-2" : ""}`}
          title={t("sidebar.openTutorial")}
        >
          <BookOpen className="h-3.5 w-3.5" />
          {!isCollapsed ? <span>{t("sidebar.tutorial")}</span> : null}
        </button>
      </div>
    </aside>
  );
}

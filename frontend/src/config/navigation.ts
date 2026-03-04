/* ———————————————————————————————— */
/* NAVIGATION CONFIG (STRUCTURE ONLY)               */
/* RBAC happens in AuthContext / PageGuard          */
/* ———————————————————————————————— */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Settings,
  Tv,
  Users as UsersIcon,
  Ticket,
  Database,
  ScrollText,
  FileCheck,
} from "lucide-react";

/* ———————————————————————————————— */
/* TYPES                                            */
/* ———————————————————————————————— */

export type NavSection = "top" | "bottom";

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  section: NavSection;
  pageKey: string;
};

/* ———————————————————————————————— */
/* GROUP HELPERS                                    */
/* ———————————————————————————————— */

export function normalizeGroup(value?: string | null): string {
  return String(value || "other")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function groupLabel(group: string): string {
  if (group === "c-ops") return "C-OPS Team";
  if (group === "f-ops") return "F-OPS Team";
  return "Other Team";
}

/* ———————————————————————————————— */
/* NAV ITEMS                                        */
/* ———————————————————————————————— */

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", section: "top", pageKey: "dashboard" },
  { to: "/shiftplan", icon: Calendar, label: "Schichtplan", section: "top", pageKey: "shiftplan" },
  { to: "/handover", icon: FileText, label: "Handover", section: "top", pageKey: "handover" },
  { to: "/tickets", icon: Ticket, label: "Tickets", section: "top", pageKey: "tickets" },

  { to: "/tv-dashboard", icon: Tv, label: "TV Dashboard", section: "top", pageKey: "tv_dashboard" },

  { to: "/dbs", icon: Database, label: "Colo 2.0", section: "top", pageKey: "dbs" },

  { to: "/protokoll", icon: ScrollText, label: "Protokoll", section: "top", pageKey: "protokoll" },
  { to: "/commit-compliance", icon: FileCheck, label: "Commit Compliance", section: "top", pageKey: "commit_compliance" },
  { to: "/users", icon: UsersIcon, label: "User Management", section: "top", pageKey: "user_management" },
  // Settings hidden from sidebar (still accessible via /settings directly)
];

export const NAV_TOP = NAV_ITEMS.filter((i) => i.section === "top");
export const NAV_BOTTOM = NAV_ITEMS.filter((i) => i.section === "bottom");

/* ———————————————————————————————— */
/* PAGE DEFINITIONS (Policy UI)                     */
/* ———————————————————————————————— */

export const PAGE_DEFS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "shiftplan", label: "Shiftplan" },
  { key: "handover", label: "Handover" },
  { key: "tickets", label: "Tickets" },

  { key: "tv_dashboard", label: "TV Dashboard" },
  { key: "dbs", label: "Colo 2.0" },
  { key: "protokoll", label: "Protokoll" },
  { key: "commit_compliance", label: "Commit Compliance" },
  { key: "settings", label: "Settings" },
  { key: "user_management", label: "User Management" },
] as const;

export type PageKey = (typeof PAGE_DEFS)[number]["key"];

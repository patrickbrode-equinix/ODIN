/**
 * weekplanRoleStore.ts
 *
 * Zustand store for weekplan role assignments.
 * Central data source used by both Wochenplan and Dashboard.
 * Roles are persisted in the database via /api/weekplan-roles.
 */

import { create } from "zustand";
import { api } from "../api/api";

/* ---- Role definitions ---- */
export const WEEKPLAN_ROLES = [
  { key: "dispatcher", label: "Dispatcher", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { key: "dbs_project", label: "DBS Project", color: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30" },
  { key: "colo", label: "COLO", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { key: "largeorder", label: "Largeorder", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { key: "projekt", label: "Projekt", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  { key: "lead", label: "Lead", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { key: "buddy", label: "Buddy", color: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  { key: "neueinsteiger", label: "Neueinsteiger", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  { key: "cc", label: "CC", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
] as const;

export type WeekplanRoleKey = typeof WEEKPLAN_ROLES[number]["key"];

export interface WeekplanRoleEntry {
  employee_name: string;
  date: string; // YYYY-MM-DD
  role_key: WeekplanRoleKey;
}

/** Lookup role definition by key */
export function getRoleDef(key: string) {
  return WEEKPLAN_ROLES.find((r) => r.key === key);
}

interface WeekplanRoleState {
  /** Map: "employeeName|YYYY-MM-DD" → role_key */
  roles: Record<string, WeekplanRoleKey>;
  /** Loading state */
  loading: boolean;

  /** Fetch roles for a date range */
  fetchRoles: (from: string, to: string) => Promise<void>;

  /** Fetch roles for today (used by Dashboard) */
  fetchTodayRoles: () => Promise<void>;

  /** Get role for employee on a specific date */
  getRole: (employeeName: string, date: string) => WeekplanRoleKey | undefined;

  /** Set role for employee on a specific date (persists to DB) */
  setRole: (employeeName: string, date: string, roleKey: WeekplanRoleKey) => Promise<void>;

  /** Set role for employee on multiple dates (persists to DB) */
  setBulkRoles: (employeeName: string, dates: string[], roleKey: WeekplanRoleKey) => Promise<void>;

  /** Remove role for employee on a specific date */
  removeRole: (employeeName: string, date: string) => Promise<void>;
}

function makeKey(employeeName: string, date: string): string {
  return `${employeeName}|${date}`;
}

export const useWeekplanRoleStore = create<WeekplanRoleState>()((set, get) => ({
  roles: {},
  loading: false,

  fetchRoles: async (from: string, to: string) => {
    try {
      set({ loading: true });
      const res = await api.get("/weekplan-roles", { params: { from, to } });
      const rows: WeekplanRoleEntry[] = Array.isArray(res.data) ? res.data : [];
      const map: Record<string, WeekplanRoleKey> = { ...get().roles };
      for (const r of rows) {
        const dateStr = typeof r.date === "string" ? r.date.split("T")[0] : r.date;
        map[makeKey(r.employee_name, dateStr)] = r.role_key as WeekplanRoleKey;
      }
      set({ roles: map, loading: false });
    } catch (err) {
      console.error("[weekplanRoleStore] fetchRoles failed:", err);
      set({ loading: false });
    }
  },

  fetchTodayRoles: async () => {
    try {
      set({ loading: true });
      const res = await api.get("/weekplan-roles/today");
      const rows: WeekplanRoleEntry[] = Array.isArray(res.data) ? res.data : [];
      const map: Record<string, WeekplanRoleKey> = { ...get().roles };
      for (const r of rows) {
        const dateStr = typeof r.date === "string" ? r.date.split("T")[0] : r.date;
        map[makeKey(r.employee_name, dateStr)] = r.role_key as WeekplanRoleKey;
      }
      set({ roles: map, loading: false });
    } catch (err) {
      console.error("[weekplanRoleStore] fetchTodayRoles failed:", err);
      set({ loading: false });
    }
  },

  getRole: (employeeName: string, date: string) => {
    return get().roles[makeKey(employeeName, date)];
  },

  setRole: async (employeeName: string, date: string, roleKey: WeekplanRoleKey) => {
    // Optimistic update
    set((state) => ({
      roles: { ...state.roles, [makeKey(employeeName, date)]: roleKey },
    }));

    try {
      await api.put("/weekplan-roles", {
        employee_name: employeeName,
        date,
        role_key: roleKey,
      });
    } catch (err) {
      console.error("[weekplanRoleStore] setRole failed:", err);
      // Revert on failure
      set((state) => {
        const next = { ...state.roles };
        delete next[makeKey(employeeName, date)];
        return { roles: next };
      });
    }
  },

  setBulkRoles: async (employeeName: string, dates: string[], roleKey: WeekplanRoleKey) => {
    // Optimistic update
    set((state) => {
      const next = { ...state.roles };
      for (const d of dates) {
        next[makeKey(employeeName, d)] = roleKey;
      }
      return { roles: next };
    });

    try {
      await api.put("/weekplan-roles/bulk", {
        assignments: dates.map((d) => ({
          employee_name: employeeName,
          date: d,
          role_key: roleKey,
        })),
      });
    } catch (err) {
      console.error("[weekplanRoleStore] setBulkRoles failed:", err);
      // Revert on failure
      set((state) => {
        const next = { ...state.roles };
        for (const d of dates) {
          delete next[makeKey(employeeName, d)];
        }
        return { roles: next };
      });
    }
  },

  removeRole: async (employeeName: string, date: string) => {
    const key = makeKey(employeeName, date);
    const prev = get().roles[key];

    // Optimistic update
    set((state) => {
      const next = { ...state.roles };
      delete next[key];
      return { roles: next };
    });

    try {
      await api.delete("/weekplan-roles", {
        data: { employee_name: employeeName, date },
      });
    } catch (err) {
      console.error("[weekplanRoleStore] removeRole failed:", err);
      // Revert on failure
      if (prev) {
        set((state) => ({
          roles: { ...state.roles, [key]: prev },
        }));
      }
    }
  },
}));

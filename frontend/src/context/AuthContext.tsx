/* ———————————————————————————————— */
/* AUTH CONTEXT – SIMPLIFIED ROLE MODEL             */
/* Single source of truth: user.accessPolicy        */
/* ———————————————————————————————— */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../api/api";
import { queueApi } from "../api/queue";

/* STORES */
import { useCommitStore } from "../store/commitStore";
import { bootstrapShiftData } from "../lib/bootstrapShiftData";

/* SESSION DIALOG */
import { SessionExpiredDialog } from "./SessionExpiredDialog";

/* ———————————————————————————————— */
/* TYPES                                            */
/* ———————————————————————————————— */

export type AccessLevel = "none" | "view" | "write";

type User = {
  id: number;
  loginName: string | null;
  email: string | null;

  /* PERSON */
  firstName: string;
  lastName: string;
  displayName: string;

  /* ORG */
  group: string | null;
  location: string | null;
  team: string | null;

  /* STATUS */
  approved: boolean;
  mustChangePassword: boolean;
  isAdmin: boolean;
  isRoot: boolean;
  role: "user" | "admin";

  /* RBAC */
  accessPolicy: Record<string, AccessLevel>;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (loginName: string, password: string) => Promise<void>;
  logout: () => void;
  completeForcedPasswordChange: () => void;

  /* ACCESS */
  getLevel: (pageKey: string) => AccessLevel;
  canAccess: (pageKey: string, min?: AccessLevel) => boolean;
  canView: (pageKey: string) => boolean;
  canWrite: (pageKey: string) => boolean;
};

/* ———————————————————————————————— */
/* CONTEXT                                          */
/* ———————————————————————————————— */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ———————————————————————————————— */
/* ACCESS HELPERS                                   */
/* ———————————————————————————————— */

const LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  write: 2,
};

function normalizeLevel(value: any): AccessLevel {
  if (value === "view" || value === "write") return value;
  return "none";
}

function meets(level: AccessLevel, min: AccessLevel) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[min];
}

/* ———————————————————————————————— */
/* USER NORMALIZER (SINGLE SOURCE)                  */
/* ———————————————————————————————— */

function normalizeUser(raw: any): User {
  const rawPolicy =
    raw && typeof raw.accessPolicy === "object" ? raw.accessPolicy : {};

  const accessPolicy: Record<string, AccessLevel> = {};
  for (const [key, value] of Object.entries(rawPolicy)) {
    accessPolicy[key] = normalizeLevel(value);
  }

  const firstName = raw.firstName ?? "";
  const lastName = raw.lastName ?? "";

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    raw.displayName ||
    raw.loginName ||
    raw.email;

  return {
    id: raw.id,
    loginName: raw.loginName ?? null,
    email: raw.email ?? null,

    firstName,
    lastName,
    displayName,

    group: raw.group ?? null,
    location: raw.location ?? null,
    team: raw.team ?? null,

    approved: raw.approved === true,
    mustChangePassword: raw.mustChangePassword === true,
    isAdmin: raw.isAdmin === true,
    isRoot: raw.isRoot === true,
    role: raw.role === "admin" ? "admin" : "user",

    accessPolicy,
  };
}

/* ———————————————————————————————— */
/* PROVIDER                                         */
/* ———————————————————————————————— */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /* IDLE STATE (unchanged) */
  const [idleWarningOpen] = useState(false);
  const [idleSecondsLeft] = useState(60);

  const logoutTimerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const clearAllTimers = () => {
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current)
      window.clearInterval(countdownIntervalRef.current);
  };

  const logout = () => {
    clearAllTimers();
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setUser(null);
    useCommitStore.getState().setTickets([]); // sauber resetten
  };

  const completeForcedPasswordChange = () => {
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, mustChangePassword: false };
      localStorage.setItem("auth_user", JSON.stringify(nextUser));
      return nextUser;
    });
  };

  /* ------------------------------------------------ */
  /* COMMIT BOOTSTRAP LOAD                            */
  /* ------------------------------------------------ */

  async function loadCommitBootstrap() {
    try {
      const rows = await queueApi.getTickets();
      useCommitStore.getState().setTickets(rows as any);
    } catch (err) {
      console.error("Live ticket bootstrap load failed:", err);
      useCommitStore.getState().setTickets([]);
    }
  }

  /* ------------------------------------------------ */
  /* INIT (AUTO LOGIN)                                */
  /* ------------------------------------------------ */

  useEffect(() => {
    const stored = localStorage.getItem("auth_user");
    if (stored) {
      try {
        setUser(normalizeUser(JSON.parse(stored)));
        loadCommitBootstrap();
        bootstrapShiftData().catch(() => {}); // populate shift store for Dashboard/TV
      } catch {
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_token");
      }
    }
    setLoading(false);
  }, []);

  /* ------------------------------------------------ */
  /* LOGIN                                           */
  /* ------------------------------------------------ */

  const login = async (loginName: string, password: string) => {
    const res = await api.post("/auth/login", { loginName, password });
    const { token, user } = res.data;

    const normalized = normalizeUser(user);

    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(normalized));

    setUser(normalized);
    await loadCommitBootstrap();                     // ✅ commit data
    await bootstrapShiftData().catch(() => {});      // ✅ shift data for Dashboard/TV
  };

  /* ------------------------------------------------ */
  /* ACCESS API                                      */
  /* ------------------------------------------------ */

  const getLevel = (pageKey: string): AccessLevel => {
    if (!user) return "none";
    if (user.isRoot) return "write";
    return normalizeLevel(user.accessPolicy[pageKey]);
  };

  const canAccess = (
    pageKey: string,
    min: AccessLevel = "view"
  ): boolean => {
    if (!user) return false;
    if (user.isRoot) return true;
    return meets(getLevel(pageKey), min);
  };

  const canView = (pageKey: string): boolean => canAccess(pageKey, "view");
  const canWrite = (pageKey: string): boolean => canAccess(pageKey, "write");

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      login,
      logout,
      completeForcedPasswordChange,
      getLevel,
      canAccess,
      canView,
      canWrite,
    }),
    [user]
  );

  if (loading) return null;

  return (
    <AuthContext.Provider value={value}>
      {children}

      <SessionExpiredDialog
        open={idleWarningOpen}
        secondsLeft={idleSecondsLeft}
        onLogout={logout}
        onStay={() => { /* reset idle timer */ }}
      />
    </AuthContext.Provider>
  );
}

/* ———————————————————————————————— */
/* HOOK                                             */
/* ———————————————————————————————— */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/* ———————————————————————————————— */
/* AUTH CONTEXT – ACCESS LEVEL BASED (FINAL)        */
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

/* STORES */
import { useCommitStore } from "../store/commitStore";

/* SESSION DIALOG */
import { SessionExpiredDialog } from "./SessionExpiredDialog";

/* ———————————————————————————————— */
/* TYPES                                            */
/* ———————————————————————————————— */

export type AccessLevel = "none" | "view" | "write";

type User = {
  id: number;
  email: string;

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
  isRoot: boolean;

  /* RBAC */
  accessPolicy: Record<string, AccessLevel>;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;

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
    raw.email;

  return {
    id: raw.id,
    email: raw.email,

    firstName,
    lastName,
    displayName,

    group: raw.group ?? null,
    location: raw.location ?? null,
    team: raw.team ?? null,

    approved: raw.approved === true,
    isRoot: raw.isRoot === true,

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

  /* ------------------------------------------------ */
  /* COMMIT BOOTSTRAP LOAD                            */
  /* ------------------------------------------------ */

  async function loadCommitBootstrap() {
    try {
      const res = await api.get("/commit/latest");
      const payload = res.data;

      let rows: any[] = [];

      if (Array.isArray(payload)) rows = payload;
      else if (Array.isArray(payload?.data)) rows = payload.data;
      else if (Array.isArray(payload?.rows)) rows = payload.rows;

      useCommitStore.getState().setTickets(rows);
    } catch (err) {
      console.error("Commit bootstrap load failed:", err);
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

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user } = res.data;

    const normalized = normalizeUser(user);

    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(normalized));

    setUser(normalized);
    await loadCommitBootstrap(); // ✅ HIER
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

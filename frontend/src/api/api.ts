/* ------------------------------------------------ */
/* API / AXIOS INSTANCE                             */
/* ------------------------------------------------ */

import axios from "axios";

/* ------------------------------------------------ */
/* AXIOS BASIS KONFIGURATION                        */
/* ------------------------------------------------ */
/**
 * Normalize VITE_API_BASE_URL so the axios baseURL always includes /api.
 * - Empty / unset         → "/api"              (container proxy mode)
 * - "/api"                → "/api"              (container proxy mode)
 * - "http://host:8001"    → "http://host:8001/api"  (dev, missing /api)
 * - "http://host:8001/api"→ "http://host:8001/api"  (dev, correct)
 * Trailing slashes are stripped.
 */
export function normalizeApiBaseUrl(raw?: string): string {
  const val = (raw ?? "").trim().replace(/\/+$/, "");
  if (!val) return "/api";
  if (val === "/api" || val.endsWith("/api")) return val;
  return val + "/api";
}

const dynamicBaseURL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const envBase = import.meta.env.VITE_API_BASE_URL;
const dynamicBaseURL = envBase && envBase.trim() ? envBase : "/api";

export const api = axios.create({
  baseURL: dynamicBaseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

/* ------------------------------------------------ */
/* REQUEST INTERCEPTOR                              */
/* JWT AUTOMATISCH ANHÄNGEN                         */
/* ------------------------------------------------ */

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");

    if (token) {
      // @ts-ignore
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ------------------------------------------------ */
/* RESPONSE INTERCEPTOR                             */
/* AUTO LOGOUT BEI 401                              */
/* ------------------------------------------------ */

api.interceptors.response.use(
  (response) => {
    // Global guard: reject HTML responses that should have been JSON
    const ct = response.headers?.["content-type"] || "";
    if (ct.includes("text/html") || detectHtml(response.data)) {
      const url = response.config?.url || "unknown";
      console.error(
        `[ODIN][API] HTML returned instead of JSON for ${url}. ` +
        `Check that VITE_API_BASE_URL is set correctly (current baseURL: ${response.config?.baseURL}).`
      );
      return Promise.reject(new Error(`API returned HTML instead of JSON for ${url}`));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token ungültig / abgelaufen
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");

      // Hard redirect (Context-unabhängig, sicher)
      // TEMP BYPASS: disabled for VM testing
      // window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);
/* ------------------------------------------------ */
/* DEFENSIVE HELPERS (Category-C Protection)        */
/* ------------------------------------------------ */

export function detectHtml(data: any): boolean {
  return typeof data === "string" && (data.includes("<!doctype html") || data.includes("<html"));
}

export function asArray(data: any, ctx: string): any[] {
  if (Array.isArray(data)) return data;

  if (detectHtml(data)) {
    console.error(`[ODIN][API] HTML returned instead of JSON in context: ${ctx}`, {
      ctx,
      preview: typeof data === "string" ? data.substring(0, 80) : "N/A",
    });
  } else {
    console.warn(`[ODIN][API] Non-array data returned in context: ${ctx}`, { ctx, type: typeof data });
  }
  return [];
}

export function asObject(data: any, ctx: string): Record<string, any> {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data;
  }

  if (detectHtml(data)) {
    console.error(`[ODIN][API] HTML returned instead of JSON in context: ${ctx}`, {
      ctx,
      preview: typeof data === "string" ? data.substring(0, 80) : "N/A",
    });
  } else {
    console.warn(`[ODIN][API] Non-object data returned in context: ${ctx}`, { ctx, type: typeof data });
  }
  return {};
}

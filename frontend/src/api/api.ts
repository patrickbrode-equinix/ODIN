/* ------------------------------------------------ */
/* API / AXIOS INSTANCE                             */
/* ------------------------------------------------ */

import axios from "axios";

/* ------------------------------------------------ */
/* AXIOS BASIS KONFIGURATION                        */
/* ------------------------------------------------ */

export const api = axios.create({
  baseURL: "/api",
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
  (response) => response,
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

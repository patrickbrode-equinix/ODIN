/* ------------------------------------------------ */
/* VITE CONFIG (REACT + API PROXY)                  */
/* ------------------------------------------------ */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Backend URL for dev proxy. Set BACKEND_URL in your .env or shell.
// Local dev default: http://127.0.0.1:5055
// Docker:           http://backend:5055   (docker-compose service name)
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:5055";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

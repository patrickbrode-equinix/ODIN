/* ------------------------------------------------ */
/* FRONTEND PRODUCTION SERVER                        */
/* Static files + /api proxy to backend              */
/* ------------------------------------------------ */

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");

const app = express();
const PORT = parseInt(process.env.PORT || "8000", 10);

// Backend URL: In host-networking mode, backend is on localhost:8001
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001";

/* ------------------------------------------------ */
/* PROXY /api/* and /uploads/* to backend            */
/* ------------------------------------------------ */

app.use(
    "/api",
    createProxyMiddleware({
        target: BACKEND_URL,
        changeOrigin: true,
    })
);

app.use(
    "/uploads",
    createProxyMiddleware({
        target: BACKEND_URL,
        changeOrigin: true,
    })
);

/* ------------------------------------------------ */
/* SERVE STATIC FILES                                */
/* ------------------------------------------------ */

app.use(express.static(path.join(__dirname, "dist")));

/* ------------------------------------------------ */
/* SPA FALLBACK – return index.html for all other    */
/* routes (React Router)                             */
/* ------------------------------------------------ */

app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* ------------------------------------------------ */
/* START                                             */
/* ------------------------------------------------ */

app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FRONTEND] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[FRONTEND] Proxying /api/* => ${BACKEND_URL}`);
});

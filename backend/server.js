/* ------------------------------------------------ */
/* OES BACKEND – MAIN ENTRY POINT (ROBUST)          */
/* ------------------------------------------------ */

// NOTE: do NOT add 'import dotenv/config' — config/index.js handles it.
import { config } from "./config/index.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// DB
import { testConnection, checkHealth } from "./db.js";

// Schema
import { initSchema } from "./db/initSchema.js";

// Routes
import queueSnapshotPublic from "./routes/queueSnapshotPublic.js";
import queueRoutes from "./routes/queue.js";
import healthRoutes from "./routes/health.js";
import metricsRoutes from "./routes/metrics.js";
import kioskRoutes from "./routes/kiosk.js";
import dashboardRoutes from "./routes/dashboard.js";
import userSettingsRoutes from "./routes/userSettings.js";
import authRoutes from "./routes/auth/index.js";
import activityRoutes from "./routes/activity.js";
import schedulesRoutes from "./routes/schedules.js";
import statusRoutes from "./routes/status.js";
import commitRoutes from "./routes/commit.js";
import ingestRoutes from "./routes/ingest.js";
import adminUsersRoutes from "./routes/adminUsers.js";
import adminGroupsRoutes from "./routes/adminGroups.js";
import handoverRoutes from "./routes/handover.js";
import commitComplianceRoutes from "./routes/commitCompliance.js";
import statsRoutes from "./routes/stats.js";
import holidaysRoutes from "./routes/holidays.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------ */
/* CONFIG                                           */
/* ------------------------------------------------ */

const app = express();
const PORT = config.PORT;

/* ------------------------------------------------ */
/* MIDDLEWARE                                       */
/* ------------------------------------------------ */

// CORS: origins from config.CORS_ORIGINS, plus allow Chrome extensions for ingest
app.use(cors({
  origin: function (origin, callback) {
    // Allow if no origin (e.g. server-to-server, or some extension environments)
    if (!origin) return callback(null, true);

    // Allow explicitly configured origins
    if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);

    // Allow any Chrome extension (important for OES Crawler background service worker)
    if (origin.startsWith('chrome-extension://')) return callback(null, true);

    // Disallow others
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));

/* ------------------------------------------------ */
/* ROUTES                                           */
/* ------------------------------------------------ */

// 1. Health + Metrics (proper route files with error handling)
app.use("/api/health", healthRoutes);
app.use("/api/metrics", metricsRoutes);

// 2. Auth
app.use("/api/auth", authRoutes);

// 3. Queue Snapshot Ingest (public, via ingest key – crawler target)
app.use("/api/queue", queueSnapshotPublic);
// 4. Queue GET endpoints (tickets, groups, debug)
app.use("/api/queue", queueRoutes);

// 5. Kiosk messages
app.use("/api/kiosk", kioskRoutes);

// 6. Dashboard info + toggles
app.use("/api/dashboard", dashboardRoutes);

// 7. User settings + meta
app.use("/api", userSettingsRoutes);

// 8. Activity log
app.use("/api/activity", activityRoutes);

// 9. Schedules
app.use("/api/schedules", schedulesRoutes);

// 10. Status
app.use("/api/status", statusRoutes);

// 11. Commits
app.use("/api/commit", commitRoutes);

// 12. Ingest (Excel)
app.use("/api/ingest", ingestRoutes);

// 13. Admin
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin/groups", adminGroupsRoutes);

// 14. Handover
app.use("/api/handover", handoverRoutes);

// 16. Commit Compliance (PDF upload)
app.use("/api/commit-compliance", commitComplianceRoutes);

// 17. Statistics
app.use("/api/stats", statsRoutes);

// 17b. Holidays (public, for Schichtplan)
app.use("/api/holidays", holidaysRoutes);

// 18. Wellbeing
import wellbeingRoutes from "./routes/wellbeing.js";
app.use("/api/wellbeing", wellbeingRoutes);

// 19. Shift Validation
import shiftValidationRoutes from "./routes/shiftValidation.js";
app.use("/api/shiftValidation", shiftValidationRoutes);

// 20. Coverage & Skills
import coverageRoutes from "./routes/coverage.js";
app.use('/api/coverage', coverageRoutes);
// 21. Staffing
import staffingRoutes from "./routes/staffing.js";
app.use('/api/staffing', staffingRoutes);

// 22. Absences
import absencesRoutes from "./routes/absences.js";
import constraintsRoutes from "./routes/constraints.js";
import reportsRoutes from "./routes/reports.js";
import shiftplanDataRoutes from "./routes/shiftplanData.js"; // [NEW]

app.use('/api/absences', absencesRoutes);
app.use("/api/constraints", constraintsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/shiftplan", shiftplanDataRoutes); // [NEW]

let serverInstance = null;

async function start() {
  // 1. Test DB Connection
  const dbOk = await testConnection();

  if (!dbOk) {
    console.error("!! [STARTUP] DB Connection Failed. Server starting in DEGRADED mode.");
  } else {
    // 2. Init Schema only if DB ok
    await initSchema();
  }

  // 3. Listen
  // Check if already listening (should not happen in this script structure but good for safety)
  if (serverInstance) {
    console.warn("!! [SERVER] Server already running. Ignoring duplicate start call.");
    return;
  }

  serverInstance = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ [SERVER] PID: ${process.pid}`);
    console.log(`✅ [SERVER] Listening on http://0.0.0.0:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    if (!dbOk) console.warn("   ⚠️  WARNING: Database is NOT connected.");
  });

  // 4. Error Handling (EADDRINUSE)
  serverInstance.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ [ODIN][SERVER] Port ${PORT} already in use (EADDRINUSE). Exiting.`);
      process.exit(1);
    } else {
      console.error("\n❌ [ODIN][SERVER] Server Error:", err);
      process.exit(1);
    }
  });

  // 5. Graceful Shutdown
  const shutdown = () => {
    console.log("\n[ODIN][SERVER] Shutting down...");
    serverInstance.close(() => {
      console.log("[ODIN][SERVER] Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Start the server
start();

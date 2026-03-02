# Safe Rename Report (ODIN)

This document serves as proof and a manifest for the Category A (Branding) and Category B (Deployment) renaming steps executed to transition from "Dispatcher Console / OES" to "ODIN".

## Overview

The renaming process strictly followed the classification defined in `AUDIT_RENAME.md`. Only low-risk and medium-risk operational strings were modified. **All high-risk state, routing, database, and API logic (Category C) was intentionally excluded to ensure 100% stable compatibility with existing deployment environments and databases.**

---

## 1. Category A: Branding Replacements (Safe)
The following files were updated to replace purely visual branding, repository metadata, or console logs.

- **`README.md`**: Updated main title to `ODIN – Full-Stack Setup Guide` and updated setup paths/instructions.
- **`backend/server.js`**: Replaced console log prefixes `[OES][SERVER]` with `[ODIN][SERVER]`.
- **`oes-jarvis-crawler/background.js` & `content.js`**: Replaced diagnostic console log prefixes `[OES Crawler]` with `[ODIN Crawler]`.
- **`backend/routes/queue.js`**: Replaced `[OES][SNAPSHOT]` with `[ODIN][SNAPSHOT]` in diagnostic logging.
- **`package.json` (root/frontend/backend)**: Renamed project/package names (`shift-tv-dashboard-root` -> `odin-root`, `shift-tv-dashboard-v4` -> `odin-frontend`, `dispatcher-console-backend` -> `odin-backend`).
- **`frontend/src/components/pages/Login.tsx`, `ForgotPassword.tsx`, `Register.tsx`**: Replaced image `alt` texts to `ODIN` and the main H1/text branding from `Dispatcher Console` to `ODIN`.
- **`frontend/src/components/dispatcher/DispatcherHeader.tsx`**: Updated the printed page title header from `Dispatcher Console` to `ODIN`.
- **`backend/docs/swagger.js`**: Updated the Swagger API Title to `ODIN API`.

## 2. Category B: Deployment Replacements (Safe)
The following infrastructure files were updated to change Docker container names, Docker image tags, and default environment database settings.

- **`docker-compose.yml` & `podman-compose.yml`**:
  - Replaced container names matching `dispatcher-*` with `odin-*`.
  - Replaced image tags matching `dispatcher-*:prod` with `odin-*:prod`.
  - Replaced the default database name parameter `oes_merged` with `odin` (e.g., `${DB_NAME:-odin}`).
- **`backend/config/index.js`**:
  - Updated the fallback local Postgres database name from `oes_merged` to `odin`.

---

## 3. Category C Items Intentionally UNTOUCHED (Locked)
The following high-risk items identified in the audit remain unmodified to preserve functionality, active sessions, saved states, and REST compliance.

- 🔒 **`backend/routes/queueSnapshotPublic.js`**: HTTP Header extraction `req.header("X-OES-INGEST-KEY")` left intact.
- 🔒 **`oes-jarvis-crawler/background.js`**: API Request Header Injection `"X-OES-INGEST-KEY"` left intact.
- 🔒 **`frontend/src/App.tsx`**: URL Navigation route `path="dispatcher"` left intact.
- 🔒 **`frontend/src/store/dispatcherStore.ts`**: LocalStorage key `name: "dispatcher.week.v1"` left intact.
- 🔒 **`frontend/src/store/shiftStore.ts`**: LocalStorage key `name: "shiftcontrol.shiftstore.v1"` left intact.
- 🔒 **`frontend/src/store/employeeMetaStore.ts`**: LocalStorage key `name: "shiftcontrol.employeeMeta.v1"` left intact.
- 🔒 **`frontend/src/config/permissions.ts`**: RBAC permissions like `DISPATCHER: { VIEW: "dispatcher_view" }` left intact.
- 🔒 **`backend/db/initSchema.js`**: All database ENUM variables (e.g. `dispatcher_console: "none"`) left intact.

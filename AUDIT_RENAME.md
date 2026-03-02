# Audit Rename Log (IST-Zustand - Post Cleanup)

This document provides a comprehensive fundstellen-liste (search hit list) for legacy branding, project names, deployment identifiers, and ports currently used in the repository.

**Categories defined:**
*   **A) Branding-only (Low Risk)**: README references, UI texts, console.log statements, package.json `name` fields, Swagger titles. -> **SAFE REPLACE**
*   **B) Deployment-only (Medium Risk)**: Docker/Podman compose container names, image tags, volume names, database default variables. -> **SAFE REPLACE**
*   **C) Risk (High Risk)**: Database schemas (tables, columns, enum values), internal state keys (Zustand persists, LocalStorage), HTTP headers, URL endpoints. -> **DO NOT BLIND REPLACE** (requires migrations/state wipe)

---

## 1. OES / oes / oes_merged

| File / Location | Context / Line | Category |
| :--- | :--- | :--- |
| `backend/server.js` | `console.log("[OES][SERVER]...")` (Multiple lines) | **A) Branding** |
| `oes-jarvis-crawler/background.js` | `console.log("[OES Crawler]...")` | **A) Branding** |
| `oes-jarvis-crawler/content.js` | `console.log("[OES Crawler]...")` | **A) Branding** |
| `backend/routes/queue.js` | `console.log("[OES][SNAPSHOT]...")` | **A) Branding** |
| `docker-compose.yml`, `podman-compose.yml` | `POSTGRES_DB: ${DB_NAME:-oes_merged}` | **B) Deployment** |
| `docker-compose.yml`, `podman-compose.yml` | `pg_isready -d ${DB_NAME:-oes_merged}` | **B) Deployment** |
| `backend/config/index.js` | `database: process.env.DB_NAME || "oes_merged"` | **B) Deployment** |
| `backend/routes/queueSnapshotPublic.js` | `req.header("X-OES-INGEST-KEY")` | **C) Risk** (Header) |
| `oes-jarvis-crawler/background.js`| `"X-OES-INGEST-KEY": "jarvis-crawler-2026"` | **C) Risk** (Header) |
| `frontend/src/components/shiftplan/shiftplan.warnings.ts` | `Rules (copied from the Brode/OES Dienstplan warnings):` | **A) Branding** |

*(Note: `backend/fix_db.js` and its DB Risk were eliminated during Cleanup.)*

---

## 2. dispatcher / dispatcher-backend / dispatcher-frontend

| File / Location | Context / Line | Category |
| :--- | :--- | :--- |
| `README.md` | `# Dispatcher Console – Full-Stack Setup Guide` | **A) Branding** |
| `backend/package.json` | `"name": "dispatcher-console-backend"` | **A) Branding** |
| `backend/docs/swagger.js` | `title: "Dispatcher Console API"` | **A) Branding** |
| `frontend/src/components/pages/Login.tsx`, etc. | `alt="Dispatcher Console"` | **A) Branding** |
| `docker-compose.yml`, `podman-compose.yml` | `container_name: dispatcher-postgres` | **B) Deployment** |
| `docker-compose.yml`, `podman-compose.yml` | `container_name: dispatcher-pgadmin` | **B) Deployment** |
| `docker-compose.yml`, `podman-compose.yml` | `image: dispatcher-backend:prod`, `container_name: dispatcher-backend` | **B) Deployment** |
| `docker-compose.yml`, `podman-compose.yml`, `docker-compose.prod.yml` | `image: dispatcher-frontend:prod`, `container_name: dispatcher-frontend` | **B) Deployment** |
| `frontend/src/App.tsx` | Route path: `path="dispatcher"` | **C) Risk** (Route) |
| `frontend/src/config/permissions.ts` | `DISPATCHER: { VIEW: "dispatcher_view" }` | **C) Risk** (RBAC) |
| `frontend/src/store/dispatcherStore.ts` | `name: "dispatcher.week.v1"` | **C) Risk** (Storage) |
| `backend/db/initSchema.js` | `dispatcher_console: "none"` | **C) Risk** (DB Column/Enum) |

---

## 3. shift-tv-dashboard / ShiftControl

| File / Location | Context / Line | Category |
| :--- | :--- | :--- |
| `package.json` (Root)| `"name": "shift-tv-dashboard-root"` | **A) Branding** |
| `frontend/package.json` | `"name": "shift-tv-dashboard-v4"` | **A) Branding** |
| `frontend/src/store/shiftStore.ts` | `name: "shiftcontrol.shiftstore.v1"` | **C) Risk** (Storage) |
| `frontend/src/store/employeeMetaStore.ts`| `name: "shiftcontrol.employeeMeta.v1"` | **C) Risk** (Storage) |

---

## 4. Brodinho

| File / Location | Context / Line | Category |
| :--- | :--- | :--- |
| `backend/routes/queueSnapshotPublic.js` | `/* Ports Brodinho Queue Snapshot -> PostgreSQL */` | **A) Branding** |
| `backend/db/initSchema.js` | `/* + Brodinho Queue (queue_items) */` | **A) Branding** |
| `backend/db/initSchema.js` | `/* BRODINHO QUEUE EXTENSIONS */` | **A) Branding** |

---

## 5. Port Overview (5055, 5173/5174, 8000/8001/8002/8003)

| Port | Main Usage | Locations Found |
| :--- | :--- | :--- |
| **5055** | Fallback/Local Dev Backend Port | `backend/Dockerfile`, `backend/.env.example`, `frontend/vite.config.ts`, `oes-jarvis-crawler/background.js` |
| **5173/5174** | Vite Local Dev Server | `docker-compose.prod.yml`, `backend/.env.example` |
| **8000** | Production Frontend | `docker-compose.yml`, `podman-compose.yml`, `README.md`, `.env.example` |
| **8001** | Production Backend | `docker-compose.yml`, `podman-compose.yml`, `README.md` |
| **8002** | Production Postgres | `docker-compose.yml`, `podman-compose.yml`, `README.md` |
| **8003** | Production pgAdmin | `docker-compose.yml`, `podman-compose.yml`, `README.md` |

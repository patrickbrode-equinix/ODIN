# ODIN – Lokale Entwicklungsumgebung

## Voraussetzungen

- **Node.js** ≥ 18 (empfohlen: 20 LTS)
- **npm** ≥ 9
- **PostgreSQL** lokal installiert und laufend (Port 5432)
  - Datenbank: `oes_merged`
  - User: `postgres`
  - Passwort: in `backend/.env` als `DB_PASSWORD` gesetzt
- **Git** (für Repo-Zugriff)

## ENV-Dateien

| Datei | Zweck | Status |
|---|---|---|
| `backend/.env` | Backend-Konfiguration (DB, Auth, CORS) | **Pflicht** – aus `backend/.env.example` erstellen |
| `teams-bot/odin/.env` | Teams Bot-Konfiguration (Azure, Graph) | **Pflicht** – aus `teams-bot/odin/.env.example` erstellen |
| `frontend/.env` | Nicht benötigt für lokalen Dev | Nicht nötig (Defaults korrekt) |
| `.env` (Root) | Docker Compose / Portainer – **nicht für lokalen Dev** | Nicht anfassen |

### Backend `.env` Minimalbeispiel

```env
PORT=5055
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oes_merged
DB_USER=postgres
DB_PASSWORD=dein_pg_passwort
JWT_SECRET=dev-only-insecure-secret
JWT_EXPIRES_IN=8h
QUEUE_INGEST_KEY=dev-key-123
CORS_ORIGIN=http://localhost:5173
BACKEND_URL=http://127.0.0.1:5055
```

### Teams Bot `.env` Minimalbeispiel

```env
PORT=3978
NODE_ENV=development
CLIENT_ID=
CLIENT_PASSWORD=
TENANT_ID=
BOT_TYPE=MultiTenant
BOT_INTERNAL_API_KEY=dev-api-key-change-me
ODIN_SHARED_SECRET=dev-shared-secret-change-me
ODIN_CALLBACK_BASE_URL=http://localhost:5055
LOG_LEVEL=info
```

> **Hinweis:** Ohne gültige Azure-Credentials (`CLIENT_ID`, `CLIENT_PASSWORD`, `TENANT_ID`) startet der Bot zwar, kann aber keine Teams-Nachrichten verarbeiten. Für reine Backend/Frontend-Entwicklung ist das kein Problem.

## Installation

```powershell
cd C:\Users\Admin\Desktop\ODIN_APP

# Alle Dependencies auf einmal installieren:
npm run install:all
```

Das installiert Dependencies für: Root, Backend, Frontend und Teams Bot.

## Starten

```powershell
npm run dev
```

Das startet parallel:
- **BACKEND** – `nodemon server.js` auf Port **5055**
- **FRONTEND** – `vite` Dev-Server auf Port **5173**
- **BOT** – `nodemon + ts-node` auf Port **3978**

### Einzeln starten

```powershell
npm run dev:backend    # nur Backend
npm run dev:frontend   # nur Frontend
npm run dev:bot        # nur Teams Bot
```

## Ports

| Service | Port | URL |
|---|---|---|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Express) | 5055 | http://localhost:5055 |
| Teams Bot | 3978 | http://localhost:3978 |

## Proxy-Architektur (lokal)

```
Browser → http://localhost:5173/api/* → Vite Proxy → http://127.0.0.1:5055/api/*
Browser → http://localhost:5173/*     → Vite (React SPA)
```

Das Frontend braucht **keine** `VITE_API_BASE_URL`. Vite proxyt `/api` automatisch ans Backend. 

## Smoke-Test

Nach `npm run dev` diese URLs prüfen:

| Check | URL | Erwartung |
|---|---|---|
| Backend Health | http://localhost:5055/api/health | `{"backend":"ok","database":"ok",...}` |
| Frontend → Backend Proxy | http://localhost:5173/api/health | Selbe Antwort wie oben |
| Frontend HTML | http://localhost:5173 | React-App lädt |
| Bot läuft | http://localhost:3978 | 404 (normal – kein Root-Handler) |

## Datenbank

Das Backend erwartet PostgreSQL lokal auf `localhost:5432`.

- Beim ersten Start laufen automatisch **Migrations** (`backend/db/migrations/`)
- Ein Default-Admin wird geseedet falls keine User existieren
- DB-Name Standard: `oes_merged` (konfigurierbar in `backend/.env`)

### PostgreSQL lokal einrichten (einmalig)

```sql
CREATE DATABASE oes_merged;
```

Alternativ mit `psql`:
```powershell
psql -U postgres -c "CREATE DATABASE oes_merged;"
```

## Typische Fehler

| Problem | Lösung |
|---|---|
| `ECONNREFUSED :5432` | PostgreSQL läuft nicht oder falscher Port in `backend/.env` |
| `password authentication failed` | `DB_PASSWORD` in `backend/.env` stimmt nicht |
| `EADDRINUSE :5055` | Anderer Prozess auf Port 5055 – `netstat -ano \| findstr :5055` |
| Bot zeigt `Config load warning` | Normal ohne Azure-Credentials – Bot startet trotzdem |
| Vite CJS deprecation warning | Kosmetisch, ignorierbar |
| `MODULE_TYPELESS_PACKAGE_JSON` warning | Kosmetisch, ignorierbar |

## VM/Container-Modus

Die lokale Dev-Konfiguration verändert nichts am bestehenden Container-Setup:
- `docker-compose.yml` / `podman-compose.yml` bleiben unverändert
- Root `.env` bleibt für Container/Portainer
- `dev.ps1` bleibt für WSL/Podman-Start
- Alle produktiven ENV-Dateien (`.env.production.example`) bleiben unverändert

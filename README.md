# ODIN – Full-Stack Setup Guide

**Stack:** React + Vite + Tailwind · Node.js + Express · PostgreSQL 15  
**Environments:** Local dev (no Docker) · Local Docker / Podman · VM / Production Docker

---

## 1. Project Structure

```text
ODIN_APP/
├── Backend/                → Node.js + Express + PostgreSQL
│   ├── config/index.js     ← single config source of truth
│   ├── routes/
│   ├── db.js
│   ├── server.js
│   ├── Dockerfile
│   └── db/migrations/
│
├── Frontend/               → React + Vite + Tailwind
│   ├── src/
│   ├── vite.config.ts      ← proxy reads BACKEND_URL env var
│   └── Dockerfile
│
├── docs/
│   ├── setup/              → local/VM deployment guides
│   ├── reference/          → environment and inventory docs
│   └── reports/            → change and diagnostic reports
├── diag/                   → diagnostics, baselines, investigation notes
├── archives/               → exported zip archives and snapshots
├── oes-jarvis-crawler/     → browser extension crawler
├── docker-compose.yml      ← dev/runtime compose
├── docker-compose.prod.yml ← prod overrides
├── podman-compose*.yml     ← podman variants
└── README.md
```

## 1.1 Documentation Map

- Local development: `docs/setup/LOCAL_DEV.md`
- Oracle Linux / Portainer / Podman deployment: `docs/setup/INSTALL_ORACLE_LINUX_PORTAINER_PODMAN.md`
- Environment variable overview: `docs/reference/ENV_MATRIX.md`
- Project inventory: `docs/reference/INVENTORY.md`
- Rename/change report: `docs/reports/RENAME_REPORT_SAFE.md`
- Crawler 401 fix report: `docs/reports/CRAWLER_401_FIX.txt`

---

## 2. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20 LTS | Local dev without Docker |
| Docker or Podman | latest | Container environments |
| Docker Compose or Podman Compose | latest | Orchestrator |
| PostgreSQL 15 | (if local dev without Docker) | Database |

---

## 3. Environment Variables

All backend config lives in **`backend/.env`**.

```bash
cp backend/.env.example backend/.env
# Edit: set DB_PASSWORD, JWT_SECRET, QUEUE_INGEST_KEY
```

> **Generate secrets:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

Key variables:

| Variable | Dev default | What it does |
|----------|------------|-------------|
| `PORT` | `8001` | Backend listen port |
| `DATABASE_URL` | *(unset → use DB_** | Preferred: full postgres connection URL |
| `DB_HOST` | `localhost` | Used when DATABASE_URL not set |
| `DB_PASSWORD` | — | **Required** — no default |
| `JWT_SECRET` | dev-insecure | **Required in production** |
| `QUEUE_INGEST_KEY` | — | **Required in production** |
| `CORS_ORIGINS` | `http://localhost:8000` | Comma-separated allowed origins |
| `BACKEND_URL` | `http://127.0.0.1:8001` | Vite dev proxy target |

---

## 4. Run Locally

Requires: Node.js 20 and either a local PostgreSQL on `localhost:5432` or Docker/Podman for automatic Postgres bootstrap.

```bash
# 1. IClone the repo and configure your environment variables:
git clone https://github.com/patrickbrode-equinix/ODIN.git
cd odin-system

# Create the main environment file
cp .env.example .env

# Edit .env and set your secrets:
# - DB_PASSWORD
# - JWT_SECRET
# - QUEUE_INGEST_KEY
```

> [!NOTE]
> 🛑 **LOGIN CURRENTLY DISABLED FOR TESTING:**
> Authentication is temporarily bypassed. You will automatically be logged in as an Admin.

```bash
# 2. Install dependencies
npm run install:all

# 3. Start frontend + backend from the repo root
npm run dev
# → starts/reuses Postgres on localhost:5432
# → frontend on http://localhost:5173
# → backend on http://localhost:5055

# Optional: also start the Teams bot
npm run dev:full

# Optional: stop the Postgres container started for dev
npm run dev:db:down
```

`npm run dev` reuses an already running local Postgres instance. If nothing is listening on `localhost:5432`, it starts a Postgres container that is aligned with `Backend/.env`.

**Verify:**
```bash
curl http://localhost:5055/api/health
# → {"status":"ok","db":"connected"}
```

---

## 5. Run with Docker or Podman (Local)

All services start together: **postgres → backend → frontend** (in dependency order).
This project is fully compatible with both Docker Compose and Podman Compose.

```bash
# 1. Configure
cp backend/.env.example backend/.env
# Edit: set DB_PASSWORD, JWT_SECRET, QUEUE_INGEST_KEY

# 2. Start all services
docker compose up -d
# Or for Podman (uses explicit Podman config):
# podman-compose -f podman-compose.yml up -d
docker compose up -d

# 3. View logs
docker compose logs -f backend
docker compose logs -f postgres
```

**Services:**

| Service | Container | Port |
|---------|-----------|------|
| postgres | `odin-postgres` | `localhost:8002` |
| backend | `odin-backend` | `localhost:8001` |
| frontend | `odin-frontend` | `localhost:8000` |

**Verify:**
```bash
# Health endpoint
curl http://localhost:8001/api/health

# Frontend reachable
curl -s http://localhost:8000 | head -5

# Postgres reachable from backend container
docker exec -it odin-backend node -e \
  "import('./config/index.js').then(m => console.log('DB:', m.config.db))"
```

**Stop / clean up:**
```bash
docker compose down           # stop containers, keep postgres data
docker compose down -v        # stop + DELETE postgres volume (data loss!)
```

---

## 6. Run on VM (Production Docker)

```bash
# 1. SSH into VM, clone repo
git clone <repo-url> && cd Merged

# 2. Configure production secrets
cp backend/.env.production.example backend/.env
nano backend/.env
# Set: DB_PASSWORD (strong), JWT_SECRET (32-byte hex), QUEUE_INGEST_KEY, CORS_ORIGINS

# 3. Start with production overrides (built images, no hot-reload)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Check status
docker compose ps
docker compose logs backend --tail=50
```

**Verify login flow end-to-end:**
```bash
# 1. Health check
curl -f http://VM_IP:8001/api/health
# → {"status":"ok","db":"connected"}

# 2. Authenticated request (login is currently bypassed, all requests act as Root Admin)
# Token is not strictly required right now, but normally you would use:
# TOKEN=$(curl -.../api/auth/login...)
curl -s http://VM_IP:8001/api/shifts | head -c 200

# 4. Frontend reachable (if serving static build)
curl -sf http://VM_IP:8000 > /dev/null && echo "Frontend OK"
```

**With nginx reverse proxy (recommended for production):**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:8000;
    }

    # Backend API — same-origin proxy
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        proxy_pass http://localhost:8001;
    }
}
```

> With nginx: set `CORS_ORIGINS=https://your-domain.com` in `backend/.env`.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `DB_PASSWORD must be set` | `.env` missing or empty `DB_PASSWORD` | Copy `.env.example` → `.env`, set value |
| Backend exits immediately in prod | Missing `JWT_SECRET` or `QUEUE_INGEST_KEY` | Check startup log, set required vars |
| `ECONNREFUSED` on postgres | Backend started before postgres ready | `depends_on: condition: service_healthy` handles this; check postgres logs |
| Frontend shows blank / 404 on `/api` | Vite proxy not running | In Docker, confirm `BACKEND_URL: http://backend:8001` is set |
| CORS error in browser | `CORS_ORIGINS` doesn't match your frontend origin | Set `CORS_ORIGINS=https://your-domain.com` |
| Port 8001 already in use | Another process on the port | `PORT=8005 docker compose up` — uses new port everywhere |

---

## 8. GitHub Workflow

```bash
git pull
# make changes
git add .
git commit -m "feat: ..."
git push
# on VM: git pull && docker compose up -d --build backend
```

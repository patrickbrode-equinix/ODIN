# Dispatcher Console – Full-Stack Setup Guide

**Stack:** React + Vite + Tailwind · Node.js + Express · PostgreSQL 15  
**Environments:** Local dev (no Docker) · Local Docker / Podman · VM / Production Docker

---

## 1. Project Structure

```
Merged/
├── backend/                → Node.js + Express + PostgreSQL
│   ├── config/index.js     ← single config source of truth
│   ├── routes/
│   ├── db.js
│   ├── server.js
│   ├── Dockerfile
│   ├── .env.example        ← copy to .env and fill in values
│   └── .env.production.example
│
├── frontend/               → React + Vite + Tailwind
│   ├── src/
│   ├── vite.config.ts      ← proxy reads BACKEND_URL env var
│   └── Dockerfile
│
├── docker-compose.yml      ← dev: all 3 services (postgres, backend, frontend)
├── docker-compose.prod.yml ← prod overrides (built images, no hot-reload)
└── README.md
```

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
| `PORT` | `5055` | Backend listen port |
| `DATABASE_URL` | *(unset → use DB_** | Preferred: full postgres connection URL |
| `DB_HOST` | `localhost` | Used when DATABASE_URL not set |
| `DB_PASSWORD` | — | **Required** — no default |
| `JWT_SECRET` | dev-insecure | **Required in production** |
| `QUEUE_INGEST_KEY` | — | **Required in production** |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `BACKEND_URL` | `http://127.0.0.1:5055` | Vite dev proxy target |

---

## 4. Run Locally (No Docker)

Requires: Node.js 20, PostgreSQL 15 running locally.

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env: set DB_PASSWORD + JWT_SECRET + QUEUE_INGEST_KEY

# 3. Start backend (terminal 1)
cd backend && npm run dev
# → listening on http://localhost:5055
# → startup log shows: DB connected ✅

# 4. Start frontend (terminal 2)
cd frontend && npm run dev
# → http://localhost:5173
# → /api/* proxied to http://127.0.0.1:5055 via vite.config.ts
```

**Verify:**
```bash
curl http://localhost:5055/api/health
# → {"status":"ok","db":"connected"}
```

---

## 5. Run with Docker or Podman (Local)

All services start together: **postgres → pgadmin → backend → frontend** (in dependency order).
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
| postgres | `dispatcher-postgres` | internal only |
| pgadmin | `dispatcher-pgadmin` | `localhost:5050` (Login: `admin@admin.com` / `admin`) |
| backend | `dispatcher-backend` | `localhost:5055` |
| frontend | `dispatcher-frontend` | `localhost:5173` |

**Verify:**
```bash
# Health endpoint
curl http://localhost:5055/api/health

# Frontend reachable
curl -s http://localhost:5173 | head -5

# Postgres reachable from backend container
docker exec -it dispatcher-backend node -e \
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
curl -f http://VM_IP:5055/api/health
# → {"status":"ok","db":"connected"}

# 2. Login (replace credentials)
TOKEN=$(curl -s -X POST http://VM_IP:5055/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YOUR_PASSWORD"}' \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

# 3. Authenticated request (load dashboard data)
curl -s -H "Authorization: Bearer $TOKEN" http://VM_IP:5055/api/shifts | head -c 200

# 4. Frontend reachable (if serving static build)
curl -sf http://VM_IP:5173 > /dev/null && echo "Frontend OK"
```

**With nginx reverse proxy (recommended for production):**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
    }

    # Backend API — same-origin proxy
    location /api/ {
        proxy_pass http://localhost:5055;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        proxy_pass http://localhost:5055;
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
| Frontend shows blank / 404 on `/api` | Vite proxy not running | In Docker, confirm `BACKEND_URL: http://backend:5055` is set |
| CORS error in browser | `CORS_ORIGINS` doesn't match your frontend origin | Set `CORS_ORIGINS=https://your-domain.com` |
| Port 5055 already in use | Another process on the port | `PORT=5056 docker compose up` — uses new port everywhere |

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

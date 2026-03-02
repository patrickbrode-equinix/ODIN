# ODIN – Portainer Deployment Walkthrough
**Target:** Oracle Linux VM · Portainer + Podman agent · March 2026

---

## Prerequisites

| What | Requirement |
|------|-------------|
| Oracle Linux VM | SELinux permissive or enforcing (see Step 1) |
| Portainer | Running, agent connected |
| Podman | ≥ 4.x installed |
| Ports free on host | 8001, 8003, 8080, 5432 (5432 optional) |
| Port 8000 | **Reserved by Portainer/Chisel — do NOT publish here** |

---

## Step 1 — VM preparation (SSH into the Oracle Linux VM)

### 1a) Open firewall ports
```bash
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --permanent --add-port=8003/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports   # verify
```

### 1b) SELinux (if enforcing)
```bash
getenforce
# If "Enforcing", allow container networking:
sudo setsebool -P container_manage_cgroup on
```

### 1c) Confirm port 8000 is occupied (Portainer/Chisel)
```bash
ss -lntp | grep :8000
# Expected: Portainer/Chisel listening — ODIN frontend uses 8080 instead.
```

---

## Step 2 — Clone / pull the repo on the VM

```bash
# First time
git clone https://github.com/patrickbrode-equinix/ODIN.git /opt/odin
cd /opt/odin

# Subsequent updates
git pull origin main
```

Verify lowercase folder names (Linux is case-sensitive):
```bash
ls -la
# Must show:  backend/   frontend/   docker-compose.yml
```

---

## Step 3 — Generate secrets (run once, save the values)

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# QUEUE_INGEST_KEY  (shorter token is fine)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## Step 4 — Deploy via Portainer (recommended)

### 4a) Open Portainer UI → Stacks → Add Stack

- **Name:** `odin`
- **Build method:** Repository  
  - Repository URL: `https://github.com/patrickbrode-equinix/ODIN`
  - Compose path: `docker-compose.yml`
- Or: **Web editor** — paste the entire contents of `docker-compose.yml`

### 4b) Add Environment Variables

Paste each line from `.env.example`, replacing placeholder values:

| Variable | Example value | Notes |
|----------|--------------|-------|
| `DB_NAME` | `odin` | |
| `DB_USER` | `odin_admin` | |
| `DB_PASSWORD` | _(strong password)_ | Required |
| `DB_PORT` | `5432` | |
| `JWT_SECRET` | _(generated in Step 3)_ | Required — app exits without it |
| `JWT_EXPIRES_IN` | `8h` | |
| `QUEUE_INGEST_KEY` | _(generated in Step 3)_ | Required — app exits without it |
| `CORS_ORIGINS` | `http://<VM_IP>:8080` | Comma-separated if multiple |
| `PGADMIN_EMAIL` | `admin@odin.local` | |
| `PGADMIN_PASSWORD` | _(strong password)_ | |
| `NODE_ENV` | `production` | |

> `VITE_API_BASE_URL` and `BACKEND_URL` are already hardcoded in the compose file — do **not** override them unless you change the networking.

### 4c) Deploy Stack

Click **Deploy the stack**. Portainer will build images and start containers.

Expected startup order (enforced by healthchecks):
```
postgres  →  (healthy)  →  backend  →  (healthy)  →  frontend
                        →  pgadmin
```

---

## Step 5 — Deploy via CLI (alternative)

```bash
cd /opt/odin

# Production (recommended — adds build optimisations)
podman compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Or base file only
podman compose up -d --build
```

---

## Step 6 — Verify containers are running

```bash
podman ps --all --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:
```
NAMES            STATUS                   PORTS
odin-postgres    Up X minutes (healthy)   0.0.0.0:5432->5432/tcp
odin-pgadmin     Up X minutes             0.0.0.0:8003->80/tcp
odin-backend     Up X minutes (healthy)   0.0.0.0:8001->8001/tcp
odin-frontend    Up X minutes             0.0.0.0:8080->8000/tcp
```

---

## Step 7 — Smoke-test (from the VM)

```bash
# 1. Backend health
curl -i http://localhost:8001/api/health
# Expected: 200 OK  {"backend":"ok","database":"ok",...}

# 2. Frontend health (via proxy)
curl -i http://localhost:8080/api/health
# Expected: 200 OK  (same JSON — proxied through Express server)

# 3. Frontend HTML
curl -i http://localhost:8080/
# Expected: 200 OK  <!doctype html>...

# 4. pgAdmin
curl -I http://localhost:8003/
# Expected: 200 OK
```

---

## Step 8 — Access from a browser

| Service | URL |
|---------|-----|
| ODIN Frontend | `http://<VM_IP>:8080` |
| Backend API | `http://<VM_IP>:8001/api/health` |
| pgAdmin | `http://<VM_IP>:8003` |

> First login in ODIN: register a user via `/register`, then log in.  
> The first registered user with `is_root = true` seeded in the DB gets full access.

---

## Troubleshooting

### Container stuck in "Waiting" / "starting"
The `depends_on: condition: service_healthy` chain prevents premature starts.  
Check which service isn't healthy yet:
```bash
podman inspect odin-postgres | grep -A5 Health
podman inspect odin-backend  | grep -A5 Health
```

### Backend exits immediately
Almost always a missing required env var. Check logs:
```bash
podman logs odin-backend --tail 50
# Look for: [CONFIG] FATAL: Missing required env vars: JWT_SECRET, QUEUE_INGEST_KEY
```

### Port conflict on 8080
```bash
ss -lntp | grep :8080
# Kill or reassign the conflicting process, or change the host port in docker-compose.yml
```

### CORS error in browser
Set `CORS_ORIGINS` to the exact origin used in the browser (including port, no trailing slash):
```
CORS_ORIGINS=http://<VM_IP>:8080
```

### Frontend returns HTML instead of JSON on API calls
`VITE_API_BASE_URL` must be `/api` (default). If it was empty during build, rebuild:
```bash
podman compose down
podman rmi odin-frontend:prod
podman compose up -d --build
```

### DB connection refused
```bash
podman logs odin-backend --tail 30
# Look for: Hint: Is Postgres running? Check DB_HOST / DB_PORT.
# DB_HOST must be "postgres" (the compose service name), never "localhost" in bridge mode.
```

---

## Port reference

| Host port | Container | Service |
|-----------|-----------|---------|
| 8000 | — | **Reserved by Portainer/Chisel — do not use** |
| 8001 | 8001 | ODIN Backend (Node/Express) |
| 8003 | 80 | pgAdmin 4 |
| 8080 | 8000 | ODIN Frontend (Express proxy + Vite SPA) |
| 5432 | 5432 | PostgreSQL (remove mapping if not needed externally) |

---

## Networking diagram

```
Browser ──► :8080 (host)
              │
              ▼
        odin-frontend (container :8000)
           Express proxy
              │  /api/*   →  http://backend:8001
              │  /uploads/* → http://backend:8001
              │  *          → dist/index.html (SPA)
              │
        ┌─────▼──────────────────────────┐
        │         odin-net (bridge)       │
        │                                 │
        │  odin-backend :8001             │
        │       │                         │
        │       ▼                         │
        │  odin-postgres :5432            │
        └─────────────────────────────────┘
```

---

## Update / redeploy

```bash
cd /opt/odin
git pull origin main

podman compose down
podman compose up -d --build
```

In Portainer: Stack → **Pull and redeploy**.

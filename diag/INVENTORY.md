# ODIN Repository INVENTORY

## Top-Level Structure
- `backend/`: Node.js/Express App
- `frontend/`: React/Vite SPA
- `docker-compose.yml`, `docker-compose.prod.yml`, `podman-compose.yml`

## Repo Path Configuration
- **Repository Root:** `/mnt/c/Users/Admin/Desktop/Merged` (mapped from Windows `c:\Users\Admin\Desktop\Merged`)
- **Compose File Select:** `podman-compose.yml` (Primary selection over `docker-compose.yml`)

## Services / Compose
- **Services:**
  - `postgres`: image `postgres:15-alpine`
  - `pgadmin`: image `dpage/pgadmin4`
  - `backend`: Node entrypoint build (`server.js`)
  - `frontend`: Vite entrypoint build

## Environment / Entrypoints
- Frontend: Dev server mapped to proxy at backend
- Backend: Entrypoint `server.js` using PostgreSQL backend instance (DB connection fully verified).
- Ports assigned: Base 8000 (frontend), 8001 (backend), 8002 (db), 8003 (pgadmin).

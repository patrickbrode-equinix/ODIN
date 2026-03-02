# Project Inventory

## 1. Directory Structure (Top-Level)
```text
.
├── backend/            # Express.js REST API
├── frontend/           # Vite / React Application
├── oes-jarvis-crawler/ # External crawler/ingest tool (not inspected deeply)
├── scripts/            # Helper scripts 
├── docker-compose.yml       # Standard deployment (ports: 8000, 8001, 8002, 8003)
├── docker-compose.prod.yml  # Production overrides 
├── podman-compose.yml       # Podman deployment equivalent to docker-compose
├── .env.example             # Global example environment variables
└── README.md                # Project documentation
```

## 2. Compose Files & Services
There are three main compose files at the root: `docker-compose.yml`, `podman-compose.yml`, and `docker-compose.prod.yml`.

### Services Started:
- **`postgres`**: Postgres 15 database. Exposed on port `8002`.
- **`pgadmin`**: Database management UI. Exposed on port `8003`.
- **`backend`**: Node.js backend (`dispatcher-backend`). Exposed on port `8001` (default).
- **`frontend`**: Vite static build (`dispatcher-frontend`). Exposed on port `8000`.

## 3. Backend (Node/Express)
- **Entry Point**: `backend/server.js`
- **Framework**: Express.js with ES Modules (`type: "module"` in `package.json`).
- **Database Connection**: Uses `pg` package. Configured in `backend/config/index.js` and `backend/db.js`.
- **Key Ports**: `5055` (Local Dev Default) or `8001` (Docker Default via `PORT` env).
- **Important Environment Variables** (from `backend/.env` / `.env.example`):
  - `PORT`: Port the Express server listens on.
  - `NODE_ENV`: E.g., `development` or `production`.
  - `DATABASE_URL`: Connection string for PostgreSQL (Overrides individual DB_ vars when set).
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: Individual DB credentials.
  - `JWT_SECRET`, `JWT_EXPIRES_IN`: Used for authentication middleware.
  - `QUEUE_INGEST_KEY`: Security key required for the external crawler to ingest data.
  - `CORS_ORIGINS`: Allowed origins for API requests (e.g. `http://localhost:5173` or `http://localhost:8000`).

## 4. Frontend (Vite/React)
- **Framework**: React 18, built and served using Vite.
- **Styling**: Tailwind CSS (`@tailwindcss/postcss`).
- **State Management**: Zustand (`useShiftStore`, `useCommitStore`).
- **Key Ports**: `5173`/`5174` (Local Dev) or `8000` (Docker Production).
- **Backend API Communication**: 
  - Standard API calls are made via a customized Axios instance (`src/api/api.ts`).
  - *Local Dev:* `vite.config.ts` proxies `/api` requests to `BACKEND_URL` (default `http://127.0.0.1:5055`).
  - *Production Docker:* `VITE_API_BASE_URL` is set in the compose file to point the statically built frontend to the backend service.

## 5. Environment Config (.env)
- **Global / Root Level**: A global `.env.example` file exists in the root folder. This file contains the template variables for Portainer/Podman UIs. Real `.env` files are not mounted directly via `env_file` in the compose files anymore to prevent `ENOENT` crashes in Portainer. Instead, Portainer manages them virtually and injects them directly into the services.
- **Backend Level**: `backend/.env.example` and `backend/.env.production.example` exist as reference templates for local development and direct Node execution.

## 6. Database Configuration
Database credentials and schemas are managed centrally:
- Data is stored in Postgres.
- Credentials originate from standard `ENV` variables (`DB_NAME`, `DB_USER`, `DB_PASSWORD`), which are injected via Docker/Portainer or read from local `.env` files using `dotenv`.
- Inside the backend, `backend/config/index.js` centralizes reading these `.env` properties.
- `backend/db.js` initializes the Postgres Pool using `config.DATABASE_URL` or a combination of `config.DB_HOST`, `config.DB_USER`, etc. Schema initialization runs on startup via `backend/db/initSchema.js`.

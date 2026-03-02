# Environment Variables Matrix

| Variable | Where Used | Default Value | Needed in Prod? | Example Value |
|----------|------------|---------------|-----------------|---------------|
| `DB_NAME` | Postgres, Backend | `odin` | Optional (default works) | `odin_prod` |
| `DB_USER` | Postgres, Backend | `postgres` | Optional (default works) | `dbadmin` |
| `DB_PASSWORD` | Postgres, Backend | `postgres` | **Yes** | `superSecret123!` |
| `DB_HOST` | Backend Compose | `postgres` | Optional (default works) | `postgres` (Service Name) |
| `DB_PORT` | Backend Compose | `5432` | Optional (default works) | `5432` |
| `PGADMIN_EMAIL` | pgAdmin | `admin@admin.com` | Optional (default works) | `admin@company.com` |
| `PGADMIN_PASSWORD` | pgAdmin | `admin` | **Yes** | `secureMdPassword` |
| `PORT` | Backend | `8001` | Optional (default works) | `8001` |
| `NODE_ENV` | Backend, Frontend | `production` | Optional (default works) | `production` |
| `JWT_SECRET` | Backend Auth | `dev-only-insecure-secret` | **Yes** | `aLongRandomHexString32Bytes` |
| `JWT_EXPIRES_IN`| Backend Auth | `8h` | Optional (default works) | `24h` |
| `QUEUE_INGEST_KEY`| Backend API | `CHANGE_ME_DEV_KEY`| **Yes** | `ingestKeyForServices` |
| `CORS_ORIGINS` | Backend CORS | `http://localhost:8000` | **Yes** | `https://your-domain.com` |
| `VITE_API_BASE_URL`| Frontend Vite | `(empty)` | Optional (proxy/local works) | `http://localhost:8001` (local testing without proxy) |

## Compose & Portainer Requirements
The configuration is guaranteed to run **without** an `env_file` directive in the compose files. Portainer can inject environment variables directly, and variables have safe `${VAR:-default}` fallbacks to avoid `ENOENT` or failed startups if unconfigured.

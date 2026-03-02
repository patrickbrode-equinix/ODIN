# DIAG BASELINE

## Running Containers
- **Backend:** `odin-backend:prod` (Port 8001)
- **Database:** `postgres:15-alpine` (Port 5432)
- *(Note: Frontend and pgAdmin are also running as defined by compose)*

## Volumes Mounted
### `odin-postgres`
- **Name:** `merged_postgres_data`
- **Source (Host):** `/var/lib/containers/storage/volumes/merged_postgres_data/_data`
- **Destination:** `/var/lib/postgresql/data`
- **Persistence:** This is a named volume, therefore data survives `podman-compose down` (unless `-v` is explicitly passed and successfully executed).

## Active Environment Variables (Backend)
- `NODE_ENV=production`
- `DB_HOST=postgres`
- `DATABASE_URL=postgresql://postgres:odin_test_pw@postgres:5432/odin`
- `JWT_SECRET=test_jwt_123`
- `QUEUE_INGEST_KEY=test_queue_123`
- `CORS_ORIGINS=http://localhost:8000`

## Log Summary
- **Postgres:** Initialized successfully (`database system is ready to accept connections`). No fatal errors.
- **Backend:** Connected successfully to the database (`CONNECTION SUCCESS`). Server is listening on `:8001`. No startup panics or reconnect loops.

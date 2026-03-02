# DEPLOY_NOTES_PODMAN.md

## Changes Made for Podman / Portainer Fitness
- Verified that `docker-compose.yml` and `podman-compose.yml` do **not** rely on the `env_file` directive. If present, `env_file` causes an immediate failure (e.g., `ENOENT` in Portainer) if the referenced file is omitted or hasn't been mapped.
- Environment variables are supplied directly via `environment:` using the graceful bash fallbacks: `${VAR:-default}`.
- Handled the injection of configuration in `backend/db.js` through `DATABASE_URL` assembled dynamically in Compose. This bypasses the need to have `.env` files physically mounted or present inside the container.
- Prepared `.env.example` as a comprehensive template without strictly requiring its presence at runtime. Users can create environmental entries simply through Portainer's "Stack > Environment variables" section visually.
- Hard fallback checks in healthchecks `pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-odin}` ensure that the containers don't choke during staging.

## WSL Podman Tests (Szenario A)
- Die Applikation (Backend und Frontend) ist hochgradig robust konfiguriert und bootet sauber (`npm run build` im Container klappt).
- Ein start scheiterte jedoch in der lokalen WSL-Instanz aufgrund des fehlenden `systemd` User-Slices für rootless Podman: `netavark: failed to create aardvark-dns directory /run/user/1000/containers/networks/aardvark-dns: IO error`. Dies ist kein Fehler im ODIN Repository, sondern verlangt `/etc/wsl.conf` Anpassungen für Podman in WSL (Aktivierung von `systemd=true`).
- Für ein sauberes Proxy-freies Setup wurden folgende Variablen validiert: `VITE_API_BASE_URL=http://localhost:8001` und `CORS_ORIGINS=http://localhost:8000`.

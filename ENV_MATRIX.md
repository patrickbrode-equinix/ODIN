# Environment Variables Matrix (ODIN)

Diese Tabelle listet alle Umgebungsvariablen auf, die von Docker/Podman Compose und den Services (postgres, pgadmin, backend, frontend) ausgewertet werden. 

Da in den Compose-Dateien **kein `env_file`** mehr verwendet wird, müssen diese Variablen für Produktionsumgebungen direkt im Portainer-UI (unter "Env") als Key-Value-Paare eingetragen werden.

| Variable | Wo verwendet | Default im Compose (Fallback) | Muss in Portainer für Prod gesetzt werden? | Beispielwert (Sicher) |
| :--- | :--- | :--- | :--- | :--- |
| `DB_NAME` | postgres, backend | Ja (`odin`) | Nein (kann default bleiben) | `odin_prod` |
| `DB_HOST` | backend | Ja (`postgres`) | **Ja** (Empfohlen für Portabilität) | `postgres` oder `10.0.x.x` |
| `DB_USER` | postgres, backend | Ja (`postgres`) | **Ja** (Sicherheit) | `odin_db_admin` |
| `DB_PASSWORD` | postgres, backend | Ja (`postgres`) | **Ja** (Sicherheit) | `SuperSecretDBPass!` |
| `DB_PORT` | backend | Ja (`5432`) | Nein | `5432` |
| `PGADMIN_EMAIL` | pgadmin | Ja (`admin@admin.com`) | **Ja** (Sicherheit) | `admin@firma.de` |
| `PGADMIN_PASSWORD` | pgadmin | Ja (`admin`) | **Ja** (Sicherheit) | `PgAdminSecurePass!` |
| `PORT` | backend | Ja (`8001`) | Nein | `8001` |
| `NODE_ENV` | backend, frontend | Ja (`production`) | Nein | `production` |
| `JWT_SECRET` | backend | Ja (`dev-only-insecure-secret`) | **Ja** (Zwingend für Token) | `e7b3c9d2f...` (Crypto Hex) |
| `JWT_EXPIRES_IN` | backend | Ja (`8h`) | Nein | `12h` oder `7d` |
| `QUEUE_INGEST_KEY`| backend | Ja (`CHANGE_ME_DEV_KEY`) | **Ja** (Zwingend für Crawler) | `CrawlerSecret2026!` |
| `CORS_ORIGINS` | backend | Ja (`http://localhost:8000`) | **Ja** (Zwingend für Remote) | `https://odin.meine-firma.de` |
| `VITE_API_BASE_URL` | frontend | Nein (Leer) | **Ja** (Zwingend für API-Calls im Browser) | `https://odin.meine-firma.de` oder `http://<VM-IP>:8001` |
| `TV_KEY` | backend | Nein (disabled) | Optional – siehe TV Public Mode | `TvKiosk2026!` |

## TV Public Mode (`/tv-dashboard`)

Die Route `/tv-dashboard` ist kiosk-ready: Sie erfordert **keinen Login** und keine Authentifizierung.

### TV URL
```
http://<host>:8080/tv-dashboard
```

### Sicherheitsoptionen

| Option | ENV Var | Beschreibung |
|:---|:---|:---|
| **Offen (Corporate Netz)** | *(nichts setzen)* | Alle Public `/api/tv/*` Calls funktionieren ohne Key. Risiko: Jeder im Netz kann TV-Daten lesen. Akzeptabel in abgeschirmten Netzen. |
| **TV_KEY (empfohlen)** | `TV_KEY=<secret>` | Alle `/api/tv/*` Requests müssen Header `X-TV-KEY: <secret>` oder Query `?tv_key=<secret>` enthalten. TV-Browser-Tab muss mit `?tv_key=<secret>` aufgerufen werden. |

### Welche Endpoints sind public?

| Endpoint | Auth? | Beschreibung |
|:---|:---|:---|
| `GET /api/tv/health` | Nein | TV Health Check |
| `GET /api/tv/tickets` | Nein | Queue Tickets (read-only) |
| `GET /api/tv/info-entries` | Nein | Dashboard Info Entries (read-only) |

Alle anderen `/api/*` Endpoints bleiben weiterhin hinter `requireAuth` geschützt.

### Portainer / VM Setup Schritte
1. No additional ENV vars required for basic kiosk mode.
2. Optional: In Portainer → Stack → Env → Add `TV_KEY` = `<dein-secret>`.
3. TV-Gerät aufrufen: `http://<VM-IP>:8080/tv-dashboard` (ohne Login).
4. Normale App: `http://<VM-IP>:8080/dashboard` → Login weiterhin erforderlich.

## Wichtige Notizen zu Portainer
1. **Keine `.env` Datei erforderlich:** Portainer injiziert diese Variablen direkt als Umgebungsvariablen in die Container zur Laufzeit. Das Mounten einer physischen `.env` Datei (`env_file`) entfällt komplett, was FileNotFound-Crashes verhindert.
2. **Auto-Interpolation:** Portainer/Compose liest z.B. `POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}` und ersetzt es nahtlos. Fehlt die Variable in Portainer, wird der Default `postgres` genommen (was die Fallback-Stabilität sichert).

## Changelog
- **Refactoring:** `DB_HOST` (Backend) und `VITE_API_BASE_URL` (Frontend) als explizite Container-Umgebungsvariablen hinzugefügt, um harte Koppelungen in Prod-Environments zu vermeiden.

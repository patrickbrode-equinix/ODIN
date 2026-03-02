# PRODUCTION CONNECTIVITY

Die Kommunikation zwischen Frontend und Backend ist bereits durch den Code robust vorbereitet:
- **Frontend (`api.ts`):** Prüft, ob `import.meta.env.VITE_API_BASE_URL` existiert und nicht leer ist. Falls ja, wird dies als Axios `baseURL` genommen, ansonsten standardmäßig `"/api"`.
- **Backend (`config/index.js` & `server.js`):** Liest `CORS_ORIGINS` als komma-separierte Liste via `.split(",")` und prüft im Fallback mit `.includes(origin)` streng auf genaue Domains (kein unsicherer Substring-Match).

## Szenario A: Lokaler Podman / WSL Test (Ohne Reverse Proxy)
In einem reinen Compose-Setup ohne Reverse Proxy muss der Browser des Users das Backend direkt ansteuern (Port `8001`).
- **Frontend ENV:** `VITE_API_BASE_URL=http://localhost:8001` 
- **Backend ENV:** `CORS_ORIGINS=http://localhost:8000`

## Szenario B: Production (Mit Reverse Proxy z.B. Nginx)
In Production werden beide Dienste über dieselbe Domain ausgeliefert, was CORS-Probleme nativ eliminiert.
- **Frontend ENV:** `VITE_API_BASE_URL` bleibt ungesetzt oder explizit leer (Axios schickt Requests an `/api`).
- **Backend ENV:** `CORS_ORIGINS=https://deine-prod-domain.de` (falls doch direkte Zugriffe nötig sein sollten, z.B. für Extensions oder externe Tools).
- **Reverse Proxy Routing:** `/` geht an den Frontend-Service, `/api/` geht an den Backend-Service.

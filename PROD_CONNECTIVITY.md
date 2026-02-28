# ODIN Production Connectivity Guide

Dieses Dokument beschreibt das Netzwerk-Routing zwischen dem statisch gebauten Frontend (React/Vite) und dem Node.js Backend unter Produktionsbedingungen (z.B. Portainer oder eine reine VM ohne Reverse Proxy).

## Architektur-Szenario A: KEIN Reverse Proxy (Portainer Direct)
Wenn die Container direkt Ports auf der Host-Netzwerkschnittstelle binden (z.B. Frontend auf Port `8000` und Backend auf Port `8001`) und **kein** vorgeschalteter Reverse Proxy (wie Nginx oder Traefik) existiert, läuft der API-Aufruf direkt vom Browser des Clients (Remote) zum Backend.

### Konfiguration für Szenario A
1. **Frontend-API-URL setzen:** Da der Browser den Backend-Container (`http://backend:8001`) von außen **nicht** DNS-auflösen kann, MUSS Portainer die Public-IP oder externe Domain der VM eintragen. 
   - Setze in Portainer die Environment-Variable `VITE_API_BASE_URL` für den Frontend-Container: 
     - **Beispiel:** `VITE_API_BASE_URL=http://10.X.X.X:8001` oder `https://api.odin.firma.de`
2. **CORS freigeben:** Das Backend muss die Herkunft des Frontends erlauben.
   - Setze in Portainer die Environment-Variable `CORS_ORIGINS`:
     - **Beispiel:** `CORS_ORIGINS=http://10.X.X.X:8000` oder `https://odin.firma.de`

*Hinweis: Ohne gesetzte `VITE_API_BASE_URL` versucht das Axios-Frontend Requests relativ an `/api` auf seinem eigenen Host (Port 8000) zu schicken. Ohne Proxy-Routing für `/api` führt das typischerweise zu einem **404-Fehler**, da der Frontend-Container keine API bereitstellt.*

**HTTPS Hinweis (Mixed Content):**
- Läuft das Frontend auf `https://...`, muss die API-URL ebenfalls über `https://...` erreichbar sein, sonst blockt der Browser die Requests.

---

## Architektur-Szenario B: MIT Reverse Proxy (Nginx / Traefik / Caddy)
Wenn ein Nginx Server vor den Docker-Containern sitzt und denselben Domain-Host teilt (z.B. `https://odin.firma.de`), kann der Proxy die API-Requests ans Backend weiterleiten und die statischen Files ans Frontend liefern.

### Konfiguration für Szenario B
1. **Frontend-API-URL ignorieren/leer lassen:** Lass die `VITE_API_BASE_URL` in Portainer komplett leer oder lösche sie. Das Frontend verwendet dann seinen Fallback-Default `baseURL: "/api"`.
2. **Reverse Proxy Routing (Nginx Beispiel):** Konfiguriere deinen Proxy so, dass er Location-basiert routet:
   > Voraussetzung: Der Frontend-Container served den **statischen Build** auf Port 8000.

   ```nginx
   # Frontend (statischer Build)
   location / {
       proxy_pass http://odin-frontend:8000;
   }
   
   # Backend API
   location /api/ {
       proxy_pass http://odin-backend:8001;
   }
   ```
3. **CORS:** CORS ist hier unkritisch, da Browser Requests zur selben Origin (`https://odin.firma.de`) senden.

---

## Zusammenfassung
Die Anwendung wurde so umgebaut, dass sie **beide** Szenarien ohne Code-Änderungen an der `api.ts` nativ unterstützt. Die Wahl des Deployments wird zu 100% über die Einspeisung der Portainer Environment Variablen gesteuert.

### Changelog (Connectivity Guide)
- Präzisierung des 404-Fehlers in Szenario A (gilt primär, wenn kein Proxy-Routing existiert).
- Ergänzung des "Mixed Content" Hinweises zur HTTPS-Voraussetzung.
- Anpassung des Nginx Snippets für Szenario B (`proxy_pass http://odin-backend:8001;`) inkl. Note zum Server des statischen Builds.

# Installationsanleitung ODIN (Oracle Linux, Portainer, Podman)

Dieses Dokument beschreibt das Deployment der ODIN Applikation via Portainer und Podman Compose unter Oracle Linux. Es wird **kein `env_file`** verwendet; alle Umgebungsvariablen werden direkt in Portainer verwaltet. Dies gewährt maximale Stabilität und Sicherheit in Produktionsumgebungen.

Wichtige Category-C Contracts (wie der `X-OES-INGEST-KEY`, die `/dispatcher` Route oder Storage Keys) bleiben bei diesem Setup unverändert erhalten und müssen transparent ans Backend weitergereicht werden.

## 1. Voraussetzungen

- Ein System unter **Oracle Linux (Version 8 oder 9)**.
- Die folgenden Pakete müssen auf dem System verfügbar sein:
  - `podman`
  - `podman-compose` (oder alternativ das Podman Compose Plugin)
  - `firewalld` (falls die System-Firewall genutzt wird)

## 2. VM Vorbereitung

Führe als `root` (oder via `sudo`) die folgenden Befehle auf der VM aus, um das System vorzubereiten:

```bash
# Optional: System aktualisieren
sudo dnf update -y

# Podman und Compose-Tools installieren
sudo dnf install -y podman podman-compose
```

**Firewall-Konfiguration (falls `firewalld` aktiv ist):**
Es müssen die Ports für das Frontend (8080) und das Backend (8001) extern freigegeben werden. 
*Hinweis: Port 8002 (Postgres) sollte standardmäßig **NICHT** nach außen geöffnet werden, da die Applikation intern mit der Datenbank kommuniziert. Falls Postgres-Port 8002 in Compose nach außen published ist, sollte er in Production optional deaktiviert bleiben (Security).*

```bash
# Ports für Frontend und Backend öffnen
sudo firewall-cmd --permanent --add-port=8080/tcp  # Frontend
sudo firewall-cmd --permanent --add-port=8001/tcp  # Backend API

# Optional: Ports für Portainer öffnen (falls extern erreichbar sein soll)
# Empfehlung: nur 9443 extern öffnen; 9000 nur intern/VPN.
sudo firewall-cmd --permanent --add-port=9443/tcp
sudo firewall-cmd --permanent --add-port=9000/tcp

# Regeln anwenden
sudo firewall-cmd --reload
```

## 3. Portainer Setup

Falls Portainer bereits auf der VM läuft, kann dieser Abschnitt **übersprungen** werden.
Falls nicht, hier ein minimales Standard-Setup für Portainer unter Podman:

```bash
# Portainer Volume anlegen
podman volume create portainer_data

# Portainer Container starten
podman run -d -p 9000:9000 -p 9443:9443 --name portainer \
    --restart=always \
    -v /run/podman/podman.sock:/var/run/docker.sock:Z \
    -v portainer_data:/data \
    portainer/portainer-ce:latest
```
Das Socket-Mapping `/run/podman/podman.sock -> /var/run/docker.sock` ist beabsichtigt, damit Portainer Podman verwalten kann.

Rufe anschließend `https://<VM-IP>:9443` (oder `http://<VM-IP>:9000`) auf und erstelle den initialen Admin-Account.

## 4. Stack Deployment in Portainer

Das Deployment erfolgt als Compose-Stack in der Portainer UI.

1. Gehe in Portainer auf dein Local Environment.
2. Navigiere zu **Stacks** -> **Add stack**.
3. **Name:** `odin`
4. **Deployment-Methode:**
  - **Variante A (Git Repository):** Wähle "Repository" und gib die URL des Git-Repos ein sowie als Compose-Pfad `docker-compose.yml`.
  - **Variante B (Web Editor):** Wähle "Web editor" und kopiere den Inhalt der `docker-compose.yml` direkt in das Textfeld.
  - **Wichtig für Linux/Portainer:** Die Build-Kontexte im Compose müssen exakt den im Git-Repo vorhandenen Ordnernamen folgen. In diesem Repo sind das `./backend` und `./frontend` in Kleinschreibung.

## 5. Pflicht-ENV Variablen

Alle notwendigen Variablen werden im Bereich "Environment variables" in Portainer eingetragen ("Add environment variable"). Es wird **kein** `.env` File gemountet!

| Variable | Beispielwert / Notiz |
| :--- | :--- |
| **`DB_NAME`** | `odin` (Default ist ok) |
| **`DB_HOST`** | `postgres` |
| **`DB_PORT`** | `5432` |
| **`DB_USER`** | `odin_db_admin` |
| **`DB_PASSWORD`** | `<Ein-sehr-sicheres-Passwort>` |
| **`JWT_SECRET`** | `<Ein-Sicherer-Zufalls-String>` |
| **`QUEUE_INGEST_KEY`** | `<Crawler-Security-Key>` (Wichtig für *Category-C* Ingest) |
| **`CORS_ORIGINS`** | `http://<VM-IP>:8080` (oder die HTTPS Domain des Frontends) |
| **`VITE_API_BASE_URL`** | **Leer lassen / nicht setzen**. Der vorbereitete Stack baut das Frontend bereits mit `/api`. |

*Zusätzlich optionale Variablen:*
- `JWT_EXPIRES_IN`: z.B. `12h` oder `7d`

## 6. Deploy & Verify

1. Klicke unten auf **Deploy the stack**.
2. **Portainer Logs:** Prüfe in der Container-Übersicht die Logs des `backend`- und `postgres`-Containers, um sicherzustellen, dass die Schema-Initialisierung (`initSchema`) und der Start fehlerfrei liefen.
3. **Healthcheck Backend (Terminal auf der VM):**
   ```bash
   curl -i http://localhost:8001/api/health
   ```
   Erwartet wird ein HTTP `200 OK`.
4. **Frontend Check:**
  Rufe im Browser `http://<VM-IP>:8080` auf. Das Login-Fenster sollte erscheinen.

## 7. Connectivity Szenarien

Je nach Infrastruktur wird das ODIN Setup unterschiedlich angebunden (siehe auch `PROD_CONNECTIVITY.md`):

- **Szenario A (Portainer Direct / Host Routing):** Kein Nginx/Proxy. Der Browser kommuniziert direkt auf Port 8080 (Frontend) und 8001 (Backend). **Wichtig:** `VITE_API_BASE_URL` sollte im Standardfall **nicht** in Portainer gesetzt werden, weil das Frontend im Container bereits auf `/api` gebaut wird und intern an `backend:8001` proxyt. `CORS_ORIGINS` muss den Frontend-Ursprung `http://<VM-IP>:8080` enthalten.
- **Szenario B (Reverse Proxy):** Nginx, Traefik o.ä. sitzt davor und routet Traffic derselben Domain. Das Frontend wird unter `/` und das Backend unter `/api` serviert. In diesem Fall *muss* `VITE_API_BASE_URL` in Portainer **leer** bleiben oder gelöscht werden, sodass das Frontend relative Requests an `/api` sendet.

## 8. Troubleshooting

- **Fehler: Stack-Build bricht in Portainer auf Oracle Linux sofort ab**
  - *Ursache:* Die Compose-Datei zeigt auf einen Ordnernamen, der nicht exakt im Git-Checkout existiert. Oracle Linux und Portainer behandeln `backend` und `Backend` als unterschiedliche Pfade.
  - *Lösung:* Ausschließlich die vorbereitete `docker-compose.yml` aus diesem Repo verwenden. Dort zeigen die Build-Kontexte korrekt auf `./backend` und `./frontend`.
- **Fehler: CORS blocked im Browser (F12 Konsole)**
  - *Ursache:* Das Backend (Port 8001) lehnt Requests der Frontend-Domain ab.
  - *Lösung:* Überprüfe den Wert von `CORS_ORIGINS`. Er muss exakt den Frontend-Ursprung beinhalten (z.B. `http://<VM-IP>:8080`).
- **Fehler: Mixed Content Error**
  - *Ursache:* Das Frontend wird via HTTPS aufgerufen, das Backend aber nur via HTTP. Ein Browser wird diese unsicheren API-Gespräche blockieren.
  - *Lösung:* Auch das Backend muss hinter einem SSL-Proxy laufen (Szenario B nutzen oder separaten Proxy einrichten) und `VITE_API_BASE_URL` muss mit `https://...` beginnen.
- **Fehler: Backend-Container stürzt ab, kann Stack/DB nicht erreichen**
  - *Ursache:* Falscher `DB_HOST` oder inkonsistente `DB_PASSWORD` Konfiguration.
  - *Lösung:* Sicherstellen, dass `DB_HOST=postgres` ist und die Credentials vom Backend exakt zu denen des Postgres-Containers passen. `DB_HOST` muss exakt dem Compose-Service-Namen entsprechen (standard: `postgres`).
- **Fehler: initSchema oder Migrationen laufen nicht durch**
  - *Lösung:* Container Logs des Backends prüfen. Wenn die Datenbank vom Backend vor der Startbereitschaft aufgerufen wurde, hilft oft ein Neustart (Restart) des `backend` Containers in Portainer.

---

## Definition of Done (Checklist)
- [ ] Ports 8080 und 8001 in der Firewall freigeschaltet (Postgres bleibt intern).
- [ ] Portainer Ports (9443/9000) kollidieren nicht mit ODIN.
- [ ] Stack ist in Portainer deployed, ohne Verwendung einer `.env` Datei.
- [ ] Alle Pflicht-ENVs (insb. Secrets und `CORS_ORIGINS`) sind korrekt im Stack via Web-UI eingetragen.
- [ ] HTTP-Healthcheck an Port 8001 (`/api/health`) liefert `200 OK`.
- [ ] UI im Browser unter Port 8080 erreichbar und Login-API wird via Browser nicht als CORS-Fehler oder 404 abgewiesen.

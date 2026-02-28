# ODIN Installation Guide (Oracle Linux + Podman + Portainer)

Dieses Dokument ist der finale, offizielle Leitfaden für das Deployment von ODIN auf einer Oracle Linux (Version 8 oder 9) Virtual Machine. Das Setup verwendet **Podman** als Container-Engine und **Portainer** zur Orchestrierung (via Compose-Syntax).

> **Achtung (Risiko-Policy):** Alle Category-C Konventionen (wie `X-OES-INGEST-KEY`, Routing-Pfade, Storage-Keys) bleiben systemweit unberührt, um die Kompatibilität zu 100% sicherzustellen. Es werden keine lokalen `env_file`s gemountet.

---

## 1. Voraussetzungen

- **OS:** Oracle Linux 8 oder 9 (frische Installation empfohlen)
- **Pakete:** `podman`, `podman-compose` (oder das native `podman compose` Plugin)
- **Netzwerk:** Firewalld (oder iptables) für die Verwaltung der Freigaben

## 2. VM Vorbereitung

Führe diese Befehle als `root` (oder via `sudo`) auf der Oracle Linux VM aus.

### 2.1 System aktualisieren & Podman installieren
```bash
# System aktualisieren (optional aber empfohlen)
sudo dnf update -y

# Podman RPMs installieren
sudo dnf install -y podman podman-compose
```

### 2.2 Podman Socket für Portainer aktivieren (Rootless oder Rootful)
*Für ein server-weites Portainer empfiehlt sich oft das Rootful-Socket für den Administrator.*
```bash
sudo systemctl enable --now podman.socket
```

### 2.3 Firewall Konfigurieren (Firewalld)
Öffne die benötigten Public-Ports. 
*Hinweis: Port `8002` (Postgres) wird **nicht** nach außen geöffnet, da die Client-Verbindung ausschließlich im internen Docker-Netzwerk erfolgt.*

```bash
# Frontend UI
sudo firewall-cmd --zone=public --add-port=8000/tcp --permanent
# Backend API
sudo firewall-cmd --zone=public --add-port=8001/tcp --permanent
# (Optional) pgAdmin Management
sudo firewall-cmd --zone=public --add-port=8003/tcp --permanent

# Regeln neu laden
sudo firewall-cmd --reload
```

---

## 3. Portainer Setup (Skip, falls bereits vorhanden)

Falls noch kein Portainer existiert, starte ihn einmalig (hier als Rootful-Beispiel via Podman):

```bash
sudo podman volume create portainer_data
sudo podman run -d -p 8000:8000 -p 9443:9443 --name portainer \
    --restart=always \
    -v /run/podman/podman.sock:/var/run/docker.sock:Z \
    -v portainer_data:/data \
    portainer/portainer-ce:latest
```
*Portainer ist dann via `https://<VM-IP>:9443` erreichbar. Erstelle dort den initialen Admin-User.*

---

## 4. Stack Deployment in Portainer

Das Deployment in Portainer ist der sicherste und stabilste Weg für ODIN.

1. Öffne Portainer und klicke auf dein lokales Environment.
2. Navigiere im Menü links zu **"Stacks"** und klicke auf **"Add stack"**.
3. **Name:** `odin` (Empfohlen, um den Prefix `odin-*` für Container zu triggern).
4. **Build Method:** Wähle **"Repository"** (Git) oder **"Web editor"** (Paste der Compose-File).
   - *Tipp:* Das Verwenden von `podman-compose.yml` aus diesem Repository ist präferiert, `docker-compose.yml` verhält sich aber absolut identisch.

---

## 5. Pflicht-ENV Variablen (Portainer "Env" Tab)

Beim Erstellen des Stacks gehst du in den Bereich **"Environment variables"** (Advanced mode = Copy/Paste). Diese Werte steuern die gesamte App. **Es gibt kein `env_file`.** 

| Variable | Beispiel | Beschreibung |
| :--- | :--- | :--- |
| `DB_NAME` | `odin` | Name der Postgres-Datenbank. |
| `DB_HOST` | `postgres` | Compose Service-Name der Datenbank. |
| `DB_PORT` | `5432` | Interner Port der DB. |
| `DB_USER` | `admin_odin` | Sicheres Postgres-Login. |
| `DB_PASSWORD` | `SuperSecret!!` | Sicheres Postgres-Passwort. |
| `JWT_SECRET` | `a3f8b...` | Zwingend für Sicherheit! (Generiere 64 Zeichen Hex). |
| `QUEUE_INGEST_KEY` | `CrawlerKey!` | Zwingend für den Crawler zur Datenübermittlung. |
| `CORS_ORIGINS` | `http://<VM-IP>:8000` | Wer darf das Backend aufrufen? (Komma-separiert für mehrere). |
| `VITE_API_BASE_URL` | `http://<VM-IP>:8001` | **Wichtig:** Wohin schickt der Browser des Users die API-Calls? |

> *Optional für pgAdmin:* `PGADMIN_EMAIL=admin@firma.de` und `PGADMIN_PASSWORD=secret`

---

## 6. Deploy & Verify

1. Klicke unten auf **"Deploy the stack"**.
2. Portainer lädt die Images und führt den Build durch. 
3. Gehe in den Stack "odin" und prüfe die Logs der Container `odin-backend` und `odin-postgres`.

**Healthcheck Backend (auf der VM):**
```bash
curl -i http://localhost:8001/api/health
# Erwartet: HTTP 200 OK
```

**Healthcheck Frontend (im eigenen Browser):**
Öffne `http://<VM-IP>:8000` – Du solltest den ODIN Login-Bildschirm sehen.

---

## 7. Connectivity Szenarien (Kurzfassung)

Wie in der `PROD_CONNECTIVITY.md` definiert, steuert Portainer das Routing:

- **Szenario A (Ohne Reverse Proxy - Default für dieses Setup):** `VITE_API_BASE_URL` **MUSS** auf die externe IP/Domain (`http://<VM-IP>:8001`) gesetzt sein. Das Frontend ruft die API direkt am Browser vorbei auf.
- **Szenario B (Mit Reverse Proxy wie Nginx):** Lasse `VITE_API_BASE_URL` in Portainer **leer**. Das Frontend nutzt intern `/api` und der Proxy leitet diese Anfragen an Port 8001 weiter.

---

## 8. Troubleshooting

| Fehlerbild | Ursache & Lösung |
| :--- | :--- |
| **API Requests brechen ab mit 404 Not Found** auf `/api/irgendwas` im Frontend. | **Ursache:** Du betreibst keinen Proxy, hast aber in Portainer `VITE_API_BASE_URL` vergessen/leer gelassen. Das Frontend versucht vergeblich, sich selbst auf Port 8000 zu rufen. |
| **CORS Fehler (Network Error / Blocked by CORS)** in der Browser-Console. | **Ursache:** Die URL im Browser passt nicht zur `CORS_ORIGINS` Variable im Backend. Stelle sicher, dass `http://<VM-IP>:8000` exakt (ohne schließenden Slash) im Portainer-Env des Backends steht. |
| **Mixed Content Warning** (Konsole). | **Ursache:** Dein Frontend hostet via `https://`, aber die `VITE_API_BASE_URL` zielt auf `http://`. Sichere Kontexte dürfen keine unsicheren aufrufen. Nutze HTTPS für beide oder HTTP für beide. |
| **Backend "FATAL: Connection refused" / kann DB nicht erreichen.** | **Ursache:** `DB_HOST`, `DB_USER` oder `DB_PASSWORD` in Portainer sind falsch geschrieben oder die DB bootet noch (`pg_isready` Healthcheck schlägt fehl). |
| **Teile des UI laden endlos (Spinner). DB Schema fehlt.** | **Ursache:** Initiales Setup (`backend/db/initSchema.js`) lief auf einen Fehler. Prüfe die Logs des `odin-backend` Containers. Normalerweise baut ODIN die Tabellen beim ersten Start selbst. Starte den Backend-Container 1x neu. |

---

## 9. Definition of Done (Checkliste)

- [ ] VM ist up-to-date und Firewall-Regeln (`8000`, `8001`, `8003`) sind aktiv.
- [ ] Portainer Stack `odin` ist erfolgreich (grün) deployed.
- [ ] Kein Container wirft "env_file not found" Errors.
- [ ] Das Frontend (`http://<VM-IP>:8000`) ist im Browser erreichbar und zeigt "ODIN" Branding.
- [ ] Login (API Call) funktioniert ohne 404 oder CORS-Errors im Netzwerk-Tab.

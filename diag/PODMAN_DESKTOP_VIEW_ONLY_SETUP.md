# PODMAN DESKTOP: VIEW-ONLY SETUP (WSL ENGINE)

Dieses Setup konfiguriert Podman Desktop so, dass es als "View-Only" Dashboard für die bestehenden Rootful-Podman-Container (ODIN) innerhalb von WSL dient, ohne Umzüge, Neu-Deployments oder Code-Änderungen.

## 1. Diagnose & Voraussetzungen
Die bestehende ODIN-Installation verwendet den Root-Socket in WSL. Das Windows Podman CLI schlug beim npipe-Schema fehl, aber die SSH-Verbindung zur Maschine ist intakt.

- **Lokaler SSH Port (WSL/Podman Machine):** `55819` (oder den Port aus `C:\Users\Admin\AppData\Roaming\containers\podman-connections.json` ablesen)
- **Identity File (SSH Key):** `C:\Users\Admin\.local\share\containers\podman\machine\machine`
- **Socket Path:** `/run/podman/podman.sock`

## 2. Podman API in WSL aktivieren (falls nicht aktiv)
Damit die Remote-Engine (Desktop) den Status der Container ordentlich abfragen kann, muss der API-Socket aktiv sein.
Führe in der WSL (oder in der `wsl --exec bash` Konsole) Folgendes aus:
```bash
sudo systemctl enable --now podman.socket
sudo systemctl status podman.socket
ls -la /run/podman/podman.sock
```
*Der Socket sollte nun existieren und dem User root gehören.*

## 3. Podman Desktop konfigurieren (UI Klickpfad)
Öffne Podman Desktop und richte die Verbindung per SSH ein:

1. Gehe in die **Settings** (Zahnrad unten rechts) -> **Resources**.
2. Scrolle zu "Podman" und wähle **Add new / Create new** (bzw. bei Remote Engines / Custom Connections auf das **`+`** Symbol klicken).
3. Wähle den Typ **SSH Connection** / **Remote Connection**.
4. Fülle die Felder exakt wie folgt aus:
   - **Name:** `Odin-WSL-Remote`
   - **Host:** `127.0.0.1`
   - **Port:** `55819` *(bzw. den Port aus der Diagnose nutzen)*
   - **User:** `root` *(Wichtig, da ODIN auf dem Root-Socket läuft)*
   - **Socket Path:** `/run/podman/podman.sock`
   - **Identity Key:** `C:\Users\Admin\.local\share\containers\podman\machine\machine`
5. Speichere die Connection und setze sie auf **Start/Connect**.

### ⚠️ WICHTIG: Alternativer Weg (falls "Remote SSH" im Desktop fehlt)
Sollte Podman Desktop in der installierten Version keine direkte UI für "Remote SSH Engines" bieten, gibt es **zwei View-Only Alternativen**:

**Alternative A (Windows Podman CLI Fix):**
Podman Desktop liest die globale `podman-connections.json` in Windows. Standardmäßig steht "Default" auf `podman-desktop` (npipe), was fehlschlägt. Ändere die Default-Engine:
1. Öffne PowerShell.
2. Führe aus: `podman system connection default podman-machine-default-root`
3. Starte Podman Desktop neu. Es sollte nun automatisch die bestehende lokale VM / WSL Engine im Root-Modus anzeigen.

**Alternative B (Portainer Dashboard - isoliert):**
Starte in WSL einen leichtgewichtigen Portainer-Container im Read-Only Modus (keine Auswirkung auf ODIN):
```bash
podman run -d -p 9000:9000 --name portainer-viewer --restart=always \
  -v /run/podman/podman.sock:/var/run/docker.sock:ro \
  portainer/portainer-ce:latest
```
Rufe `http://localhost:9000` auf, um ein visuelles Monitoring der laufenden ODIN Container zu erhalten.

## 4. Verifikation
1. Nach Verbindung in Podman Desktop (oder Portainer) auf den Reiter **Containers** klicken.
2. Es müssen folgende laufende Container sichtbar sein:
   - `odin-backend`
   - `odin-postgres`
   - `odin-frontend`
   - `odin-pgadmin`
3. **Regel:** Es handelt sich um ein View-Only Setup. Klicke keine "Stop/Start" oder "Delete" Buttons, belasse die Verwaltung beim `podman-compose` CLI in der WSL.

## 5. Troubleshooting (Häufige Fehler)
- **Desktop zeigt weiterhin nichts an:** 
  - Verifiziere den SSH Port in der Datei `C:\Users\Admin\AppData\Roaming\containers\podman-connections.json`. Der Port ändert sich manchmal nach WSL/Machine-Neustarts.
  - Prüfe ob der Socket in WSL aktiv ist: `sudo systemctl status podman.socket`.
- **Permission Denied beim Socket:**
  - Du hast als SSH-User `user` (1000) statt `root` verwendet, willst aber `/run/podman/podman.sock` lesen. Nutze als User immer `root` oder füge den Ziel-User in WSL in die sudoers/podman-Gruppe ein.
- **SSH Key wird vom Desktop abgewiesen:**
  - Podman Desktop erwartet mitunter einen klassischen ED25519/RSA Key ohne Passphrase. Erstelle in der WSL einen frischen Key (`ssh-keygen -t ed25519 -f ./desktop_key`) und füge den `.pub` in `/root/.ssh/authorized_keys` ein. Leite dann den Private Key nach Windows und lade ihn im DesktopUI hoch.

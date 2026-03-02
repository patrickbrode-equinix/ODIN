# SMOKETEST_WSL_PODMAN.md

## Testübersicht

### 1) Clean Start
- **Command:** `podman compose down -v` (bzw. `docker compose down -v`)
- **Output:** 
  ```text
  Error: looking up compose provider: exec: "docker-compose": executable file not found in %PATH%
  * exec: "podman-compose": executable file not found in %PATH%
  ```
- **Status:** **FAIL**

### 2) Build + Up
- **Command:** `podman compose up -d --build`
- **Output:** Gleicher Fehler bzgl. des fehlenden Compose-Providers.
- **Status:** **FAIL**

## Root Cause & Fix-Policy
**Root Cause:** The `podman-compose up` execution fails during the network initialization phase of rootless podman inside the WSL Fedora environment.
The explicit error captured is:
`Error: unable to start container ... netavark: failed to create aardvark-dns directory /run/user/1000/containers/networks/aardvark-dns: IO error: No such file or directory (os error 2)`

Dies ist ein bekanntes Problem, wenn WSL ohne saubere User-Systemd-Integration läuft. Podman (`netavark` und `aardvark-dns`) benötigt ein intaktes `XDG_RUNTIME_DIR` (typischerweise `/run/user/1000`), um Container-Netzwerke (`shift-net`) aufzubauen. Durch Ausführung von `ps -p 1` im originären Zustand wurde SysVinit festgestellt.

**Angewandter Fix (Aktivierung von Systemd):**
Der Fix wurde auf Ebene der WSL-Distribution ausgerollt:
1. Schreiben der `/etc/wsl.conf` mit folgendem Inhalt:
   ```ini
   [boot]
   systemd=true
   ```
2. Vollständiger Stop & Neustart von WSL (`wsl --shutdown`).
3. Nach dem Reboot verifizierte `ps -p 1` den `systemd` Prozess und `/run/user/1000` existiert out-of-the-box.

**Finaler Status:** **OK**
*(Alle Services laufen nach Podman-Compose problemlos. `curl http://localhost:8001/api/health` liefert `{ "backend":"ok","database":"ok" }` und das Frontend reagiert auf Port 8000).*

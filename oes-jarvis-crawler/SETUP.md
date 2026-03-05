# OES Jarvis Crawler — Setup Guide

The crawler is a Chrome MV3 extension that scrapes the OES/Jarvis ticket queue and
posts snapshots to the ODIN backend via `POST /api/queue/snapshot`.

The target URL is **fully configurable** — no hardcoded values in code.  
Default (local dev): `http://localhost:8001`  
Production VM: `http://fr2lxcops01.corp.equinix.com:8080`

---

## 1. Load the Extension in Chrome

1. Open **chrome://extensions**
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `oes-jarvis-crawler/oes-jarvis-crawler/` folder
4. The extension icon should appear in the toolbar; pin it for easy access

---

## 2. Configure the Target URL and Ingest Key

The crawler reads its backend URL and authentication key from **Chrome local storage**
(not from hardcoded values). You must set these once per browser profile.

### Option A — Extension Options Page (recommended)

1. Open **chrome://extensions**
2. Find **OES Jarvis Crawler** → click **Extension options** (or right-click the icon → Options)
3. Set **ODIN Server URL**:
   - Local dev: `http://localhost:8001`
   - VM (Portainer/Podman on port 8080): `http://fr2lxcops01.corp.equinix.com:8080`
   - VM via Reverse Proxy (no port): `http://fr2lxcops01.corp.equinix.com`
4. Set **Ingest Key** — must match `QUEUE_INGEST_KEY` in ODIN's `.env` / Portainer env
5. Click **Save** — changes take effect on the next scrape cycle (≤1 minute)

Quick-select buttons for common environments are available on the Options page.

### Option B — Chrome DevTools Console

1. Open any tab in Chrome
2. Press **F12** → go to the **Console** tab
3. Run the following command — replace the placeholders with real values:

```js
chrome.storage.local.set({
  odin_base_url:   "http://fr2lxcops01.corp.equinix.com:8080",
  odin_ingest_key: "<YOUR_INGEST_KEY>"   // value of QUEUE_INGEST_KEY in .env
});
```

4. Verify the values were saved:

```js
chrome.storage.local.get(["odin_base_url", "odin_ingest_key"], console.log);
// → {odin_base_url: "http://fr2lxcops01.corp.equinix.com:8080", odin_ingest_key: "..."}
```

### Option C — Service Worker Console

1. Open **chrome://extensions**
2. Find **OES Jarvis Crawler** → click **Service Worker** (inspect)
3. In the Console of the service worker DevTools, run the same command as above

---

## 3. Local Development (no VM)

For local development with the ODIN backend on port 8001 (default):

```js
chrome.storage.local.set({
  odin_base_url:   "http://localhost:8001",
  odin_ingest_key: "CHANGE_ME"
});
```

Alternate port 5055 / legacy proxy:

```js
chrome.storage.local.set({
  odin_base_url:   "http://localhost:5055",
  odin_ingest_key: "CHANGE_ME"
});
```

If neither key is set in storage, the extension defaults to `http://localhost:8001` with
ingest key `CHANGE_ME`.

---

## 4. Trigger a Snapshot Manually

In the service worker console, send the `OES_UPLOAD_SNAPSHOT` message to force a crawl:

```js
chrome.runtime.sendMessage({ type: "OES_UPLOAD_SNAPSHOT" });
```

Or use the extension popup / keyboard shortcut if the extension registers one.

---

## 4b. Storage Keys Reference

| Key | Default | Description |
|-----|---------|-------------|
| `odin_base_url` | `http://localhost:8001` | ODIN backend base URL (no trailing slash) |
| `odin_ingest_key` | `CHANGE_ME` | Value of `QUEUE_INGEST_KEY` in ODIN `.env` |

The ingest endpoint is always: `<odin_base_url>/api/queue/snapshot`

---

## 5. Ingest Key Reference

The `QUEUE_INGEST_KEY` is set in the project's `.env` file (or Portainer/Podman stack
environment) and defaults to `CHANGE_ME_DEV_KEY` in development.

In production, generate a strong random key:

```bash
openssl rand -hex 32
```

Then set it in both places:

- **Server** (`.env` or Portainer env var): `QUEUE_INGEST_KEY=<key>`
- **Crawler** (Chrome storage): `odin_ingest_key: "<key>"`

---

## 6. Supported Host Permissions

The extension's `manifest.json` pre-authorises the following targets:

| URL | Use case |
|-----|----------|
| `http://localhost:8001` | Local ODIN backend (default) |
| `http://localhost:5055` | Local ODIN backend (alternate port) |
| `http://127.0.0.1:8001` | Local (loopback alias) |
| `http://127.0.0.1:5055` | Local (loopback alias, alternate) |
| `http://localhost:8000` | Local ODIN frontend proxy |
| `http://fr2lxcops01.corp.equinix.com` | Production VM (reverse proxy / no port) |
| `http://fr2lxcops01.corp.equinix.com:8080` | Production VM (Portainer mapped port) |
| `http://fr2lxcops01.corp.equinix.com:8001` | Production VM (direct backend port) |

If you point the crawler at a different host/port, add it to `host_permissions` in
`manifest.json` and reload the extension.

---

## 7. CORS

The ODIN backend (`backend/server.js`) already allows `chrome-extension://*` origins
globally. No additional CORS configuration is needed on the server side.

---

## 8. Troubleshooting

| Symptom | Check |
|---------|-------|
| `401 Unauthorized` | Ingest key mismatch — check Options page or storage values |
| `403 Forbidden` | Ingest key missing or wrong — verify `QUEUE_INGEST_KEY` on server |
| `ERR_CONNECTION_REFUSED` | Wrong URL or backend not running — `podman compose ps` on VM |
| `net::ERR_BLOCKED_BY_CLIENT` | URL not in `manifest.json` `host_permissions` — add and reload |
| `Invalid odin_base_url` in service worker log | URL does not start with `http://` or `https://` |
| Snapshot posts but queue unchanged | OES page not open or session expired — re-login to OES |

Inspect service worker logs: **chrome://extensions** → OES Jarvis Crawler → **Service Worker** (inspect) → Console.

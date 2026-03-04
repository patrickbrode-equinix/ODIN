# OES Jarvis Crawler — Setup Guide

The crawler is a Chrome MV3 extension that scrapes the OES/Jarvis ticket queue and
posts snapshots to the ODIN backend via `POST /api/queue/snapshot`.

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

### Via Chrome DevTools Console (easiest)

1. Open any tab in Chrome
2. Press **F12** → go to the **Console** tab
3. Run the following command — replace the placeholders with real values:

```js
chrome.storage.local.set({
  odin_base_url:  "http://<VM_IP>:8001",   // e.g. "http://192.168.1.50:8001"
  odin_ingest_key: "<YOUR_INGEST_KEY>"      // value of QUEUE_INGEST_KEY in .env
});
```

4. Verify the values were saved:

```js
chrome.storage.local.get(["odin_base_url", "odin_ingest_key"], console.log);
// → {odin_base_url: "http://192.168.1.50:8001", odin_ingest_key: "..."}
```

### Via the Extension's Service Worker Console

1. Open **chrome://extensions**
2. Find **OES Jarvis Crawler** → click **Service Worker** (inspect)
3. In the Console of the service worker DevTools, run the same command as above

---

## 3. Local Development (no VM)

For local development with the backend running on port 5055:

```js
chrome.storage.local.set({
  odin_base_url:  "http://localhost:5055",
  odin_ingest_key: "CHANGE_ME_DEV_KEY"
});
```

---

## 4. Trigger a Snapshot Manually

In the service worker console, send the `OES_UPLOAD_SNAPSHOT` message to force a crawl:

```js
chrome.runtime.sendMessage({ type: "OES_UPLOAD_SNAPSHOT" });
```

Or use the extension popup / keyboard shortcut if the extension registers one.

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

## 6. Troubleshooting

| Symptom | Check |
|---------|-------|
| `401 Unauthorized` from backend | Ingest key mismatch — re-run step 2 |
| `ERR_CONNECTION_REFUSED` | VM IP wrong or backend not running — `podman compose ps` |
| `net::ERR_BLOCKED_BY_CLIENT` | Check `manifest.json` `host_permissions` includes the VM IP/port |
| Snapshot posts but queue unchanged | OES page not open or session expired — re-login to OES |

For `host_permissions`, the extension currently allows:

```
http://127.0.0.1:5055/*
http://127.0.0.1:8001/*
http://localhost:5055/*
http://localhost:8001/*
```

If your VM has a different IP, add it to `manifest.json → host_permissions` and reload
the extension.

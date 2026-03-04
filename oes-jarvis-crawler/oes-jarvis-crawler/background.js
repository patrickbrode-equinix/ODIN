// ==============================
// OES Jarvis Crawler - background.js (MV3 Service Worker)
// ==============================

const ALARM_NAME = "oes_queue_scrape";
const PERIOD_MINUTES = 1; // ✅ für Tests (später 3)

const STORAGE_KEY_LAST_URL = "oes_last_jarvis_url";

function log(...args) {
  console.log("[ODIN Crawler]", ...args);
}
function warn(...args) {
  console.warn("[ODIN Crawler]", ...args);
}
function err(...args) {
  console.error("[ODIN Crawler]", ...args);
}

function createAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MINUTES });
  log(`Alarm created (${PERIOD_MINUTES} minute)`);
}

chrome.runtime.onInstalled.addListener(() => {
  log("Extension installed");
  createAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  log("Browser startup");
  createAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  log("Alarm fired");

  try {
    const tabs = await chrome.tabs.query({ url: ["https://jarvis-emea.equinix.com/*"] });
    log("Found tabs:", tabs.length);

    // If no Jarvis tab is open, reopen the last seen Jarvis URL in the background.
    if (tabs.length === 0) {
      const stored = await chrome.storage.local.get([STORAGE_KEY_LAST_URL]);
      const lastUrl = stored?.[STORAGE_KEY_LAST_URL];
      if (lastUrl) {
        log("No Jarvis tab found. Reopening last Jarvis URL in background...", lastUrl);
        const created = await chrome.tabs.create({ url: lastUrl, active: false });
        if (created?.id) {
          // wait for load completion
          await new Promise((resolve) => {
            const onUpdated = (tabId, info) => {
              if (tabId === created.id && info.status === "complete") {
                chrome.tabs.onUpdated.removeListener(onUpdated);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(onUpdated);
          });
          try {
            log("Sending trigger to reopened tab", created.id);
            await chrome.tabs.sendMessage(created.id, { type: "OES_SCRAPE_ALL_QUEUES" });
          } catch (e) {
            warn("Cannot message reopened tab", created.id, e);
          }
        }
      } else {
        warn("No Jarvis tabs and no last URL stored yet. Open Jarvis once to initialize.");
      }
      return;
    }

    for (const tab of tabs) {
      try {
        log("Sending trigger to tab", tab.id);
        await chrome.tabs.sendMessage(tab.id, { type: "OES_SCRAPE_ALL_QUEUES" });
      } catch (e) {
        warn("Cannot message tab", tab.id, e);
      }
    }
  } catch (e) {
    err("Failed to query tabs:", e);
  }
});

// Single message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // informational logs
  if (msg?.type === "OES_CONTENT_READY") {
    log("Content ready on:", msg.url);
    // Remember last Jarvis URL so the crawler can reopen it if the tab is closed.
    if (msg.url && typeof msg.url === "string") {
      chrome.storage.local.set({ [STORAGE_KEY_LAST_URL]: msg.url }).catch(() => { });
    }
  }
  if (msg?.type === "OES_TRIGGER_RECEIVED") {
    log("Trigger received by content on:", msg.url);
  }
  if (msg?.type === "OES_SCRAPE_ERROR") {
    err("Scrape error on:", msg.url, msg.message);
  }

  // ✅ Upload snapshot (from content.js) -> Local ingest server
  if (msg?.type === "OES_UPLOAD_SNAPSHOT" && msg.payload) {
    (async () => {
      // Read config from chrome.storage.local.
      // Defaults: baseUrl = "http://localhost:5055" (dev), ingestKey = "CHANGE_ME"
      // To point at VM: chrome.storage.local.set({ odin_base_url: "http://<VM_IP>:8001", odin_ingest_key: "<KEY>" })
      const stored = await chrome.storage.local.get(["odin_base_url", "odin_ingest_key"]);
      const baseUrl = (stored?.odin_base_url || "http://localhost:5055").replace(/\/$/, "");
      const ingestKey = stored?.odin_ingest_key || "CHANGE_ME";

      const url = `${baseUrl}/api/queue/snapshot`;
      const method = "POST";
      try {
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-OES-INGEST-KEY": ingestKey
          },
          body: JSON.stringify(msg.payload)
        });

        const text = await res.text().catch(() => "");
        if (!res.ok) {
          const errMsg = `Upload failed: status=${res.status} statusText=${res.statusText} body=${text} url=${url} method=${method}`;
          err(errMsg);
          throw new Error(errMsg);
        }

        let json = {};
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }

        log("Upload OK (background):", json);
        sendResponse({ ok: true, result: json });
      } catch (e) {
        err("Upload FAILED (background):", e.message, e.stack);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();

    return true; // keep message channel open for async sendResponse
  }

  // default response (optional)
  // sendResponse({ ok: true });
});

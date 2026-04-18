// ==============================
// OES Jarvis Crawler - background.js (MV3 Service Worker)
// ==============================

const RECOVERY_ALARM_NAME = "oes_queue_scrape_recovery";
const RECOVERY_PERIOD_MINUTES = 1;

const STORAGE_KEY_LAST_URL = "oes_last_jarvis_url";
const STORAGE_KEY_TARGET_URL = "odin_jarvis_target_url";
const STORAGE_KEY_REFRESH_INTERVAL = "odin_refresh_interval_minutes";
const STORAGE_KEY_KEEP_AWAKE = "odin_keep_awake_enabled";
const STORAGE_KEY_STATUS = "odin_crawler_status";
const DEFAULT_JARVIS_URL = "https://jarvis-emea.equinix.com/";
const DEFAULT_REFRESH_INTERVAL_MINUTES = 5;
let KEEP_AWAKE_ACTIVE = false;

function log(...args) {
  console.log("[ODIN Crawler]", ...args);
}
function warn(...args) {
  console.warn("[ODIN Crawler]", ...args);
}
function err(...args) {
  console.error("[ODIN Crawler]", ...args);
}

function createRecoveryAlarm() {
  chrome.alarms.create(RECOVERY_ALARM_NAME, { periodInMinutes: RECOVERY_PERIOD_MINUTES });
  log(`Recovery alarm created (${RECOVERY_PERIOD_MINUTES} minute)`);
}

async function readCrawlerSettings() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEY_LAST_URL,
    STORAGE_KEY_TARGET_URL,
    STORAGE_KEY_REFRESH_INTERVAL,
    STORAGE_KEY_KEEP_AWAKE,
  ]);

  const refreshInterval = Number(stored?.[STORAGE_KEY_REFRESH_INTERVAL]);

  return {
    lastUrl: stored?.[STORAGE_KEY_LAST_URL] || null,
    targetUrl: stored?.[STORAGE_KEY_TARGET_URL] || stored?.[STORAGE_KEY_LAST_URL] || DEFAULT_JARVIS_URL,
    refreshIntervalMinutes: Number.isFinite(refreshInterval) && refreshInterval >= 0 ? refreshInterval : DEFAULT_REFRESH_INTERVAL_MINUTES,
    keepAwakeEnabled: stored?.[STORAGE_KEY_KEEP_AWAKE] !== false,
  };
}

async function updateCrawlerStatus(patch) {
  const stored = await chrome.storage.local.get([STORAGE_KEY_STATUS]);
  const current = stored?.[STORAGE_KEY_STATUS] && typeof stored[STORAGE_KEY_STATUS] === "object"
    ? stored[STORAGE_KEY_STATUS]
    : {};
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY_STATUS]: next });
  return next;
}

function requestDisplayKeepAwake(reason) {
  if (KEEP_AWAKE_ACTIVE) return;
  chrome.power.requestKeepAwake("display");
  KEEP_AWAKE_ACTIVE = true;
  log(`Display keep-awake enabled (${reason})`);
  void updateCrawlerStatus({ keepAwakeActive: true, keepAwakeReason: reason });
}

function releaseDisplayKeepAwake(reason) {
  if (!KEEP_AWAKE_ACTIVE) return;
  chrome.power.releaseKeepAwake();
  KEEP_AWAKE_ACTIVE = false;
  log(`Display keep-awake released (${reason})`);
  void updateCrawlerStatus({ keepAwakeActive: false, keepAwakeReason: reason });
}

async function getJarvisTabs() {
  return chrome.tabs.query({ url: ["https://jarvis-emea.equinix.com/*"] });
}

async function syncKeepAwakeWithTabs(reason) {
  const tabs = await getJarvisTabs();
  const settings = await readCrawlerSettings();
  if (tabs.length > 0 && settings.keepAwakeEnabled) {
    requestDisplayKeepAwake(reason);
  } else {
    releaseDisplayKeepAwake(reason);
  }

  await updateCrawlerStatus({
    jarvisTabCount: tabs.length,
    lastPresenceSyncAt: new Date().toISOString(),
    keepAwakeConfigured: settings.keepAwakeEnabled,
  });
  return tabs;
}

function selectPreferredTab(tabs) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;
  return tabs.find((tab) => tab.active) || tabs.find((tab) => !tab.discarded) || tabs[0];
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.status === "complete") return;
  } catch (_) {
    return;
  }

  await new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }, timeoutMs);

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function sendContinuousStart(tabId, reason) {
  try {
    log(`Starting continuous crawler on tab ${tabId} (${reason})`);
    await chrome.tabs.sendMessage(tabId, { type: "OES_START_CONTINUOUS_SCRAPE", reason });
    await updateCrawlerStatus({
      activeCrawlerTabId: tabId,
      lastStartReason: reason,
      lastStartSignalAt: new Date().toISOString(),
    });
  } catch (e) {
    warn("Cannot message tab", tabId, e);
    await updateCrawlerStatus({
      lastError: `Cannot message tab ${tabId}: ${String(e?.message || e)}`,
      lastErrorAt: new Date().toISOString(),
    });
  }
}

async function refreshPreferredJarvisTab(reason) {
  const tabs = await getJarvisTabs();
  const tab = selectPreferredTab(tabs);
  if (!tab?.id) {
    warn("Refresh requested but no Jarvis tab is open.");
    await ensureCrawlerRunning(`refresh_missing_tab:${reason}`);
    return;
  }

  log(`Refreshing Jarvis tab ${tab.id} (${reason})`);
  await updateCrawlerStatus({
    lastRefreshAt: new Date().toISOString(),
    lastRefreshReason: reason,
    activeCrawlerTabId: tab.id,
  });
  await chrome.tabs.reload(tab.id);
  await waitForTabComplete(tab.id, 45000);
  await sendContinuousStart(tab.id, `post_refresh:${reason}`);
}

async function maybeRunScheduledRefresh(reason) {
  const settings = await readCrawlerSettings();
  if (!settings.refreshIntervalMinutes || settings.refreshIntervalMinutes <= 0) return;

  const stored = await chrome.storage.local.get([STORAGE_KEY_STATUS]);
  const status = stored?.[STORAGE_KEY_STATUS] || {};
  if (status.runActive) {
    log(`Skipping scheduled refresh because scrape is active (${reason})`);
    return;
  }

  const lastRefreshAt = status.lastRefreshAt ? Date.parse(status.lastRefreshAt) : 0;
  const nextRefreshDueAt = lastRefreshAt + settings.refreshIntervalMinutes * 60 * 1000;
  if (lastRefreshAt && Date.now() < nextRefreshDueAt) return;

  await refreshPreferredJarvisTab(`interval:${reason}`);
}

async function ensureCrawlerRunning(reason) {
  let tabs = await syncKeepAwakeWithTabs(reason);

  if (tabs.length === 0) {
    const settings = await readCrawlerSettings();
    const openUrl = settings.lastUrl || settings.targetUrl || DEFAULT_JARVIS_URL;
    log("No Jarvis tab found. Opening configured Jarvis URL in background...", openUrl);
    await updateCrawlerStatus({
      lastRecoveryAt: new Date().toISOString(),
      lastRecoveryReason: reason,
      lastOpenedUrl: openUrl,
    });
    const created = await chrome.tabs.create({ url: openUrl, active: false });
    if (!created?.id) return;
    await waitForTabComplete(created.id);
    tabs = await syncKeepAwakeWithTabs("reopened_jarvis_tab");
  }

  const preferredTab = selectPreferredTab(tabs);
  if (!preferredTab?.id) return;
  await updateCrawlerStatus({
    activeCrawlerTabId: preferredTab.id,
    preferredJarvisUrl: preferredTab.url || null,
    jarvisTabCount: tabs.length,
  });
  await sendContinuousStart(preferredTab.id, reason);
}

chrome.runtime.onInstalled.addListener(() => {
  log("Extension installed");
  createRecoveryAlarm();
  void updateCrawlerStatus({ lifecycle: "installed", installedAt: new Date().toISOString() });
  void ensureCrawlerRunning("installed");
});

chrome.runtime.onStartup.addListener(() => {
  log("Browser startup");
  createRecoveryAlarm();
  void updateCrawlerStatus({ lifecycle: "startup", startupAt: new Date().toISOString() });
  void ensureCrawlerRunning("startup");
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== RECOVERY_ALARM_NAME) return;

  log("Recovery alarm fired");

  try {
    await ensureCrawlerRunning("recovery_alarm");
    await maybeRunScheduledRefresh("recovery_alarm");
  } catch (e) {
    err("Recovery alarm failed:", e);
    await updateCrawlerStatus({ lastError: String(e?.message || e), lastErrorAt: new Date().toISOString() });
  }
});

chrome.tabs.onRemoved.addListener(() => {
  void syncKeepAwakeWithTabs("tab_removed");
});

chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!tab.url || !tab.url.startsWith("https://jarvis-emea.equinix.com/")) return;
  void syncKeepAwakeWithTabs("tab_updated");
  void updateCrawlerStatus({ lastJarvisTabReadyAt: new Date().toISOString(), preferredJarvisUrl: tab.url || null });
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
    void updateCrawlerStatus({
      lastContentReadyAt: new Date().toISOString(),
      lastReadyUrl: msg.url || null,
      activeCrawlerTabId: sender.tab?.id || null,
    });
    void syncKeepAwakeWithTabs("content_ready");
    if (sender.tab?.id) {
      void sendContinuousStart(sender.tab.id, "content_ready");
    }
  }
  if (msg?.type === "OES_TRIGGER_RECEIVED") {
    log("Trigger received by content on:", msg.url);
  }
  if (msg?.type === "OES_LOOP_STATE") {
    log(`Continuous loop state: running=${msg.running} reason=${msg.reason || "n/a"}`);
    void updateCrawlerStatus({
      continuousMode: !!msg.running,
      lastLoopReason: msg.reason || null,
      lastLoopStateAt: new Date().toISOString(),
      activeCrawlerTabId: sender.tab?.id || null,
    });
    if (msg.running) {
      void syncKeepAwakeWithTabs("loop_running");
    } else {
      void syncKeepAwakeWithTabs("loop_stopped");
    }
  }
  if (msg?.type === "OES_SCRAPE_ACTIVITY") {
    void updateCrawlerStatus({
      runActive: !!msg.active,
      lastRunStartedAt: msg.active ? new Date().toISOString() : undefined,
      lastRunFinishedAt: msg.active ? undefined : new Date().toISOString(),
      activeCrawlerTabId: sender.tab?.id || null,
      lastRunReason: msg.reason || null,
    });
  }
  if (msg?.type === "OES_RUN_SUMMARY") {
    void updateCrawlerStatus({
      lastRunOutcome: msg.outcome || "unknown",
      lastRunDurationMs: Number(msg.durationMs) || null,
      lastRunSummaryAt: new Date().toISOString(),
      lastRunMeta: msg.meta || null,
      lastUploadedQueues: Array.isArray(msg.uploadedQueues) ? msg.uploadedQueues : [],
      lastRunReason: msg.reason || null,
    });
  }
  if (msg?.type === "OES_SCRAPE_ERROR") {
    err("Scrape error on:", msg.url, msg.message);
    void updateCrawlerStatus({
      lastError: msg.message || "Unknown scrape error",
      lastErrorAt: new Date().toISOString(),
      lastErrorUrl: msg.url || null,
    });
  }
  if (msg?.type === "OES_SCRAPE_INCOMPLETE") {
    void updateCrawlerStatus({
      lastRunOutcome: "incomplete",
      lastRunMeta: msg.meta || null,
      lastRunSummaryAt: new Date().toISOString(),
      lastError: "No complete queues in run",
      lastErrorAt: new Date().toISOString(),
    });
  }

  // ✅ Upload snapshot (from content.js) -> ODIN ingest server (configurable)
  if (msg?.type === "OES_UPLOAD_SNAPSHOT" && msg.payload) {
    (async () => {
      // Read config from chrome.storage.local.
      // Default base URL: http://localhost:8001 (ODIN backend, local dev)
      // VM production (DIRECT to backend — do NOT use :8080 Nginx proxy):
      //   chrome.storage.local.set({ odin_base_url: "http://fr2lxcops01.corp.equinix.com:8001", odin_ingest_key: "<REAL_KEY>" })
      //   — or use the Options page: chrome://extensions → OES Jarvis → Extension options
      const stored = await chrome.storage.local.get(["odin_base_url", "odin_ingest_key"]);
      const rawBase = (stored?.odin_base_url || "http://fr2lxcops01.corp.equinix.com:8001").replace(/\/$/, "");
      // Trim defensively; options.js trims on save, but direct storage.set calls may not.
      const ingestKey = (stored?.odin_ingest_key || "CHANGE_ME").trim();
      const keyIsReal = !!stored?.odin_ingest_key && ingestKey !== "CHANGE_ME";
      log(`[DEBUG] ingest key: set=${keyIsReal} len=${ingestKey.length}`);

      // Use URL constructor to avoid double-slash / path bugs
      let url;
      try {
        url = new URL("/api/queue/snapshot", rawBase).toString();
      } catch (urlErr) {
        err("Invalid odin_base_url in storage:", rawBase, urlErr);
        sendResponse({ ok: false, error: `Invalid odin_base_url: ${rawBase}` });
        return;
      }

      log(`Sending snapshot to: ${url} (keySet=${keyIsReal} keyLen=${ingestKey.length})`);
      const method = "POST";
      try {
        log(`[DEBUG] Setting header X-OES-INGEST-KEY: len=${ingestKey.length} set=${keyIsReal}`);
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
        await updateCrawlerStatus({
          lastUploadAt: new Date().toISOString(),
          lastUploadStatus: "ok",
          lastUploadUrl: url,
          lastUploadResult: json,
        });
        sendResponse({ ok: true, result: json });
      } catch (e) {
        // Always include context: url, error name, message and stack
        err(`Upload FAILED (background): url=${url} errName=${e?.name} msg=${e?.message}`);
        if (e?.stack) err("Stack:", e.stack);
        await updateCrawlerStatus({
          lastUploadAt: new Date().toISOString(),
          lastUploadStatus: "error",
          lastUploadUrl: url,
          lastError: String(e?.message || e),
          lastErrorAt: new Date().toISOString(),
        });
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();

    return true; // keep message channel open for async sendResponse
  }

  // ✅ Preflight check: verify backend is reachable before scraping
  if (msg?.type === "OES_PREFLIGHT_CHECK") {
    (async () => {
      const stored = await chrome.storage.local.get(["odin_base_url", "odin_ingest_key"]);
      const rawBase = (stored?.odin_base_url || "http://fr2lxcops01.corp.equinix.com:8001").replace(/\/$/, "");
      const ingestKey = (stored?.odin_ingest_key || "CHANGE_ME").trim();

      log("[Preflight] Checking backend reachability...");

      let healthUrl;
      try {
        healthUrl = new URL("/api/queue/snapshot", rawBase).toString();
      } catch (urlErr) {
        err("[Preflight] Invalid odin_base_url:", rawBase, urlErr);
        sendResponse({ ok: false, error: `Invalid odin_base_url: ${rawBase}` });
        return;
      }

      try {
        // Use OPTIONS or a small HEAD-like request to the snapshot endpoint
        // Many APIs don't support HEAD/OPTIONS, so we use a GET to a health-style path first,
        // and fall back to the snapshot endpoint with a minimal probe.
        let probeUrl;
        try {
          probeUrl = new URL("/api/health", rawBase).toString();
        } catch {
          probeUrl = healthUrl;
        }

        log(`[Preflight] Trying health endpoint: ${probeUrl}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let res;
        try {
          res = await fetch(probeUrl, {
            method: "GET",
            headers: { "X-OES-INGEST-KEY": ingestKey },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          // If /api/health doesn't exist, try the snapshot endpoint with OPTIONS
          if (probeUrl !== healthUrl) {
            log(`[Preflight] Health endpoint failed (${fetchErr?.message}), trying snapshot endpoint...`);
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 8000);
            try {
              res = await fetch(healthUrl, {
                method: "OPTIONS",
                headers: { "X-OES-INGEST-KEY": ingestKey },
                signal: controller2.signal
              });
              clearTimeout(timeoutId2);
            } catch (fetchErr2) {
              clearTimeout(timeoutId2);
              throw fetchErr2;
            }
          } else {
            throw fetchErr;
          }
        }

        // Check that the response is not an HTML error page
        const contentType = res.headers.get("content-type") || "";
        const bodyText = await res.text().catch(() => "");

        if (bodyText.includes("<!DOCTYPE") || bodyText.includes("<html")) {
          err(`[Preflight] Backend returned HTML error page (status=${res.status}). Not a valid API response.`);
          sendResponse({ ok: false, error: `Backend returned HTML error page (status=${res.status})` });
          return;
        }

        // Accept 2xx, 3xx, 404 (endpoint exists but no GET), 405 (Method Not Allowed = endpoint exists)
        if (res.status >= 200 && res.status < 500) {
          log(`[Preflight] Backend reachable: status=${res.status} contentType=${contentType}`);
          sendResponse({ ok: true, status: res.status, baseUrl: rawBase });
        } else {
          err(`[Preflight] Backend returned server error: status=${res.status}`);
          sendResponse({ ok: false, error: `Backend server error: status=${res.status}` });
        }
      } catch (e) {
        err(`[Preflight] Backend NOT reachable: ${e?.message || e}`);
        sendResponse({ ok: false, error: `Backend not reachable: ${e?.message || e}` });
      }
    })();

    return true; // keep message channel open for async sendResponse
  }

  // default response (optional)
  // sendResponse({ ok: true });
});

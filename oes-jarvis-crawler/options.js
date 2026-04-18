// ==============================
// OES Jarvis Crawler — options.js
// MV3 Options Page logic
// ==============================

const DEFAULT_BASE_URL = "http://fr2lxcops01.corp.equinix.com:8001";
const DEFAULT_JARVIS_URL = "https://jarvis-emea.equinix.com/";
const DEFAULT_REFRESH_INTERVAL_MINUTES = 5;
const STORAGE_KEY_URL  = "odin_base_url";
const STORAGE_KEY_KEY  = "odin_ingest_key";
const STORAGE_KEY_QUEUES = "odin_enabled_queues";
const STORAGE_KEY_TARGET_URL = "odin_jarvis_target_url";
const STORAGE_KEY_REFRESH_INTERVAL = "odin_refresh_interval_minutes";
const STORAGE_KEY_KEEP_AWAKE = "odin_keep_awake_enabled";
const STORAGE_KEY_STATUS = "odin_crawler_status";

const ALL_QUEUE_IDS = ["smartHands", "troubleTickets", "ccInstalls", "deinstalls"];

const $ = (id) => document.getElementById(id);

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.className = isError ? "err" : "ok";
  if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 3500);
}

function refreshDisplay(url, key, targetUrl, refreshInterval, keepAwakeEnabled) {
  const u = url || DEFAULT_BASE_URL + " (default)";
  const k = key ? `●●●●●●●● (set, ${key.length} chars)` : "(using default — CHANGE_ME)";
  const target = targetUrl || DEFAULT_JARVIS_URL;
  const refreshInfo = Number(refreshInterval) > 0 ? `${Number(refreshInterval)} min` : "disabled";
  $("currentDisplay").textContent = `URL: ${u}   |   Key: ${k}   |   Jarvis: ${target}   |   Refresh: ${refreshInfo}   |   Keep awake: ${keepAwakeEnabled ? "on" : "off"}`;
}

function renderCrawlerStatus(status) {
  const el = $("crawlerStatus");
  if (!el) return;
  if (!status || typeof status !== "object" || Object.keys(status).length === 0) {
    el.textContent = "Noch kein Laufstatus vorhanden.";
    return;
  }

  const lines = [
    `Updated: ${status.updatedAt || "-"}`,
    `Tabs: ${status.jarvisTabCount ?? "-"} | Active tab: ${status.activeCrawlerTabId ?? "-"}`,
    `Continuous: ${status.continuousMode ? "on" : "off"} | Run active: ${status.runActive ? "yes" : "no"}`,
    `Last refresh: ${status.lastRefreshAt || "-"} (${status.lastRefreshReason || "n/a"})`,
    `Last upload: ${status.lastUploadAt || "-"} (${status.lastUploadStatus || "n/a"})`,
    `Last run: ${status.lastRunOutcome || "-"} | Duration: ${status.lastRunDurationMs ? `${Math.round(status.lastRunDurationMs / 1000)}s` : "-"}`,
    `Keep awake: ${status.keepAwakeActive ? "active" : "inactive"} (${status.keepAwakeConfigured === false ? "disabled in settings" : status.keepAwakeReason || "n/a"})`,
    `Last error: ${status.lastError || "-"}`,
  ];

  el.textContent = lines.join("\n");
}

async function loadStoredValues() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEY_URL,
    STORAGE_KEY_KEY,
    STORAGE_KEY_QUEUES,
    STORAGE_KEY_TARGET_URL,
    STORAGE_KEY_REFRESH_INTERVAL,
    STORAGE_KEY_KEEP_AWAKE,
    STORAGE_KEY_STATUS,
  ]);
  const url = stored[STORAGE_KEY_URL] || "";
  const key = stored[STORAGE_KEY_KEY] || "";
  const enabledQueues = stored[STORAGE_KEY_QUEUES] || ALL_QUEUE_IDS;
  const targetUrl = stored[STORAGE_KEY_TARGET_URL] || DEFAULT_JARVIS_URL;
  const refreshInterval = stored[STORAGE_KEY_REFRESH_INTERVAL] ?? DEFAULT_REFRESH_INTERVAL_MINUTES;
  const keepAwakeEnabled = stored[STORAGE_KEY_KEEP_AWAKE] !== false;

  $("baseUrl").value = url;
  $("ingestKey").value = key;
  $("jarvisTargetUrl").value = targetUrl;
  $("refreshInterval").value = String(refreshInterval);
  $("keepAwakeEnabled").checked = keepAwakeEnabled;
  refreshDisplay(url, key, targetUrl, refreshInterval, keepAwakeEnabled);
  renderCrawlerStatus(stored[STORAGE_KEY_STATUS]);

  // Set queue checkboxes
  for (const qid of ALL_QUEUE_IDS) {
    const cb = $("q_" + qid);
    if (cb) cb.checked = enabledQueues.includes(qid);
  }
}

async function save() {
  const rawUrl = $("baseUrl").value.trim().replace(/\/$/, "");
  const key    = $("ingestKey").value.trim();
  const targetUrl = $("jarvisTargetUrl").value.trim() || DEFAULT_JARVIS_URL;
  const refreshInterval = Number($("refreshInterval").value || DEFAULT_REFRESH_INTERVAL_MINUTES);
  const keepAwakeEnabled = $("keepAwakeEnabled").checked;

  if (rawUrl) {
    try {
      new URL(rawUrl); // validate
    } catch {
      setStatus("❌ Invalid URL — must start with http:// or https://", true);
      return;
    }
  }

  try {
    new URL(targetUrl);
  } catch {
    setStatus("❌ Invalid Jarvis URL — must start with http:// or https://", true);
    return;
  }

  if (!Number.isFinite(refreshInterval) || refreshInterval < 0) {
    setStatus("❌ Refresh interval must be 0 or greater.", true);
    return;
  }

  // Collect enabled queues from checkboxes
  const enabledQueues = ALL_QUEUE_IDS.filter((qid) => {
    const cb = $("q_" + qid);
    return cb && cb.checked;
  });

  // Validate: warn if unknown queue IDs somehow sneak in (defensive)
  const unknown = enabledQueues.filter((q) => !ALL_QUEUE_IDS.includes(q));
  if (unknown.length > 0) {
    setStatus(`❌ Unknown queue(s): ${unknown.join(", ")}`, true);
    return;
  }

  if (enabledQueues.length === 0) {
    setStatus("⚠ No queues selected — crawler will not scrape anything.", true);
  }

  const toSave = {};
  if (rawUrl) {
    toSave[STORAGE_KEY_URL] = rawUrl;
  } else {
    // blank → remove key so default kicks in
    await chrome.storage.local.remove(STORAGE_KEY_URL);
  }
  if (key) {
    toSave[STORAGE_KEY_KEY] = key;
  } else {
    await chrome.storage.local.remove(STORAGE_KEY_KEY);
  }

  // Always save queue selection
  toSave[STORAGE_KEY_QUEUES] = enabledQueues;
  toSave[STORAGE_KEY_TARGET_URL] = targetUrl;
  toSave[STORAGE_KEY_REFRESH_INTERVAL] = refreshInterval;
  toSave[STORAGE_KEY_KEEP_AWAKE] = keepAwakeEnabled;

  if (Object.keys(toSave).length > 0) {
    await chrome.storage.local.set(toSave);
  }

  refreshDisplay(rawUrl, key, targetUrl, refreshInterval, keepAwakeEnabled);
  const queueInfo = enabledQueues.length === ALL_QUEUE_IDS.length
    ? "all queues"
    : enabledQueues.join(", ") || "none";
  setStatus(`✅ Saved! Active queues: ${queueInfo}; refresh=${refreshInterval === 0 ? "off" : `${refreshInterval} min`}`);
}

async function resetDefaults() {
  await chrome.storage.local.remove([
    STORAGE_KEY_URL,
    STORAGE_KEY_KEY,
    STORAGE_KEY_QUEUES,
    STORAGE_KEY_TARGET_URL,
    STORAGE_KEY_REFRESH_INTERVAL,
    STORAGE_KEY_KEEP_AWAKE,
  ]);
  $("baseUrl").value = "";
  $("ingestKey").value = "";
  $("jarvisTargetUrl").value = DEFAULT_JARVIS_URL;
  $("refreshInterval").value = String(DEFAULT_REFRESH_INTERVAL_MINUTES);
  $("keepAwakeEnabled").checked = true;
  for (const qid of ALL_QUEUE_IDS) {
    const cb = $("q_" + qid);
    if (cb) cb.checked = true;
  }
  refreshDisplay("", "", DEFAULT_JARVIS_URL, DEFAULT_REFRESH_INTERVAL_MINUTES, true);
  setStatus("↩ Reset to defaults (backend default / all queues / refresh 5 min / keep awake on)");
}

// Quick preset buttons
document.querySelectorAll(".quick-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("baseUrl").value = btn.dataset.url;
  });
});

$("saveBtn").addEventListener("click", save);
$("resetBtn").addEventListener("click", resetDefaults);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[STORAGE_KEY_STATUS]) {
    renderCrawlerStatus(changes[STORAGE_KEY_STATUS].newValue);
  }
});

// Load on page open
loadStoredValues();

// ==============================
// OES Jarvis Crawler — options.js
// MV3 Options Page logic
// ==============================

const DEFAULT_BASE_URL = "http://fr2lxcops01.corp.equinix.com:8001";
const STORAGE_KEY_URL  = "odin_base_url";
const STORAGE_KEY_KEY  = "odin_ingest_key";
const STORAGE_KEY_QUEUES = "odin_enabled_queues";

const ALL_QUEUE_IDS = ["smartHands", "troubleTickets", "ccInstalls", "deinstalls"];

const $ = (id) => document.getElementById(id);

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.className = isError ? "err" : "ok";
  if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 3500);
}

function refreshDisplay(url, key) {
  const u = url || DEFAULT_BASE_URL + " (default)";
  const k = key ? `●●●●●●●● (set, ${key.length} chars)` : "(using default — CHANGE_ME)";
  $("currentDisplay").textContent = `URL: ${u}   |   Key: ${k}`;
}

async function loadStoredValues() {
  const stored = await chrome.storage.local.get([STORAGE_KEY_URL, STORAGE_KEY_KEY, STORAGE_KEY_QUEUES]);
  const url = stored[STORAGE_KEY_URL] || "";
  const key = stored[STORAGE_KEY_KEY] || "";
  const enabledQueues = stored[STORAGE_KEY_QUEUES] || ALL_QUEUE_IDS;

  $("baseUrl").value = url;
  $("ingestKey").value = key;
  refreshDisplay(url, key);

  // Set queue checkboxes
  for (const qid of ALL_QUEUE_IDS) {
    const cb = $("q_" + qid);
    if (cb) cb.checked = enabledQueues.includes(qid);
  }
}

async function save() {
  const rawUrl = $("baseUrl").value.trim().replace(/\/$/, "");
  const key    = $("ingestKey").value.trim();

  if (rawUrl) {
    try {
      new URL(rawUrl); // validate
    } catch {
      setStatus("❌ Invalid URL — must start with http:// or https://", true);
      return;
    }
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

  if (Object.keys(toSave).length > 0) {
    await chrome.storage.local.set(toSave);
  }

  refreshDisplay(rawUrl, key);
  const queueInfo = enabledQueues.length === ALL_QUEUE_IDS.length
    ? "all queues"
    : enabledQueues.join(", ") || "none";
  setStatus(`✅ Saved! Active queues: ${queueInfo}`);
}

async function resetDefaults() {
  await chrome.storage.local.remove([STORAGE_KEY_URL, STORAGE_KEY_KEY, STORAGE_KEY_QUEUES]);
  $("baseUrl").value = "";
  $("ingestKey").value = "";
  for (const qid of ALL_QUEUE_IDS) {
    const cb = $("q_" + qid);
    if (cb) cb.checked = true;
  }
  refreshDisplay("", "");
  setStatus("↩ Reset to defaults (localhost:8001 / CHANGE_ME / all queues)");
}

// Quick preset buttons
document.querySelectorAll(".quick-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("baseUrl").value = btn.dataset.url;
  });
});

$("saveBtn").addEventListener("click", save);
$("resetBtn").addEventListener("click", resetDefaults);

// Load on page open
loadStoredValues();

// ==============================
// OES Jarvis Crawler — options.js
// MV3 Options Page logic
// ==============================

const DEFAULT_BASE_URL = "http://fr2lxcops01.corp.equinix.com:8001";
const STORAGE_KEY_URL  = "odin_base_url";
const STORAGE_KEY_KEY  = "odin_ingest_key";

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
  const stored = await chrome.storage.local.get([STORAGE_KEY_URL, STORAGE_KEY_KEY]);
  const url = stored[STORAGE_KEY_URL] || "";
  const key = stored[STORAGE_KEY_KEY] || "";

  $("baseUrl").value = url;
  $("ingestKey").value = key;
  refreshDisplay(url, key);
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

  if (Object.keys(toSave).length > 0) {
    await chrome.storage.local.set(toSave);
  }

  refreshDisplay(rawUrl, key);
  setStatus("✅ Saved!");
}

async function resetDefaults() {
  await chrome.storage.local.remove([STORAGE_KEY_URL, STORAGE_KEY_KEY]);
  $("baseUrl").value = "";
  $("ingestKey").value = "";
  refreshDisplay("", "");
  setStatus("↩ Reset to defaults (localhost:8001 / CHANGE_ME)");
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

// ==============================
// OES Jarvis Crawler - content.js
// - Scrape ALL 3 queues
// - Upload via background (avoids Failed to fetch)
// - Waits for ag-grid to be ready (fix ag-grid root not found)
// - Auto-detect Trouble Tickets key column by header text (fix TT=0)
// ==============================

const OES_DEBUG = true;
let OES_IS_RUNNING = false;
let OES_CONTINUOUS_MODE = false;
let OES_NEXT_RUN_TIMER = null;
let OES_SESSION_SUCCESS_COUNT = 0;

// Canonical queue identifiers (must match options.js ALL_QUEUE_IDS)
const ALL_QUEUE_IDS = ["smartHands", "troubleTickets", "ccInstalls", "deinstalls"];
const CONTINUOUS_LOOP_DELAY_MS = 5000;
const POPUP_SCAN_INTERVAL_MS = 2000;

let OES_POPUP_CLEANER_TIMER = null;
let OES_POPUP_DISMISS_ACTIVE = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Load enabled queues from chrome.storage.local.
 * Returns array of canonical queue IDs. Defaults to all queues if unset.
 */
async function getEnabledQueues() {
  try {
    const stored = await chrome.storage.local.get(["odin_enabled_queues"]);
    const raw = stored?.odin_enabled_queues;
    if (!Array.isArray(raw) || raw.length === 0) {
      log("[Config] No queue selection stored — defaulting to ALL queues.");
      return [...ALL_QUEUE_IDS];
    }
    // Validate: only keep known queue IDs
    const valid = raw.filter((q) => ALL_QUEUE_IDS.includes(q));
    const unknown = raw.filter((q) => !ALL_QUEUE_IDS.includes(q));
    if (unknown.length > 0) {
      warn(`[Config] Unknown queue IDs in config (ignored): ${JSON.stringify(unknown)}`);
    }
    if (valid.length === 0) {
      warn("[Config] All configured queue IDs are unknown — defaulting to ALL queues.");
      return [...ALL_QUEUE_IDS];
    }
    return valid;
  } catch (e) {
    warn("[Config] Failed to read enabled queues:", e?.message || e);
    return [...ALL_QUEUE_IDS];
  }
}

/**
 * Backend preflight check via background.js.
 * Verifies the ODIN backend is reachable before starting expensive scraping.
 */
function preflightBackendCheck() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "OES_PREFLIGHT_CHECK" }, (resp) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!resp?.ok) {
        return reject(new Error(resp?.error || "Backend preflight failed"));
      }
      resolve(resp);
    });
  });
}

function log(...args) {
  if (OES_DEBUG) console.log("[ODIN Crawler]", ...args);
}
function warn(...args) {
  console.warn("[ODIN Crawler]", ...args);
}
function err(...args) {
  console.error("[ODIN Crawler]", ...args);
}

console.log("[ODIN Crawler] content.js LOADED on", location.href);
try {
  chrome.runtime.sendMessage({ type: "OES_CONTENT_READY", url: location.href });
} catch (_) { }

function isJarvisHost() {
  return location.hostname === "jarvis-emea.equinix.com";
}

/**
 * Upload via background service worker (robust in corporate environments).
 * background.js handles actual fetch to localhost.
 */
function uploadSnapshotViaBackground(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "OES_UPLOAD_SNAPSHOT", payload }, (resp) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!resp?.ok) {
        return reject(new Error(resp?.error || "Upload failed"));
      }
      resolve(resp.result);
    });
  });
}

function notifyLoopState(running, reason) {
  try {
    chrome.runtime.sendMessage({
      type: "OES_LOOP_STATE",
      running,
      reason,
      url: location.href,
    });
  } catch (_) { }
}

function notifyScrapeActivity(active, reason) {
  try {
    chrome.runtime.sendMessage({
      type: "OES_SCRAPE_ACTIVITY",
      active,
      reason,
      url: location.href,
    });
  } catch (_) { }
}

function notifyRunSummary(outcome, meta, durationMs, uploadedQueues, reason) {
  try {
    chrome.runtime.sendMessage({
      type: "OES_RUN_SUMMARY",
      outcome,
      meta,
      durationMs,
      uploadedQueues,
      reason,
      url: location.href,
    });
  } catch (_) { }
}

function clearNextRunTimer() {
  if (OES_NEXT_RUN_TIMER) {
    clearTimeout(OES_NEXT_RUN_TIMER);
    OES_NEXT_RUN_TIMER = null;
  }
}

function scheduleNextContinuousRun(reason) {
  clearNextRunTimer();
  if (!OES_CONTINUOUS_MODE) return;

  log(`[Loop] Scheduling next continuous run in ${CONTINUOUS_LOOP_DELAY_MS}ms (${reason})`);
  OES_NEXT_RUN_TIMER = setTimeout(() => {
    OES_NEXT_RUN_TIMER = null;
    void runContinuousCycle(`scheduled:${reason}`);
  }, CONTINUOUS_LOOP_DELAY_MS);
}

async function runContinuousCycle(reason) {
  if (!OES_CONTINUOUS_MODE) return;
  if (OES_IS_RUNNING) {
    warn(`[Loop] Run already active. Skipping duplicate trigger (${reason})`);
    return;
  }

  try {
    await scrapeAllQueuesAndUpload();
  } catch (e) {
    err("OES scrape/upload failed:", e);
    try {
      chrome.runtime.sendMessage({
        type: "OES_SCRAPE_ERROR",
        message: String(e?.message || e),
        url: location.href
      });
    } catch (_) { }

    // Jarvis UI sometimes loses card counts mid-session after crawler clicks.
    // Only reload if we had at least one successful scrape (avoids reload loop on initial page load).
    if (String(e?.message || "").includes("Could not read expected count from Jarvis UI") && OES_SESSION_SUCCESS_COUNT > 0) {
      warn(`[Loop] Jarvis UI returned null counts after ${OES_SESSION_SUCCESS_COUNT} successful run(s) — reloading page to recover.`);
      location.reload();
      return; // reload will restart the continuous loop via the init path
    }
  } finally {
    if (OES_CONTINUOUS_MODE) {
      scheduleNextContinuousRun(reason);
    }
  }
}

function startContinuousMode(reason = "manual") {
  if (!isJarvisHost()) {
    warn("Not a Jarvis host. Continuous mode not started.");
    return;
  }

  startPopupJanitor();

  if (!OES_CONTINUOUS_MODE) {
    OES_CONTINUOUS_MODE = true;
    notifyLoopState(true, reason);
    log(`[Loop] Continuous mode enabled (${reason})`);
  }

  clearNextRunTimer();
  void dismissObstructivePopups(`continuous_start:${reason}`, { maxPasses: 1 });
  void runContinuousCycle(reason);
}

function stopContinuousMode(reason = "stopped") {
  if (!OES_CONTINUOUS_MODE) return;
  OES_CONTINUOUS_MODE = false;
  clearNextRunTimer();
  notifyLoopState(false, reason);
  log(`[Loop] Continuous mode disabled (${reason})`);
}

function getElementLabel(element) {
  if (!element) return "";

  return [
    element.getAttribute("aria-label") || "",
    element.getAttribute("title") || "",
    element.innerText || "",
    element.textContent || "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getElementClassName(element) {
  if (!element) return "";

  const className = typeof element.className === "string"
    ? element.className
    : element.getAttribute("class") || "";

  return String(className).toLowerCase();
}

function isElementVisible(element) {
  if (!(element instanceof Element)) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  return element.getClientRects().length > 0;
}

function getElementZIndex(element) {
  const raw = window.getComputedStyle(element).zIndex || "";
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : 0;
}

function isLikelyBlockingPopup(element) {
  if (!isElementVisible(element)) return false;

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const containsViewportCenter =
    rect.left <= centerX &&
    rect.right >= centerX &&
    rect.top <= centerY &&
    rect.bottom >= centerY;
  const dialogSemantics =
    element.getAttribute("role") === "dialog" ||
    element.getAttribute("aria-modal") === "true";
  const overlayLike =
    ["fixed", "absolute", "sticky"].includes(style.position) ||
    getElementZIndex(element) >= 50;
  const largeEnough =
    rect.width >= Math.min(window.innerWidth * 0.25, 320) ||
    rect.height >= Math.min(window.innerHeight * 0.18, 180);

  return containsViewportCenter && (dialogSemantics || (overlayLike && largeEnough)) && style.pointerEvents !== "none";
}

function getBlockingPopupRoots() {
  const selectors = [
    "[role='dialog']",
    "[aria-modal='true']",
    ".modal",
    ".modal-dialog",
    ".popup",
    ".popup-window",
    ".mx-dialog",
    ".mx-window",
    ".mendix-dialog",
    "[class*='modal']",
    "[class*='popup']",
    "[class*='dialog']",
  ];

  const roots = [];
  for (const element of document.querySelectorAll(selectors.join(","))) {
    if (!isLikelyBlockingPopup(element)) continue;
    if (roots.some((root) => root.contains(element))) continue;

    for (let index = roots.length - 1; index >= 0; index--) {
      if (element.contains(roots[index])) {
        roots.splice(index, 1);
      }
    }

    roots.push(element);
  }

  return roots.sort((left, right) => {
    const zIndexDelta = getElementZIndex(right) - getElementZIndex(left);
    if (zIndexDelta !== 0) return zIndexDelta;

    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
  });
}

function scorePopupCloseControl(element) {
  const label = getElementLabel(element);
  const className = getElementClassName(element);
  const rect = element.getBoundingClientRect();
  let score = 0;

  if (/close|schlie/.test(label)) score += 6;
  if (/dismiss|cancel|abbrechen/.test(label)) score += 4;
  if (label === "x" || label === "×") score += 5;
  if (/btn-close|dialog-close|modal-close|close-icon/.test(className)) score += 3;
  if (rect.top < window.innerHeight * 0.45 && rect.left > window.innerWidth * 0.5) score += 1;

  return score;
}

function getPopupCloseControls(root) {
  const controls = Array.from(
    root.querySelectorAll("button, [role='button'], [aria-label], [title], .close, .btn-close")
  );

  return controls
    .filter((element) => {
      if (!isElementVisible(element)) return false;

      const label = getElementLabel(element);
      const className = getElementClassName(element);
      return (
        label === "x" ||
        label === "×" ||
        /close|dismiss|cancel|schlie|abbrechen/.test(label) ||
        /close|dismiss|cancel|btn-close|dialog-close|modal-close/.test(className)
      );
    })
    .sort((left, right) => scorePopupCloseControl(right) - scorePopupCloseControl(left));
}

function getSafeAcknowledgeControl(root) {
  const buttons = Array.from(root.querySelectorAll("button, [role='button']")).filter(isElementVisible);
  if (buttons.length !== 1) return null;

  const label = getElementLabel(buttons[0]);
  if (/^(ok|okay|alles klar|got it)$/.test(label)) {
    return buttons[0];
  }

  return null;
}

function dispatchEscapeKey() {
  const eventOptions = { key: "Escape", bubbles: true, cancelable: true };
  const activeTarget = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;

  activeTarget.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
  activeTarget.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
  document.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
  document.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
}

async function dismissPopupRoot(root, reason) {
  const controls = getPopupCloseControls(root);
  const safeAcknowledge = controls.length === 0 ? getSafeAcknowledgeControl(root) : null;
  const candidates = safeAcknowledge ? [safeAcknowledge] : controls;

  for (const control of candidates) {
    const label = getElementLabel(control).slice(0, 80) || control.tagName;
    log(`[Popup] Closing popup via "${label}" (${reason})`);
    control.click();
    await sleep(180);
    if (!root.isConnected || !isLikelyBlockingPopup(root)) {
      return true;
    }
  }

  dispatchEscapeKey();
  await sleep(180);
  return !root.isConnected || !isLikelyBlockingPopup(root);
}

async function dismissObstructivePopups(reason = "unknown", options = {}) {
  const maxPasses = Math.max(1, Number(options.maxPasses) || 1);
  if (OES_POPUP_DISMISS_ACTIVE) return 0;

  OES_POPUP_DISMISS_ACTIVE = true;
  try {
    let totalDismissed = 0;

    for (let pass = 0; pass < maxPasses; pass++) {
      const roots = getBlockingPopupRoots();
      if (roots.length === 0) break;

      let dismissedThisPass = 0;
      for (const root of roots) {
        if (await dismissPopupRoot(root, reason)) {
          dismissedThisPass++;
          totalDismissed++;
        }
      }

      if (dismissedThisPass === 0) break;
    }

    if (totalDismissed > 0) {
      log(`[Popup] Dismissed ${totalDismissed} popup(s) (${reason})`);
    }

    return totalDismissed;
  } catch (e) {
    warn(`[Popup] Failed to dismiss popup(s) during ${reason}:`, e?.message || e);
    return 0;
  } finally {
    OES_POPUP_DISMISS_ACTIVE = false;
  }
}

function startPopupJanitor() {
  if (!isJarvisHost() || OES_POPUP_CLEANER_TIMER) return;

  OES_POPUP_CLEANER_TIMER = setInterval(() => {
    void dismissObstructivePopups("popup_janitor", { maxPasses: 1 });
  }, POPUP_SCAN_INTERVAL_MS);
}

function stopPopupJanitor() {
  if (!OES_POPUP_CLEANER_TIMER) return;

  clearInterval(OES_POPUP_CLEANER_TIMER);
  OES_POPUP_CLEANER_TIMER = null;
}

/**
 * Robust cell extraction for Mendix/ag-Grid
 * Dates can be in attributes instead of innerText.
 */
function getCellValue(cell) {
  if (!cell) return "";

  const inp = cell.querySelector('input, textarea, select');
  if (inp) {
    const val = (inp.value || inp.getAttribute('value') || '').trim();
    if (val) return val;
  }

  let v = (cell.innerText || "").trim();
  if (v) return v;

  const valueEl =
    cell.querySelector(".ag-cell-value") ||
    cell.querySelector("[data-value]") ||
    cell.querySelector("span, a, div");

  if (valueEl) {
    v = (valueEl.innerText || valueEl.textContent || "").trim();
    if (v) return v;

    const t = (valueEl.getAttribute("title") || "").trim();
    if (t) return t;

    const a = (valueEl.getAttribute("aria-label") || "").trim();
    if (a) return a;

    const dv = (valueEl.getAttribute("data-value") || "").trim();
    if (dv) return dv;
  }

  const title = (cell.getAttribute("title") || "").trim();
  if (title) return title;

  const aria = (cell.getAttribute("aria-label") || "").trim();
  if (aria) return aria;

  const dataValue = (cell.getAttribute("data-value") || "").trim();
  if (dataValue) return dataValue;

  v = (cell.textContent || "").trim();
  return v || "";
}

/**
 * Wait until ag-grid root is present after switching queues.
 * Fixes: "ag-grid root not found (no .ag-root / .ag-root-wrapper)"
 */
async function waitForAgGridRoot(timeoutMs = 30000) {
  const start = Date.now();
  let lastPopupSweepAt = 0;

  while (Date.now() - start < timeoutMs) {
    if (Date.now() - lastPopupSweepAt >= 1000) {
      lastPopupSweepAt = Date.now();
      await dismissObstructivePopups("wait_for_ag_grid", { maxPasses: 1 });
    }

    const root = document.querySelector(".ag-root") || document.querySelector(".ag-root-wrapper");
    if (root) {
      // Additionally wait for loading overlays to disappear
      const loadingOverlay = root.querySelector(".ag-overlay-loading-wrapper, .ag-loading");
      if (!loadingOverlay || loadingOverlay.offsetParent === null) {
        return root;
      }
      log("[Wait] ag-grid root found but loading overlay still visible, waiting...");
    }
    await sleep(300);
  }
  throw new Error(`ag-grid root not found after ${timeoutMs}ms`);
}

async function getAgGridRootAsync() {
  return await waitForAgGridRoot(30000);
}

/**
 * Wait until rows are actually rendered in the grid (not just the grid root).
 * Prevents reading empty grids after navigation.
 */
async function waitForRowsRendered(timeoutMs = 15000) {
  const start = Date.now();
  let lastPopupSweepAt = 0;

  while (Date.now() - start < timeoutMs) {
    if (Date.now() - lastPopupSweepAt >= 1000) {
      lastPopupSweepAt = Date.now();
      await dismissObstructivePopups("wait_for_rows", { maxPasses: 1 });
    }

    const rows = document.querySelectorAll(".ag-center-cols-container .ag-row");
    if (rows.length > 0) {
      log(`[Wait] ${rows.length} rows rendered after ${Date.now() - start}ms`);
      return rows.length;
    }
    await sleep(300);
  }
  warn(`[Wait] No rows rendered after ${timeoutMs}ms`);
  return 0;
}

/**
 * Wait until the DOM is stable (no rapid changes in row count).
 * More robust than a fixed sleep.
 */
async function waitForDomStable(checkIntervalMs = 200, requiredStableChecks = 4, timeoutMs = 12000) {
  const start = Date.now();
  let lastCount = -1;
  let stableHits = 0;
  let lastPopupSweepAt = 0;

  while (Date.now() - start < timeoutMs) {
    if (Date.now() - lastPopupSweepAt >= 1000) {
      lastPopupSweepAt = Date.now();
      await dismissObstructivePopups("wait_for_dom_stable", { maxPasses: 1 });
    }

    const rows = document.querySelectorAll(".ag-center-cols-container .ag-row");
    const count = rows.length;
    if (count === lastCount && count >= 0) {
      stableHits++;
    } else {
      stableHits = 0;
    }
    lastCount = count;
    if (stableHits >= requiredStableChecks) {
      log(`[Wait] DOM stable (${count} rows, ${stableHits} checks) after ${Date.now() - start}ms`);
      return;
    }
    await sleep(checkIntervalMs);
  }
  warn(`[Wait] DOM stability timeout after ${timeoutMs}ms (last count: ${lastCount})`);
}

function getGridViewport(root) {
  const viewport = root.querySelector(".ag-body-viewport");
  if (!viewport) throw new Error("ag-body-viewport not found");
  return viewport;
}

function getHorizontalViewport(root) {
  // ag-grid horizontal scroll viewport (exists when there are more columns than fit)
  return (
    root.querySelector(".ag-body-horizontal-scroll-viewport") ||
    root.querySelector(".ag-horizontal-left-spacer")?.parentElement ||
    root.querySelector(".ag-center-cols-viewport") ||
    null
  );
}

function tryGetAgGridApi(root) {
  // Best-effort: some builds expose an internal instance with api/columnApi on DOM nodes.
  // We intentionally keep this heuristic light (no global scanning).
  for (const k of Object.keys(root)) {
    const v = root[k];
    if (!v || typeof v !== "object") continue;
    const api = v.api || v.gridApi || v;
    if (api && typeof api.forEachNode === "function") return { api, columnApi: v.columnApi || api.columnApi };
  }
  return null;
}

function readHeaderMap(root) {
  const headers = Array.from(root.querySelectorAll(".ag-header-cell[col-id]"));
  const map = {};
  for (const h of headers) {
    const colId = (h.getAttribute("col-id") || "").trim();
    const textEl = h.querySelector(".ag-header-cell-text");
    const label = ((textEl?.innerText || "") + "").trim() || colId;
    if (colId) map[colId] = label;
  }
  return map;
}

/**
 * Auto detect a key col-id by matching header label text (case-insensitive).
 * Example: find the col-id whose header label includes "Ticket ID".
 */
async function detectKeyColIdByHeaderText(preferredColId, headerTextIncludes) {
  const root = await getAgGridRootAsync();
  const headerMap = readHeaderMap(root); // col-id -> label

  if (headerMap[preferredColId]) return preferredColId;

  const needle = (headerTextIncludes || "").toLowerCase();
  const hit = Object.entries(headerMap).find(([, label]) =>
    (label || "").toLowerCase().includes(needle)
  );

  return hit ? hit[0] : preferredColId;
}

function getRowKey(rowEl) {
  // ag-grid commonly uses one of these markers to identify rows.
  return (
    rowEl.getAttribute("row-index") ||
    rowEl.getAttribute("aria-rowindex") ||
    rowEl.getAttribute("data-row-index") ||
    ""
  );
}

function readRowCells(rowEl) {
  const cells = Array.from(rowEl.querySelectorAll("[col-id]")).filter(el => el.classList && el.classList.contains('ag-cell'));
  // Fallback: some Jarvis builds omit role=gridcell; ag-cell is stable.
  const obj = {};
  for (const cell of cells) {
    const colId = (cell.getAttribute("col-id") || "").trim();
    if (!colId) continue;
    obj[colId] = getCellValue(cell);
  }
  return obj;
}

function readVisibleRows(root) {
  // Jarvis/ag-grid can place important columns (e.g., Commit Date) in pinned left/right containers.
  // Reading only center-cols will miss those fields.
  const centerRows = Array.from(root.querySelectorAll(".ag-center-cols-container .ag-row"));
  const leftRows = Array.from(root.querySelectorAll(".ag-pinned-left-cols-container .ag-row"));
  const rightRows = Array.from(root.querySelectorAll(".ag-pinned-right-cols-container .ag-row"));

  const byRow = new Map();

  const addRows = (rows) => {
    for (const row of rows) {
      const k = getRowKey(row);
      // Skip group/header rows with no cells.
      const data = readRowCells(row);
      if (Object.keys(data).length === 0) continue;
      const existing = byRow.get(k) || {};
      byRow.set(k, { ...existing, ...data });
    }
  };

  addRows(centerRows);
  addRows(leftRows);
  addRows(rightRows);

  return Array.from(byRow.values());
}

/**
 * Scroll grid to collect all rows (virtual list).
 * Dedup via keyColId.
 */
async function collectAllRowsByScrolling({ keyColId }) {
  const root = await getAgGridRootAsync();
  const viewport = getGridViewport(root);
  const hViewport = getHorizontalViewport(root);

  const headerMap = readHeaderMap(root);
  const byKey = new Map();

  // Fast path: if we can access ag-grid API, we can extract ALL row data without scrolling.
  const apiBundle = tryGetAgGridApi(root);
  if (apiBundle?.api) {
    try {
      const rows = [];
      apiBundle.api.forEachNode((node) => {
        if (node?.data) rows.push(node.data);
      });
      // Convert node.data object keys to strings (ag-grid uses colIds).
      const cleaned = rows.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) out[String(k)] = v == null ? "" : String(v);
        return out;
      });

      // If data already contains the key, return.
      const hasKey = cleaned.some((r) => (r[keyColId] || "").trim());
      if (hasKey) {
        log(`Collected rows via ag-grid api for key "${keyColId}":`, cleaned.length);
        return { headerMap, rows: cleaned };
      }
    } catch (e) {
      warn("ag-grid api extraction failed, falling back to scrolling.", e?.message || e);
    }
  }

  // Wait for initial data to settle (Mendix loads asynchronously)
  // and reset scroll positions.
  viewport.scrollTop = 0;
  if (hViewport) hViewport.scrollLeft = 0;

  // Try to detect total rows (when aria-rowcount is present), to stop early.
  const gridEl = root.querySelector("[role='grid']");
  const ariaRowCount = gridEl ? parseInt(gridEl.getAttribute("aria-rowcount") || "", 10) : NaN;
  const totalRowsHint = Number.isFinite(ariaRowCount) && ariaRowCount > 0 ? ariaRowCount : null;

  // Wait until the visible rows stabilize (reduces partial snapshots).
  const waitStable = async () => {
    let last = -1;
    let stable = 0;
    for (let t = 0; t < 50; t++) {
      const n = root.querySelectorAll(".ag-center-cols-container .ag-row").length;
      if (n === last && n > 0) stable++;
      else stable = 0;
      last = n;
      if (stable >= 5) return;
      await sleep(200);
    }
    warn("[Scroll] Row count did not stabilize within timeout.");
  };

  await waitStable();

  let lastScrollTop = -1;
  let sameScrollCount = 0;
  let noNewCount = 0;
  const MAX_SCROLL_ITERATIONS = 2000;
  const scrollStartTime = Date.now();
  const MAX_SCROLL_TIME_MS = 120000; // 2 minutes hard timeout

  // Larger step size + earlier stopping conditions = faster.
  for (let i = 0; i < MAX_SCROLL_ITERATIONS; i++) {
    // Hard time-based timeout
    if (Date.now() - scrollStartTime > MAX_SCROLL_TIME_MS) {
      warn(`[Scroll] Hard timeout reached (${MAX_SCROLL_TIME_MS}ms). Collected ${byKey.size} rows so far.`);
      break;
    }

    if (i % 10 === 0) {
      await dismissObstructivePopups(`scroll_collect:${keyColId}`, { maxPasses: 1 });
    }

    // 2-pass horizontal scroll: left=0 captures key column, left=max captures Owner/Sched. Start
    if (hViewport) hViewport.scrollLeft = 0;
    await sleep(50);
    const left = readVisibleRows(root);

    let right = [];
    if (hViewport && hViewport.scrollWidth > hViewport.clientWidth) {
      hViewport.scrollLeft = hViewport.scrollWidth;
      await sleep(80);
      right = readVisibleRows(root);
      // Reset scroll to left so key column stays in DOM for next vertical step
      hViewport.scrollLeft = 0;
      await sleep(30);
    }

    const merged = left.concat(right);
    let addedThisLoop = 0;

    for (const row of merged) {
      const key = (row[keyColId] || "").trim();
      if (!key) continue;

      const existing = byKey.get(key) || {};
      byKey.set(key, { ...existing, ...row });

      if (!existing.__seen) {
        addedThisLoop++;
        byKey.get(key).__seen = true;
      }
    }

    if (addedThisLoop === 0) noNewCount++;
    else noNewCount = 0;

    // Progress logging every 50 iterations
    if (i > 0 && i % 50 === 0) {
      log(`[Scroll] Progress: iteration=${i}, collected=${byKey.size}, noNewStreak=${noNewCount}`);
    }

    // Early stop if we already captured everything (when aria-rowcount is available).
    // aria-rowcount includes header + rows in some ag-grid setups; we tolerate +/- 2.
    if (totalRowsHint && byKey.size >= Math.max(0, totalRowsHint - 2)) break;

    lastScrollTop = viewport.scrollTop;
    viewport.scrollTop = viewport.scrollTop + viewport.clientHeight * 1.25;
    await sleep(80);

    if (viewport.scrollTop === lastScrollTop) sameScrollCount++;
    else sameScrollCount = 0;

    // Stop quickly if we are not discovering new keys anymore.
    if (noNewCount >= 10) {
      log(`[Scroll] Stopping: ${noNewCount} iterations without new rows.`);
      break;
    }
    if (sameScrollCount >= 5) {
      log(`[Scroll] Stopping: scroll position stuck for ${sameScrollCount} iterations.`);
      break;
    }
  }

  // Remove helper marker
  const all = Array.from(byKey.values()).map((r) => {
    const { __seen, ...rest } = r;
    return rest;
  });

  log(`Collected rows for key "${keyColId}":`, all.length);
  return { headerMap, rows: all };
}

function normalizeRows(headerMap, rows) {
  return rows.map((r) => {
    const out = {};
    for (const [colId, value] of Object.entries(r)) {
      let label = headerMap[colId] || colId;

      // Canonicalize a few critical column labels to keep backend mapping stable.
      // Jarvis sometimes varies punctuation/casing.
      const low = String(label).toLowerCase();
      // Commit Date is often localized (e.g., "Commit-Datum").
      if (low.includes("commit")) {
        label = "Commit Date";
      }
      // Activity Sub Type is sometimes shortened/localized.
      if (
        low.includes("sub") && low.includes("type") && low.includes("activity")
      ) {
        label = "Activity Sub Type";
      }
      // Some UIs show only "Sub Type".
      if (low === "sub type" || low === "subtype" || low === "sub-typ" || low === "subtyp") {
        label = "Activity Sub Type";
      }
      // Owner is sometimes localized (e.g., "Besitzer").
      if (low.includes("owner") || low.includes("besitzer") || low.includes("verantwortlich")) {
        label = "Owner";
      }
      if (/^sched\.?\s*start$/.test(low) || (low.includes("sched") && low.includes("start"))) {
        label = "Sched. Start";
      }

      out[label] = value;
    }
    return out;
  });
}

/**
 * Try primary key col-id, then fallbacks.
 * If ag-grid not ready, waiting happens inside collectAllRowsByScrolling.
 */
async function collectWithFallbackKeys(primaryKey, fallbackKeys = []) {
  try {
    return await collectAllRowsByScrolling({ keyColId: primaryKey });
  } catch (e) {
    warn(`Collect failed for key "${primaryKey}".`, e?.message || e);
  }
  for (const k of fallbackKeys) {
    try {
      warn(`Fallback key "${k}"...`);
      return await collectAllRowsByScrolling({ keyColId: k });
    } catch (e) {
      warn(`Fallback key "${k}" failed.`, e?.message || e);
    }
  }

  // last fallback: return empty but with headerMap if possible
  const root = await getAgGridRootAsync();
  const headerMap = readHeaderMap(root);
  return { headerMap, rows: [] };
}

/**
 * Click queue card by title and wait a bit + ensure grid is ready.
 */
async function openQueueByCardTitle(title) {
  await dismissObstructivePopups(`before_open_queue:${title}`, { maxPasses: 2 });

  const cards = Array.from(document.querySelectorAll(".card-ticket"));
  const card = cards.find((c) => (c.innerText || "").includes(title));
  if (!card) {
    const preview = cards
      .slice(0, 10)
      .map((c) => (c.innerText || "").trim())
      .filter(Boolean);
    throw new Error(`Queue Card not found: ${title}. Found cards: ${JSON.stringify(preview)}`);
  }

  log(`[Nav] Opening queue: "${title}"`);
  card.click();

  // Allow navigation/render — increased from 550ms
  await sleep(800);
  await dismissObstructivePopups(`after_open_queue:${title}`, { maxPasses: 2 });

  // Ensure grid exists before scraping — increased timeout
  log(`[Nav] Waiting for ag-grid root after clicking "${title}"...`);
  await waitForAgGridRoot(30000);

  // Wait for rows to actually render
  await waitForRowsRendered(15000);

  // Wait for DOM stability
  await waitForDomStable(200, 4, 8000);

  log(`[Nav] Queue "${title}" ready.`);
}

function normalizeWritebackText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function queueTitleForWriteback(queueType) {
  const value = normalizeWritebackText(queueType);
  if (value.includes("trouble")) return "Trouble Tickets";
  if (value.includes("cc") || value.includes("cross")) return "CC Installs";
  if (value.includes("deinstall")) return "Deinstalls";
  return "Smart Hands";
}

function readVisibleRowEntries(root) {
  const centerRows = Array.from(root.querySelectorAll(".ag-center-cols-container .ag-row"));
  const leftRows = Array.from(root.querySelectorAll(".ag-pinned-left-cols-container .ag-row"));
  const rightRows = Array.from(root.querySelectorAll(".ag-pinned-right-cols-container .ag-row"));
  const headerMap = readHeaderMap(root);
  const byRow = new Map();

  const addRows = (rows, role) => {
    for (const row of rows) {
      const key = getRowKey(row);
      const existing = byRow.get(key) || { data: {}, rowEl: null };
      const rawData = { ...existing.data, ...readRowCells(row) };
      byRow.set(key, {
        data: normalizeRows(headerMap, [rawData])[0] || rawData,
        rowEl: existing.rowEl || (role === "center" ? row : null) || row,
      });
    }
  };

  addRows(centerRows, "center");
  addRows(leftRows, "left");
  addRows(rightRows, "right");
  return Array.from(byRow.values());
}

function getWritebackOwnerValue(rowData) {
  const ownerEntry = Object.entries(rowData || {}).find(([key, value]) => {
    const normalizedKey = normalizeWritebackText(key);
    return value != null && (
      normalizedKey === "owner"
      || normalizedKey.includes("owner")
      || normalizedKey.includes("besitzer")
      || normalizedKey.includes("verantwortlich")
    );
  });
  return ownerEntry ? String(ownerEntry[1] || "").trim() : "";
}

function rowMatchesWritebackJob(rowData, job) {
  const needles = [
    job.activityNumber,
    job.salesOrderNumber,
    job.ticketId,
  ].map(normalizeWritebackText).filter(Boolean);
  if (needles.length === 0) return false;

  const haystack = Object.values(rowData).map(normalizeWritebackText).join(" | ");
  return needles.some((needle) => haystack.includes(needle));
}

async function verifyWritebackOwner(job, expectedDisplayName) {
  await sleep(1600);
  const queueTitle = queueTitleForWriteback(job.queueType);
  await openQueueByCardTitle(queueTitle);
  const ticket = await findAndOpenWritebackTicket(job);
  if (!ticket.found) {
    return { matched: false, actualOwner: "", reason: "Ticket row not found after assignment" };
  }

  const actualOwner = getWritebackOwnerValue(ticket.rowData);
  const expectedValues = [
    job.selectedEmployeeJarvisOwnerCode,
    job.selectedEmployeeJarvisInitials,
    job.selectedEmployeeJarvisDisplayName,
    job.selectedEmployeeName,
    expectedDisplayName,
  ].map(normalizeWritebackText).filter(Boolean);
  const normalizedActual = normalizeWritebackText(actualOwner);

  if (!normalizedActual) {
    return {
      matched: false,
      actualOwner,
      reason: `Owner column was empty or not visible after assignment. Row data keys: ${Object.keys(ticket.rowData || {}).join(", ")}`,
    };
  }

  const matched = expectedValues.some((expected) => normalizedActual.includes(expected) || expected.includes(normalizedActual));
  return {
    matched,
    actualOwner,
    reason: matched ? "Owner verified after assignment" : `Owner mismatch after assignment: expected one of [${expectedValues.join(", ")}], got "${actualOwner}"`,
  };
}

async function findAndOpenWritebackTicket(job) {
  const root = await getAgGridRootAsync();
  const viewport = getGridViewport(root);
  viewport.scrollTop = 0;
  await waitForDomStable(200, 3, 6000);

  const started = Date.now();
  let sameScroll = 0;
  let lastTop = -1;
  while (Date.now() - started < 90000) {
    await dismissObstructivePopups("writeback_find_ticket", { maxPasses: 1 });
    const entries = readVisibleRowEntries(root);
    const hit = entries.find((entry) => rowMatchesWritebackJob(entry.data, job));
    if (hit?.rowEl) {
      hit.rowEl.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(200);
      hit.rowEl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
      hit.rowEl.click();
      await sleep(1200);
      return { found: true, rowData: hit.data };
    }

    lastTop = viewport.scrollTop;
    viewport.scrollTop += viewport.clientHeight * 0.9;
    await sleep(450);
    if (viewport.scrollTop === lastTop) sameScroll++;
    else sameScroll = 0;
    if (sameScroll >= 4) break;
  }

  return { found: false };
}

function visibleClickableElements() {
  return Array.from(document.querySelectorAll("button, [role='button'], a, input, textarea, [contenteditable='true']"))
    .filter(isElementVisible);
}

function clickVisibleText(patterns, { exclude = [] } = {}) {
  const elements = visibleClickableElements();
  for (const element of elements) {
    const text = normalizeWritebackText([
      element.innerText,
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.value,
      element.placeholder,
    ].filter(Boolean).join(" "));
    if (!text) continue;
    if (exclude.some((pattern) => pattern.test(text))) continue;
    if (patterns.some((pattern) => pattern.test(text))) {
      element.click();
      return true;
    }
  }
  return false;
}

async function openAssignDialogForWriteback() {
  await dismissObstructivePopups("before_assign_dialog", { maxPasses: 1 });
  const clicked = clickVisibleText([
    /assign activity/,
    /^assign$/,
    /zuweisen/,
  ], { exclude: [/unassign/, /remove/] });
  if (!clicked) {
    throw new Error("Assign Activity button not found");
  }
  await sleep(1000);
  await dismissObstructivePopups("after_assign_dialog", { maxPasses: 1 });
}

function setNativeInputValue(input, value) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function searchStaffForWriteback(displayName) {
  const input = Array.from(document.querySelectorAll("input, textarea"))
    .filter(isElementVisible)
    .find((element) => {
      const meta = normalizeWritebackText(`${element.placeholder || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`);
      return /search|staff|employee|name|mitarbeiter|user|assignee/.test(meta) || element.type === "search" || element.type === "text";
    });
  if (!input) throw new Error("Staff search input not found in Assign Activity dialog");

  setNativeInputValue(input, displayName);
  await sleep(1200);

  const expected = normalizeWritebackText(displayName);
  const candidates = Array.from(document.querySelectorAll("tr, li, [role='row'], [role='option'], .ag-row, div"))
    .filter(isElementVisible)
    .filter((element) => normalizeWritebackText(element.innerText || element.textContent).includes(expected));
  if (candidates.length === 0) throw new Error(`Staff "${displayName}" not found in Assign Activity dialog`);
  candidates[0].click();
  await sleep(500);
}

async function clickAssignConfirmForWriteback() {
  const clicked = clickVisibleText([
    /^assign$/,
    /assign selected/,
    /zuweisen/,
  ], { exclude: [/assign activity/, /unassign/] });
  if (!clicked) throw new Error("Final Assign button not found");
  await sleep(1200);
}

async function clickUnassignForWriteback() {
  const clicked = clickVisibleText([
    /unassign/,
    /remove assignee/,
    /zuweisung entfernen/,
  ]);
  if (!clicked) throw new Error("UnAssign button not found");
  await sleep(1200);
}

async function closeWritebackDialogIfOpen() {
  clickVisibleText([/^close$/, /^ok$/, /schlie/]);
  await sleep(400);
}

async function executeWritebackJob(job) {
  if (!isJarvisHost()) throw new Error("Writeback can only run on Jarvis host");
  if (!job?.id) throw new Error("Missing writeback job id");

  const steps = [];
  const queueTitle = queueTitleForWriteback(job.queueType);
  steps.push(`open_queue:${queueTitle}`);
  await openQueueByCardTitle(queueTitle);

  steps.push(`find_ticket:${job.activityNumber || job.ticketId}`);
  const ticket = await findAndOpenWritebackTicket(job);
  if (!ticket.found) throw new Error(`Ticket row not found for ${job.activityNumber || job.ticketId}`);

  steps.push("open_assign_dialog");
  await openAssignDialogForWriteback();

  if (job.actionType === "unassign") {
    steps.push("click_unassign");
    await clickUnassignForWriteback();
    await closeWritebackDialogIfOpen();
    return {
      ok: true,
      success: true,
      steps,
      previousExternalAssignee: job.expectedPreviousOwnerCode || job.currentJarvisOwnerCode || null,
      actualOwnerCode: null,
    };
  }

  const displayName = job.selectedEmployeeJarvisDisplayName || job.selectedEmployeeName;
  if (!displayName) throw new Error("Writeback job has no selected Jarvis display name");
  steps.push(`search_staff:${displayName}`);
  await searchStaffForWriteback(displayName);

  steps.push("click_assign");
  await clickAssignConfirmForWriteback();
  await closeWritebackDialogIfOpen();

  steps.push("verify_owner");
  const verification = await verifyWritebackOwner(job, displayName);
  if (!verification.matched) {
    throw new Error(verification.reason);
  }

  return {
    ok: true,
    success: true,
    steps,
    actualOwnerCode: verification.actualOwner || job.selectedEmployeeJarvisOwnerCode || null,
    verification,
  };
}

/**
 * Read expected ticket count from the queue card text.
 * Assumes the card contains the queue title plus a number that represents the total tickets.
 * Examples: "Smart Hands\n41" or "Smart Hands (41)".
 */
function getExpectedCountFromCard(title) {
  const cards = Array.from(document.querySelectorAll(".card-ticket"));
  const card = cards.find((c) => (c.innerText || "").includes(title));
  if (!card) return null;

  const text = (card.innerText || "").replace(/\s+/g, " ").trim();
  // Extract all integers; take the last one (usually the count).
  const matches = text.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const n = parseInt(last, 10);
  return Number.isFinite(n) ? n : null;
}

function isCompleteRun(expectedCount, actualCount) {
  if (!Number.isFinite(expectedCount)) return false;
  if (!Number.isFinite(actualCount)) return false;
  // Accept 0==0 as complete.
  return expectedCount === actualCount;
}

// ==============================================================
// DEINSTALL QUEUE SUPPORT — separate nav section with pagination
// ==============================================================

/**
 * Navigate to the Deinstalls section in Jarvis.
 * Deinstalls has its own navigation button/link (not a .card-ticket).
 */
async function navigateToDeinstalls() {
  log("[Deinstall] Navigating to Deinstalls section...");
  await dismissObstructivePopups("before_deinstall_nav", { maxPasses: 2 });

  // Strategy 1: buttons, links, tabs with "Deinstall" text
  const clickableSelectors = [
    'button', 'a', '[role="button"]', '[role="tab"]', '[role="menuitem"]',
    '.nav-item', '.nav-link', '.menu-item',
  ];

  for (const selector of clickableSelectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    const match = elements.find((el) => {
      const text = (el.innerText || el.textContent || "").trim();
      return /\bdeinstalls?\b/i.test(text);
    });
    if (match) {
      log(`[Deinstall] Found nav element via "${selector}":`, match.tagName, match.className,
        `"${(match.innerText || "").trim().substring(0, 60)}"`);
      match.click();
      await sleep(1500);
      await dismissObstructivePopups("after_deinstall_nav", { maxPasses: 2 });
      try { await waitForAgGridRoot(30000); } catch (e) {
        warn("[Deinstall] ag-grid not found after nav click:", e?.message);
        return false;
      }
      await waitForRowsRendered(10000);
      await waitForDomStable(200, 3, 6000);
      return true;
    }
  }

  // Strategy 2: broader search — short text elements containing "Deinstall"
  const allElements = Array.from(document.querySelectorAll("div, span, li, td, label"));
  const match2 = allElements.find((el) => {
    const text = (el.innerText || el.textContent || "").trim();
    return /^\s*deinstalls?\s*(\(\d+\))?\s*$/i.test(text);
  });

  if (match2) {
    log("[Deinstall] Found nav element via broad search:", match2.tagName, match2.className);
    match2.click();
    await sleep(1500);
    await dismissObstructivePopups("after_deinstall_nav_broad", { maxPasses: 2 });
    try { await waitForAgGridRoot(30000); } catch (e) {
      warn("[Deinstall] ag-grid not found after nav click:", e?.message);
      return false;
    }
    await waitForRowsRendered(10000);
    await waitForDomStable(200, 3, 6000);
    return true;
  }

  // Diagnostics: log available clickable elements for debugging
  const allClickable = Array.from(document.querySelectorAll("button, a, [role='button'], [role='tab']"));
  const preview = allClickable.slice(0, 40).map((e) => (e.innerText || "").trim().substring(0, 60)).filter(Boolean);
  warn("[Deinstall] Navigation element not found. Available elements:", JSON.stringify(preview));
  return false;
}

/**
 * Read "Total X records" counter from the Deinstall section header.
 * This is the authoritative expected count (NOT the badge on the nav button).
 */
function readDeinstallTotalCounter() {
  const textPatterns = [
    /Total\s+(\d[\d,]*)\s+records?/i,
    /(\d[\d,]*)\s+records?\s+total/i,
    /showing\s+\d+\s+to\s+\d+\s+of\s+(\d[\d,]*)/i,
  ];

  // Search common container types near the top of the grid area
  const containerSelectors = [
    ".ag-paging-row-summary-panel",
    '[class*="total"]', '[class*="count"]', '[class*="summary"]',
    '[class*="header"]', '[class*="status"]', '[class*="info"]',
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "span", "div", "label",
  ];

  for (const sel of containerSelectors) {
    const elements = document.querySelectorAll(sel);
    for (const el of elements) {
      const text = (el.innerText || "").trim();
      if (!text || text.length > 200) continue;
      for (const pattern of textPatterns) {
        const m = text.match(pattern);
        if (m) {
          const count = parseInt(m[1].replace(/,/g, ""), 10);
          if (Number.isFinite(count) && count >= 0) {
            log(`[Deinstall] Total counter found: "${text}" → ${count}`);
            return count;
          }
        }
      }
    }
  }

  // Fallback: ag-grid paging panel "X to Y of Z"
  const pagingPanels = document.querySelectorAll(".ag-paging-panel, .ag-status-bar");
  for (const panel of pagingPanels) {
    const text = (panel.innerText || "").trim();
    const m = text.match(/of\s+(\d[\d,]*)/i);
    if (m) {
      const count = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(count) && count >= 0) {
        log(`[Deinstall] Total from paging panel: "${text}" → ${count}`);
        return count;
      }
    }
  }

  warn("[Deinstall] Could not find 'Total X records' counter.");
  return null;
}

/**
 * Try to ensure Deinstall grid is in unfiltered/full state.
 * Clears any active ag-grid filters.
 */
async function clearDeinstallFilters() {
  try {
    const root = await getAgGridRootAsync();
    const apiBundle = tryGetAgGridApi(root);
    if (apiBundle?.api && typeof apiBundle.api.setFilterModel === "function") {
      apiBundle.api.setFilterModel(null);
      log("[Deinstall] Cleared grid filters via API.");
      await sleep(300);
      return;
    }

    // Fallback: look for a "Clear Filters" / "Show All" button
    const buttons = Array.from(document.querySelectorAll("button"));
    const clearBtn = buttons.find((b) => {
      const t = (b.innerText || "").trim().toLowerCase();
      return t === "clear filters" || t === "reset filters" || t === "alle anzeigen" || t === "show all" || t === "all";
    });
    if (clearBtn) {
      log("[Deinstall] Clicking filter clear button.");
      clearBtn.click();
      await sleep(500);
    }
  } catch (e) {
    warn("[Deinstall] Could not clear filters:", e?.message || e);
  }
}

/**
 * Find the pagination "Next" button for the Deinstall grid.
 * Returns { element, enabled } or null.
 */
function getDeinstallPaginationNext() {
  // ag-grid built-in pagination buttons
  const agRefs = document.querySelectorAll('[ref="btNext"], .ag-paging-button');
  for (const el of agRefs) {
    const btn = el.closest("button") || el;
    if (btn.tagName !== "BUTTON" && btn.getAttribute("role") !== "button") continue;
    const hasNextIcon = btn.querySelector(".ag-icon-next") || /next/i.test(btn.getAttribute("aria-label") || "");
    if (hasNextIcon || el.getAttribute("ref") === "btNext") {
      const disabled = btn.disabled
        || btn.classList.contains("ag-disabled")
        || btn.getAttribute("aria-disabled") === "true";
      return { element: btn, enabled: !disabled };
    }
  }

  // Custom pagination buttons (arrow / "Next" text)
  const allBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
  for (const btn of allBtns) {
    const text = (btn.innerText || btn.textContent || "").trim();
    const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
    const title = (btn.getAttribute("title") || "").toLowerCase();

    const isNext = text === ">" || text === "›" || text === "→" || text === "»"
      || text.toLowerCase() === "next"
      || ariaLabel.includes("next page") || ariaLabel === "next"
      || title.includes("next") || title.includes("nächste");

    if (isNext) {
      const disabled = btn.disabled
        || btn.classList.contains("disabled")
        || btn.getAttribute("aria-disabled") === "true";
      return { element: btn, enabled: !disabled };
    }

    // Icon-based next button
    if (btn.querySelector('.ag-icon-next, [class*="chevron-right"], [class*="arrow-right"], [class*="next"]')) {
      const disabled = btn.disabled
        || btn.classList.contains("disabled")
        || btn.getAttribute("aria-disabled") === "true";
      return { element: btn, enabled: !disabled };
    }
  }

  return null;
}

/**
 * Collect ALL Deinstall rows across paginated pages.
 * On each page, uses scroll-based collection (handles virtual grids).
 * Validates page transitions deterministically.
 */
async function collectAllDeinstallRowsPaginated(keyColId, expectedTotal) {
  const allRows = new Map();
  let pageNum = 0;
  const maxPages = Math.min(Math.ceil(expectedTotal / 10) + 10, 200); // hard cap at 200 pages
  let consecutiveNoNew = 0;
  const maxConsecutiveNoNew = 3;
  let lastPageRowKeys = new Set();
  const paginationStartTime = Date.now();
  const MAX_PAGINATION_TIME_MS = 180000; // 3 minutes hard timeout

  log(`[Deinstall] Starting pagination: expectedTotal=${expectedTotal}, maxPages=${maxPages}`);

  while (pageNum < maxPages) {
    // Hard time-based timeout
    if (Date.now() - paginationStartTime > MAX_PAGINATION_TIME_MS) {
      warn(`[Deinstall] Pagination hard timeout reached (${MAX_PAGINATION_TIME_MS}ms). Collected ${allRows.size} rows across ${pageNum} pages.`);
      break;
    }

    pageNum++;
    log(`[Deinstall] === Page ${pageNum} ===`);

    // Collect current page rows (with virtual-scroll support)
    const { headerMap, rows } = await collectAllRowsByScrolling({ keyColId });

    const currentPageKeys = new Set();
    let newOnThisPage = 0;

    for (const row of rows) {
      const key = (row[keyColId] || "").trim();
      if (!key) continue;
      currentPageKeys.add(key);
      if (!allRows.has(key)) {
        newOnThisPage++;
        allRows.set(key, row);
      } else {
        // Merge: update with any enriched fields from this page
        allRows.set(key, { ...allRows.get(key), ...row });
      }
    }

    // Detect duplicate page (same rows as previous page)
    const isSamePage = currentPageKeys.size > 0 && lastPageRowKeys.size > 0
      && [...currentPageKeys].every((k) => lastPageRowKeys.has(k));

    if (isSamePage) {
      warn(`[Deinstall] Page ${pageNum} is duplicate of previous page.`);
      consecutiveNoNew++;
    } else if (newOnThisPage === 0 && rows.length > 0) {
      warn(`[Deinstall] Page ${pageNum}: ${rows.length} rows but 0 new unique keys.`);
      consecutiveNoNew++;
    } else {
      consecutiveNoNew = 0;
    }

    log(`[Deinstall] Page ${pageNum}: visible=${rows.length}, new=${newOnThisPage}, cumulative=${allRows.size}/${expectedTotal}, duplicate=${isSamePage}`);

    // Log last few ticket IDs for diagnostics
    const recentKeys = [...currentPageKeys].slice(-5);
    log(`[Deinstall] Page ${pageNum} last IDs: ${JSON.stringify(recentKeys)}`);

    lastPageRowKeys = currentPageKeys;

    // Stop: consecutive empty/duplicate pages
    if (consecutiveNoNew >= maxConsecutiveNoNew) {
      warn(`[Deinstall] ${maxConsecutiveNoNew} consecutive pages without new rows. Stopping pagination.`);
      break;
    }

    // Stop: reached expected total
    if (allRows.size >= expectedTotal) {
      log(`[Deinstall] Reached expected total (${allRows.size} >= ${expectedTotal}).`);
      break;
    }

    // Advance to next page
    const nextBtn = getDeinstallPaginationNext();
    if (!nextBtn) {
      log("[Deinstall] No Next button found. Pagination complete at page " + pageNum);
      break;
    }
    if (!nextBtn.enabled) {
      log("[Deinstall] Next button disabled. Pagination complete at page " + pageNum);
      break;
    }

    // Snapshot first visible row keys before clicking Next
    const beforeIds = new Set([...currentPageKeys].slice(0, 5));

    nextBtn.element.click();
    log("[Deinstall] Clicked Next. Waiting for grid update...");

    // Wait until grid content actually changes (deterministic page transition check)
    let contentChanged = false;
    const waitStart = Date.now();
    const PAGE_TRANSITION_TIMEOUT = 10000;
    while (Date.now() - waitStart < PAGE_TRANSITION_TIMEOUT) {
      await sleep(400);
      try {
        const root = await getAgGridRootAsync();

        // Check for loading overlays
        const loadingOverlay = root.querySelector(".ag-overlay-loading-wrapper, .ag-loading");
        if (loadingOverlay && loadingOverlay.offsetParent !== null) {
          continue; // still loading, keep waiting
        }

        const newVisible = readVisibleRows(root);
        const newFirstKeys = new Set();
        for (const r of newVisible.slice(0, 5)) {
          const k = (r[keyColId] || "").trim();
          if (k) newFirstKeys.add(k);
        }
        if (newFirstKeys.size > 0 && ![...newFirstKeys].every((k) => beforeIds.has(k))) {
          contentChanged = true;
          break;
        }
      } catch (_) { /* grid might be briefly detached during page transition */ }
    }

    if (!contentChanged) {
      warn(`[Deinstall] Grid content did not change after Next on page ${pageNum}. Possible stuck pagination.`);
      // Count this as a no-new page to trigger the consecutive limit
      consecutiveNoNew++;
      if (consecutiveNoNew >= maxConsecutiveNoNew) {
        warn(`[Deinstall] Breaking out: ${maxConsecutiveNoNew} stuck page transitions.`);
        break;
      }
      await sleep(1500);
    }

    // Stabilization — wait for DOM to settle after page change
    await waitForDomStable(200, 3, 5000);
  }

  const root = await getAgGridRootAsync();
  return {
    headerMap: readHeaderMap(root),
    rows: Array.from(allRows.values()),
    pagesScraped: pageNum,
  };
}

/**
 * Scrape the Deinstall queue end-to-end: navigate, read counter,
 * paginate, validate, retry.
 */
async function scrapeDeinstallQueue(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log(`[Deinstall] ========== Attempt ${attempt}/${maxAttempts} ==========`);

      // 1. Navigate to Deinstalls section
      const navOk = await navigateToDeinstalls();
      if (!navOk) {
        warn("[Deinstall] Navigation failed.");
        if (attempt === maxAttempts)
          return { rows: [], actualCount: 0, expectedCount: null, complete: false, attempts: attempt, error: "NAV_FAILED" };
        await sleep(1000);
        continue;
      }

      // 2. Clear any active filters to ensure full dataset
      await clearDeinstallFilters();
      await sleep(300);

      // 3. Read "Total X records" counter (authoritative expected count)
      const expectedTotal = readDeinstallTotalCounter();
      log(`[Deinstall] Expected total from counter: ${expectedTotal}`);

      if (!Number.isFinite(expectedTotal) || expectedTotal < 0) {
        warn(`[Deinstall] Could not read total counter. Value: ${expectedTotal}`);
        if (attempt === maxAttempts)
          return { rows: [], actualCount: 0, expectedCount: expectedTotal, complete: false, attempts: attempt, error: "COUNTER_UNREADABLE" };
        await sleep(800);
        continue;
      }

      // Special case: 0 records
      if (expectedTotal === 0) {
        log("[Deinstall] Total is 0 — nothing to collect.");
        return { rows: [], actualCount: 0, expectedCount: 0, complete: true, attempts: attempt };
      }

      // 4. Detect key column for deduplication
      const deinstallKey = await detectKeyColIdByHeaderText("ACT_NUM", "Activity #");
      log(`[Deinstall] Key col-id: "${deinstallKey}"`);

      // 5. Collect rows across all pages
      const { headerMap, rows, pagesScraped } = await collectAllDeinstallRowsPaginated(deinstallKey, expectedTotal);

      // 6. Normalize column headers → canonical labels
      const normalizedRows = normalizeRows(headerMap, rows);
      const actualCount = normalizedRows.length;

      log(`[Deinstall] Attempt ${attempt} result: pages=${pagesScraped}, actual=${actualCount}, expected=${expectedTotal}`);

      // 7. Validate Soll == Ist
      const complete = isCompleteRun(expectedTotal, actualCount);
      if (complete) {
        log(`[Deinstall] ✓ COMPLETE: ${actualCount}/${expectedTotal} (${pagesScraped} pages)`);
        return { rows: normalizedRows, actualCount, expectedCount: expectedTotal, complete: true, attempts: attempt, pagesScraped };
      }

      warn(`[Deinstall] INCOMPLETE: ${actualCount}/${expectedTotal}. ${attempt < maxAttempts ? "Retrying..." : "Giving up."}`);

      if (attempt === maxAttempts)
        return { rows: normalizedRows, actualCount, expectedCount: expectedTotal, complete: false, attempts: attempt, pagesScraped };

      // Backoff before retry
      await sleep(600 + attempt * 500);
    } catch (e) {
      err(`[Deinstall] Attempt ${attempt} error:`, e?.message || e);
      if (attempt === maxAttempts)
        return { rows: [], actualCount: 0, expectedCount: null, complete: false, attempts: attempt, error: String(e?.message || e) };
      await sleep(800 + attempt * 400);
    }
  }

  return { rows: [], actualCount: 0, expectedCount: null, complete: false, attempts: maxAttempts, error: "MAX_ATTEMPTS" };
}

async function scrapeAllQueuesAndUpload() {
  if (!isJarvisHost()) {
    warn("Not a Jarvis host. Skip scraping.");
    return;
  }

  if (OES_IS_RUNNING) {
    warn("Scrape already running. Ignoring trigger.");
    return;
  }

  OES_IS_RUNNING = true;
  const runStartTime = Date.now();
  notifyScrapeActivity(true, "scrape_all_queues");
  try {
    await dismissObstructivePopups("scrape_run_start", { maxPasses: 2 });

    // ── Step 0: Read enabled queues configuration ──
    const enabledQueues = await getEnabledQueues();
    log("========================================");
    log(`[Run] Starting scrape run at ${new Date().toISOString()}`);
    log(`[Run] Enabled queues: ${JSON.stringify(enabledQueues)}`);
    log(`[Run] Disabled queues: ${JSON.stringify(ALL_QUEUE_IDS.filter(q => !enabledQueues.includes(q)))}`);
    log("========================================");

    if (enabledQueues.length === 0) {
      warn("[Run] No queues enabled. Aborting scrape run.");
      notifyRunSummary("skipped", {}, Date.now() - runStartTime, [], "no_enabled_queues");
      return;
    }

    // ── Step 1: Backend preflight check ──
    log("[Preflight] Checking backend reachability before scraping...");
    try {
      const preflightResult = await preflightBackendCheck();
      log(`[Preflight] SUCCESS — Backend reachable (status=${preflightResult.status}, url=${preflightResult.baseUrl})`);
    } catch (preflightErr) {
      err(`[Preflight] FAILED — Backend not reachable: ${preflightErr?.message || preflightErr}`);
      err("[Preflight] Aborting scrape run. No Jarvis navigation will be performed.");
      try {
        chrome.runtime.sendMessage({ type: "OES_SCRAPE_ERROR", url: location.href, message: `Preflight failed: ${preflightErr?.message}` });
      } catch (_) { }
      notifyRunSummary("failed", {}, Date.now() - runStartTime, [], "preflight_failed");
      return;
    }

    // ── Step 2: Read expected totals from Jarvis UI (card numbers) ──
    // Only read expected counts for enabled card-based queues
    const expected = {};
    const cardQueues = ["smartHands", "troubleTickets", "ccInstalls"];
    const cardTitles = { smartHands: "Smart Hands", troubleTickets: "Trouble Tickets", ccInstalls: "CC Installs" };
    const enabledCardQueues = cardQueues.filter(q => enabledQueues.includes(q));

    for (const q of enabledCardQueues) {
      expected[q] = getExpectedCountFromCard(cardTitles[q]);
    }
    log("[Run] Expected counts:", expected);

    // If we fail to read expected counts for enabled card queues, do not risk a destructive sync.
    for (const q of enabledCardQueues) {
      if (!Number.isFinite(expected[q])) {
        throw new Error(
          `Could not read expected count from Jarvis UI for "${cardTitles[q]}". Value: ${expected[q]}`
        );
      }
    }

    // Retry wrapper: for each queue, re-scrape up to N times until actual_count matches expected_count.
    const scrapeQueueWithRetry = async (name, fnScrape, expectedCount, maxAttempts = 3) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const out = await fnScrape();
        const actualCount = Array.isArray(out) ? out.length : 0;
        const ok = isCompleteRun(expectedCount, actualCount);
        log(`[${name}] Attempt ${attempt}/${maxAttempts}: actual=${actualCount}, expected=${expectedCount}, complete=${ok}`);
        if (ok) return { rows: out, actualCount, expectedCount, complete: true, attempts: attempt };

        // Last attempt -> return incomplete
        if (attempt === maxAttempts) {
          return { rows: out, actualCount, expectedCount, complete: false, attempts: attempt };
        }

        // Backoff + light refresh to improve stability
        await sleep(450 + attempt * 350);
      }
      return { rows: [], actualCount: 0, expectedCount, complete: false, attempts: maxAttempts };
    };

    const results = {};

    // ── Step 3: Scrape enabled queues sequentially ──

    // 3a) Smart Hands
    if (enabledQueues.includes("smartHands")) {
      log("[Run] ── Starting queue: Smart Hands ──");
      try {
        results.smartHands = await scrapeQueueWithRetry(
          "SmartHands",
          async () => {
            await openQueueByCardTitle("Smart Hands");
            const shKey = await detectKeyColIdByHeaderText("ACT_NUM", "Activity #");
            log(`[SmartHands] Detected key col-id: "${shKey}"`);
            const sh = await collectWithFallbackKeys(shKey, ["ACT_NUM", "ACTIVITY_NO", "ACT_NUMB"]);
            return normalizeRows(sh.headerMap, sh.rows);
          },
          expected.smartHands,
          3
        );
        log(`[Run] Smart Hands done: ${results.smartHands.actualCount}/${results.smartHands.expectedCount} (complete=${results.smartHands.complete})`);
      } catch (e) {
        err("[Run] Smart Hands scrape error (non-blocking):", e?.message || e);
        results.smartHands = { rows: [], actualCount: 0, expectedCount: expected.smartHands, complete: false, attempts: 0, error: String(e?.message || e) };
      }
    } else {
      log("[Run] SKIPPING Smart Hands (disabled)");
    }

    // 3b) Trouble Tickets
    if (enabledQueues.includes("troubleTickets")) {
      log("[Run] ── Starting queue: Trouble Tickets ──");
      try {
        results.troubleTickets = await scrapeQueueWithRetry(
          "TroubleTickets",
          async () => {
            await openQueueByCardTitle("Trouble Tickets");
            const ttKey = await detectKeyColIdByHeaderText("TICKET_ID", "Ticket ID");
            log(`[TroubleTickets] Detected key col-id: "${ttKey}"`);
            const tt = await collectWithFallbackKeys(ttKey, ["TICKET_NO", "CASE_ID", "ID"]);
            return normalizeRows(tt.headerMap, tt.rows);
          },
          expected.troubleTickets,
          3
        );
        log(`[Run] Trouble Tickets done: ${results.troubleTickets.actualCount}/${results.troubleTickets.expectedCount} (complete=${results.troubleTickets.complete})`);
      } catch (e) {
        err("[Run] Trouble Tickets scrape error (non-blocking):", e?.message || e);
        results.troubleTickets = { rows: [], actualCount: 0, expectedCount: expected.troubleTickets, complete: false, attempts: 0, error: String(e?.message || e) };
      }
    } else {
      log("[Run] SKIPPING Trouble Tickets (disabled)");
    }

    // 3c) CC Installs
    if (enabledQueues.includes("ccInstalls")) {
      log("[Run] ── Starting queue: CC Installs ──");
      try {
        results.ccInstalls = await scrapeQueueWithRetry(
          "CCInstalls",
          async () => {
            await openQueueByCardTitle("CC Installs");
            const ccKey = await detectKeyColIdByHeaderText("ACT_NUM", "Activity #");
            log(`[CCInstalls] Detected key col-id: "${ccKey}"`);
            const cc = await collectWithFallbackKeys(ccKey, ["ACT_NUM", "ORDER_NUM", "ORDER_ID"]);
            return normalizeRows(cc.headerMap, cc.rows);
          },
          expected.ccInstalls,
          3
        );
        log(`[Run] CC Installs done: ${results.ccInstalls.actualCount}/${results.ccInstalls.expectedCount} (complete=${results.ccInstalls.complete})`);
      } catch (e) {
        err("[Run] CC Installs scrape error (non-blocking):", e?.message || e);
        results.ccInstalls = { rows: [], actualCount: 0, expectedCount: expected.ccInstalls, complete: false, attempts: 0, error: String(e?.message || e) };
      }
    } else {
      log("[Run] SKIPPING CC Installs (disabled)");
    }

    // 3d) Deinstalls (separate section with pagination)
    if (enabledQueues.includes("deinstalls")) {
      log("[Run] ── Starting queue: Deinstalls ──");
      try {
        results.deinstalls = await scrapeDeinstallQueue(3);
        log(`[Run] Deinstalls done: ${results.deinstalls.actualCount}/${results.deinstalls.expectedCount} (complete=${results.deinstalls.complete})`);
      } catch (e) {
        err("[Run] Deinstall scrape error (non-blocking):", e?.message || e);
        results.deinstalls = { rows: [], actualCount: 0, expectedCount: null, complete: false, attempts: 0, error: String(e?.message || e) };
      }
    } else {
      log("[Run] SKIPPING Deinstalls (disabled)");
    }

    // ── Step 4: Build meta and upload ──
    const meta = {};
    for (const q of enabledQueues) {
      if (results[q]) {
        meta[q] = {
          expected: results[q].expectedCount,
          actual: results[q].actualCount,
          complete: results[q].complete,
          attempts: results[q].attempts,
        };
      }
    }

    // Only upload queues that are complete. Incomplete queues are omitted, preventing destructive overwrites.
    const queuesToUpload = {};
    for (const q of enabledQueues) {
      if (results[q]?.complete) {
        queuesToUpload[q] = results[q].rows;
      }
    }

    const hasAnyComplete = Object.keys(queuesToUpload).length > 0;
    if (!hasAnyComplete) {
      warn("[Run] No complete queues in this run. Skipping upload.", meta);
      try {
        chrome.runtime.sendMessage({ type: "OES_SCRAPE_INCOMPLETE", url: location.href, meta });
      } catch (_) { }
      notifyRunSummary("incomplete", meta, Date.now() - runStartTime, [], "no_complete_queues");
      return;
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      source: "jarvis-extension",
      url: location.href,
      queuesMeta: meta,
      queues: queuesToUpload,
    };

    log("[Run] Uploading snapshot (via background)...", {
      meta,
      uploaded: {
        smartHands: queuesToUpload.smartHands ? queuesToUpload.smartHands.length : 0,
        troubleTickets: queuesToUpload.troubleTickets ? queuesToUpload.troubleTickets.length : 0,
        ccInstalls: queuesToUpload.ccInstalls ? queuesToUpload.ccInstalls.length : 0,
        deinstalls: queuesToUpload.deinstalls ? queuesToUpload.deinstalls.length : 0,
      },
    });

    // Diagnostic: verify Owner and Sched. Start extraction
    for (const [qName, rows] of Object.entries(queuesToUpload)) {
      const withOwner = rows.filter(r => (r["Owner"] || "").trim()).length;
      const withSched = rows.filter(r => (r["Sched. Start"] || "").trim()).length;
      log(`  ${qName}: ${rows.length} rows, Owner=${withOwner}, Sched.Start=${withSched}`);
    }

    const resp = await uploadSnapshotViaBackground(payload);
    log("[Run] Upload OK:", resp);
    OES_SESSION_SUCCESS_COUNT++;
    log(`[Run] ======== Scrape run complete (${((Date.now() - runStartTime) / 1000).toFixed(1)}s) [session successes: ${OES_SESSION_SUCCESS_COUNT}] ========`);
    notifyRunSummary("success", meta, Date.now() - runStartTime, Object.keys(queuesToUpload), "upload_ok");
  } finally {
    OES_IS_RUNNING = false;
    notifyScrapeActivity(false, "scrape_all_queues");
  }
}

// Trigger listener from background.js (alarm/timer)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "OES_EXECUTE_WRITEBACK") {
    (async () => {
      try {
        const result = await executeWritebackJob(msg.job);
        sendResponse(result);
      } catch (e) {
        err("[Writeback] content execution failed:", e?.message || e);
        sendResponse({ ok: false, success: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "OES_START_CONTINUOUS_SCRAPE" || msg?.type === "OES_SCRAPE_ALL_QUEUES") {
    log("Trigger received in content.js");
    try {
      chrome.runtime.sendMessage({ type: "OES_TRIGGER_RECEIVED", url: location.href });
    } catch (_) { }

    startContinuousMode(msg.reason || msg.type);
  }
});

window.addEventListener("beforeunload", () => {
  stopPopupJanitor();
  stopContinuousMode("beforeunload");
});

if (isJarvisHost()) {
  startPopupJanitor();
  void dismissObstructivePopups("content_bootstrap", { maxPasses: 2 });
  startContinuousMode("content_bootstrap");
}

// ==============================
// OES Jarvis Crawler - content.js
// - Scrape ALL 3 queues
// - Upload via background (avoids Failed to fetch)
// - Waits for ag-grid to be ready (fix ag-grid root not found)
// - Auto-detect Trouble Tickets key column by header text (fix TT=0)
// ==============================

const OES_DEBUG = true;
let OES_IS_RUNNING = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...args) {
  if (OES_DEBUG) console.log("[OES Crawler]", ...args);
}
function warn(...args) {
  console.warn("[OES Crawler]", ...args);
}
function err(...args) {
  console.error("[OES Crawler]", ...args);
}

console.log("[OES Crawler] content.js LOADED on", location.href);
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
async function waitForAgGridRoot(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const root = document.querySelector(".ag-root") || document.querySelector(".ag-root-wrapper");
    if (root) return root;
    await sleep(250);
  }
  throw new Error("ag-grid root not found after waiting");
}

async function getAgGridRootAsync() {
  return await waitForAgGridRoot(20000);
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
    for (let t = 0; t < 30; t++) {
      const n = root.querySelectorAll(".ag-center-cols-container .ag-row").length;
      if (n === last && n > 0) stable++;
      else stable = 0;
      last = n;
      if (stable >= 3) return;
      await sleep(120);
    }
  };

  await waitStable();

  let lastScrollTop = -1;
  let sameScrollCount = 0;
  let noNewCount = 0;

  // Larger step size + earlier stopping conditions = faster.
  for (let i = 0; i < 2500; i++) {
    // 2-pass horizontal scroll: left=0 captures key column, left=max captures Owner/Sched. Start
    if (hViewport) hViewport.scrollLeft = 0;
    await sleep(15);
    const left = readVisibleRows(root);

    let right = [];
    if (hViewport && hViewport.scrollWidth > hViewport.clientWidth) {
      hViewport.scrollLeft = hViewport.scrollWidth;
      await sleep(25);
      right = readVisibleRows(root);
      // Reset scroll to left so key column stays in DOM for next vertical step
      hViewport.scrollLeft = 0;
      await sleep(10);
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

    // Early stop if we already captured everything (when aria-rowcount is available).
    // aria-rowcount includes header + rows in some ag-grid setups; we tolerate +/- 2.
    if (totalRowsHint && byKey.size >= Math.max(0, totalRowsHint - 2)) break;

    lastScrollTop = viewport.scrollTop;
    viewport.scrollTop = viewport.scrollTop + viewport.clientHeight * 1.25;
    await sleep(35);

    if (viewport.scrollTop === lastScrollTop) sameScrollCount++;
    else sameScrollCount = 0;

    // Stop quickly if we are not discovering new keys anymore.
    if (noNewCount >= 8) break;
    if (sameScrollCount >= 5) break;
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
  const cards = Array.from(document.querySelectorAll(".card-ticket"));
  const card = cards.find((c) => (c.innerText || "").includes(title));
  if (!card) {
    const preview = cards
      .slice(0, 10)
      .map((c) => (c.innerText || "").trim())
      .filter(Boolean);
    throw new Error(`Queue Card not found: ${title}. Found cards: ${JSON.stringify(preview)}`);
  }

  log(`Open queue: "${title}"`);
  card.click();

  // allow navigation/render
  await sleep(550);

  // ensure grid exists before scraping
  await waitForAgGridRoot(20000);
  // additional wait is handled by the grid-stability check in the collector
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
  try {
    log("Starting scrape run (ALL queues -> DB upload via background)...");

    // Read expected totals from Jarvis UI (card numbers).
    // Assumption from you: "All" is active and there are no filters.
    const expected = {
      smartHands: getExpectedCountFromCard("Smart Hands"),
      troubleTickets: getExpectedCountFromCard("Trouble Tickets"),
      ccInstalls: getExpectedCountFromCard("CC Installs"),
    };
    log("Expected counts:", expected);

    // If we fail to read expected counts, do not risk a destructive sync.
    if (!Number.isFinite(expected.smartHands) || !Number.isFinite(expected.troubleTickets) || !Number.isFinite(expected.ccInstalls)) {
      throw new Error(
        `Could not read expected counts from Jarvis UI. Expected={SH:${expected.smartHands}, TT:${expected.troubleTickets}, CC:${expected.ccInstalls}}`
      );
    }

    // Retry wrapper: for each queue, re-scrape up to N times until actual_count matches expected_count.
    const scrapeQueueWithRetry = async (name, fnScrape, expectedCount, maxAttempts = 3) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const out = await fnScrape();
        const actualCount = Array.isArray(out) ? out.length : 0;
        const ok = isCompleteRun(expectedCount, actualCount);
        log(`${name}: attempt ${attempt}/${maxAttempts} -> actual=${actualCount}, expected=${expectedCount}, complete=${ok}`);
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

    // 1) Smart Hands
    const shResult = await scrapeQueueWithRetry(
      "SmartHands",
      async () => {
        await openQueueByCardTitle("Smart Hands");
        const shKey = await detectKeyColIdByHeaderText("ACT_NUM", "Activity #");
        log(`SmartHands detected key col-id: "${shKey}"`);
        const sh = await collectWithFallbackKeys(shKey, ["ACT_NUM", "ACTIVITY_NO", "ACT_NUMB"]);
        return normalizeRows(sh.headerMap, sh.rows);
      },
      expected.smartHands,
      3
    );

    // 2) Trouble Tickets
    const ttResult = await scrapeQueueWithRetry(
      "TroubleTickets",
      async () => {
        await openQueueByCardTitle("Trouble Tickets");
        const ttKey = await detectKeyColIdByHeaderText("TICKET_ID", "Ticket ID");
        log(`TroubleTickets detected key col-id: "${ttKey}"`);
        const tt = await collectWithFallbackKeys(ttKey, ["TICKET_NO", "CASE_ID", "ID"]);
        return normalizeRows(tt.headerMap, tt.rows);
      },
      expected.troubleTickets,
      3
    );

    // 3) CC Installs
    const ccResult = await scrapeQueueWithRetry(
      "CCInstalls",
      async () => {
        await openQueueByCardTitle("CC Installs");
        const ccKey = await detectKeyColIdByHeaderText("ACT_NUM", "Activity #");
        log(`CCInstalls detected key col-id: "${ccKey}"`);
        const cc = await collectWithFallbackKeys(ccKey, ["ACT_NUM", "ORDER_NUM", "ORDER_ID"]);
        return normalizeRows(cc.headerMap, cc.rows);
      },
      expected.ccInstalls,
      3
    );

    const meta = {
      smartHands: { expected: shResult.expectedCount, actual: shResult.actualCount, complete: shResult.complete, attempts: shResult.attempts },
      troubleTickets: { expected: ttResult.expectedCount, actual: ttResult.actualCount, complete: ttResult.complete, attempts: ttResult.attempts },
      ccInstalls: { expected: ccResult.expectedCount, actual: ccResult.actualCount, complete: ccResult.complete, attempts: ccResult.attempts },
    };

    // Only upload queues that are complete. Incomplete queues are omitted, preventing destructive overwrites.
    const queuesToUpload = {};
    if (shResult.complete) queuesToUpload.smartHands = shResult.rows;
    if (ttResult.complete) queuesToUpload.troubleTickets = ttResult.rows;
    if (ccResult.complete) queuesToUpload.ccInstalls = ccResult.rows;

    const hasAnyComplete = Object.keys(queuesToUpload).length > 0;
    if (!hasAnyComplete) {
      warn("No complete queues in this run. Skipping upload.", meta);
      try {
        chrome.runtime.sendMessage({ type: "OES_SCRAPE_INCOMPLETE", url: location.href, meta });
      } catch (_) { }
      return;
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      source: "jarvis-extension",
      url: location.href,
      queuesMeta: meta,
      queues: queuesToUpload,
    };

    log("Uploading snapshot (via background)...", {
      meta,
      uploaded: {
        smartHands: queuesToUpload.smartHands ? queuesToUpload.smartHands.length : 0,
        troubleTickets: queuesToUpload.troubleTickets ? queuesToUpload.troubleTickets.length : 0,
        ccInstalls: queuesToUpload.ccInstalls ? queuesToUpload.ccInstalls.length : 0,
      },
    });

    // Diagnostic: verify Owner and Sched. Start extraction
    for (const [qName, rows] of Object.entries(queuesToUpload)) {
      const withOwner = rows.filter(r => (r["Owner"] || "").trim()).length;
      const withSched = rows.filter(r => (r["Sched. Start"] || "").trim()).length;
      log(`  ${qName}: ${rows.length} rows, Owner=${withOwner}, Sched.Start=${withSched}`);
    }

    const resp = await uploadSnapshotViaBackground(payload);
    log("Upload OK:", resp);
  } finally {
    OES_IS_RUNNING = false;
  }
}

// Trigger listener from background.js (alarm/timer)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "OES_SCRAPE_ALL_QUEUES") {
    log("Trigger received in content.js");
    try {
      chrome.runtime.sendMessage({ type: "OES_TRIGGER_RECEIVED", url: location.href });
    } catch (_) { }

    scrapeAllQueuesAndUpload().catch((e) => {
      err("OES scrape/upload failed:", e);
      try {
        chrome.runtime.sendMessage({
          type: "OES_SCRAPE_ERROR",
          message: String(e?.message || e),
          url: location.href
        });
      } catch (_) { }
    });
  }
});

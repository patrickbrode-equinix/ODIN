/* ------------------------------------------------ */
/* lib/queueNormalizer.js                           */
/* Pure functions for queue type/group/status       */
/* normalization used in queue ingest pipeline.     */
/* ------------------------------------------------ */

/**
 * Pick the first non-empty string value from obj at one of the given keys.
 * Returns "" if none found.
 */
export function pick(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k] !== undefined && obj[k] !== null ? String(obj[k]).trim() : "";
    if (v) return v;
  }
  return "";
}

/**
 * Pick from multiple source objects.
 */
export function pickFromMany(sources, keys) {
  for (const src of sources) {
    const v = pick(src, keys);
    if (v) return v;
  }
  return "";
}

/**
 * Map a canonical queue type to its display group name.
 */
export function normalizeGroupFromQueueType(queueType) {
  if (queueType === "SmartHands")    return "FR2-Smart hands";
  if (queueType === "CCInstalls")    return "FR2-Cross Connects";
  if (queueType === "TroubleTickets") return "Trouble Tickets";
  return "";
}

/**
 * Normalize legacy or alternate queueType spellings to canonical form.
 */
export function canonicalizeQueueType(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s === "SMART_HANDS"   || s.toLowerCase() === "smarthands")    return "SmartHands";
  if (s === "CC_INSTALLS"   || s.toLowerCase() === "ccinstalls")    return "CCInstalls";
  if (s === "TROUBLE_TICKETS" || s.toLowerCase() === "troubletickets") return "TroubleTickets";
  return s;
}

/**
 * Returns true if a ticket status indicates it should be closed.
 */
export function isClosedStatus(status) {
  const s = String(status || "").toLowerCase();
  return (
    s.includes("closed")    ||
    s.includes("completed") ||
    s.includes("cancelled") ||
    s.includes("canceled")
  );
}

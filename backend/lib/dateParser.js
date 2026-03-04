/* ------------------------------------------------ */
/* lib/dateParser.js                                */
/* Pure date parsing functions for queue ingestion. */
/* Supports: DE (DD.MM.YYYY), US (M/d/yyyy h:mm),  */
/* ISO-like strings.                                */
/* ------------------------------------------------ */

/**
 * Parse a date string (DE, US, or ISO) to milliseconds.
 * Returns null if unparseable.
 */
export function parseCommitDateToMs(v) {
  if (!v) return null;
  const txt = String(v).trim();
  if (!txt) return null;

  // DE: DD.MM.YYYY [HH:MM[:SS]]
  const de = txt.match(
    /^([0-9]{1,2})\.([0-9]{1,2})\.([0-9]{4})(?:\s+([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?)?$/
  );
  if (de) {
    const dd   = Number(de[1]);
    const mm   = Number(de[2]);
    const yyyy = Number(de[3]);
    const hh   = Number(de[4] || 0);
    const mi   = Number(de[5] || 0);
    const ss   = Number(de[6] || 0);
    const d    = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }

  // US: M/d/yyyy, h:mm[:ss] AM/PM  (Jarvis EMEA sends this format)
  const us = txt.match(
    /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4}),?\s+([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?\s*(AM|PM)$/i
  );
  if (us) {
    const mm   = Number(us[1]);
    const dd   = Number(us[2]);
    const yyyy = Number(us[3]);
    let hh     = Number(us[4]);
    const mi   = Number(us[5]);
    const ss   = Number(us[6] || 0);
    const ampm = (us[7] || "").toUpperCase();
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }

  // US date-only: M/d/yyyy (no time)
  const usDateOnly = txt.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
  if (usDateOnly) {
    const mm   = Number(usDateOnly[1]);
    const dd   = Number(usDateOnly[2]);
    const yyyy = Number(usDateOnly[3]);
    const d    = new Date(yyyy, mm - 1, dd);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }

  // ISO-like: YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]
  const iso = txt.replace(" ", "T");
  const d   = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

/**
 * Parse any supported date format to ISO string.
 * Returns null if unparseable.
 */
export function parseAnyDateToIso(v) {
  if (!v) return null;
  const txt = String(v).trim();
  if (!txt) return null;

  const ms = parseCommitDateToMs(txt);
  if (ms !== null) {
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  const d = new Date(txt);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/**
 * Format a remaining time string from a commit date.
 * Returns "" if date is unparseable.
 */
export function formatRemainingFromCommit(commitDate) {
  const ms = parseCommitDateToMs(commitDate);
  if (ms === null) return "";
  const diffMin = Math.round((ms - Date.now()) / 60000);
  const sign    = diffMin < 0 ? -1 : 1;
  const abs     = Math.abs(diffMin);

  const days  = Math.floor(abs / (24 * 60));
  const hours = Math.floor((abs - days * 24 * 60) / 60);
  const mins  = abs - days * 24 * 60 - hours * 60;

  const sgn = sign < 0 ? "-" : "";
  return `${sgn}${days} D ${sgn}${hours} H ${sgn}${mins} M`;
}

/**
 * Calculate remaining hours from a commit date.
 * Returns null if unparseable.
 */
export function remainingHoursFromCommit(commitDate) {
  const ms = parseCommitDateToMs(commitDate);
  if (ms === null) return null;
  return (ms - Date.now()) / 3600000;
}

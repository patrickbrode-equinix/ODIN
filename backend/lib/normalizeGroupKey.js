/* ------------------------------------------------ */
/* lib/normalizeGroupKey.js                         */
/* Canonical group key normalization (kebab-case).  */
/* ------------------------------------------------ */

/**
 * Normalizes a group/department key to lowercase kebab-case.
 * Examples: "C_OPS" → "c-ops", "F OPS" → "f-ops"
 */
export function normalizeGroupKey(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return key || "other";
}

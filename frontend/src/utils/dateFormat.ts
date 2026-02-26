/* ------------------------------------------------ */
/* GLOBAL DATE & TIME FORMAT HELPERS                */
/* ------------------------------------------------ */

/**
 * Wandelt ISO- oder DB-Timestamp in deutsches Format um:
 * Ergebnis: "19.12.2025, 03:12:55"
 */
export const formatTimestamp = (ts: string | Date) => {
  if (!ts) return "";
  const date = new Date(ts);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
};

/**
 * Nutzt commitDate ("2025-12-19") + commitTime ("03:12")
 * Ergebnis: "19.12.2025 – 03:12"
 */
export const formatCommit = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return "";

  const [year, month, day] = dateStr.split("-");

  return `${day}.${month}.${year} – ${timeStr}`;
};

/**
 * Reines deutsches Datum ohne Uhrzeit
 * Ergebnis: "19.12.2025"
 */
export const formatDate = (ts: string | Date) => {
  const date = new Date(ts);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

/**
 * Reine Uhrzeit
 * Ergebnis: "03:12"
 */
export const formatTime = (ts: string | Date) => {
  const date = new Date(ts);

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

/* ------------------------------------------------ */
/* DATE FORMAT – MONTH LABEL (I18N READY)           */
/* ------------------------------------------------ */

export function formatMonthLabel(
  year: number,
  month: number,
  locale: "de-DE" | "en-US" = "de-DE"
) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

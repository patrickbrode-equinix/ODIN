/* ------------------------------------------------ */
/* SHIFTPLAN EXCEL IMPORTER – VARIANTE B (BULLETPROOF) 
   Monatslogik: SheetName → Primär
   Header → Backup
   Jahreswechsel: Dezember → Januar → Februar sicher erkannt
/* ------------------------------------------------ */

import * as XLSX from "xlsx";

/* ------------------------------------------------ */
/* BEKANNTE SCHICHTCODES                           */
/* ------------------------------------------------ */

const KNOWN_SHIFT_CODES = [
  "E1","E2","L1","L2","N","FS","ABW",
  "U","UR","URB","K","S","55","NA","NACHT",
];

/* ------------------------------------------------ */
/* MONATSNAMEN                                      */
/* ------------------------------------------------ */

const MONTHS_DE_EN: Record<string, number> = {
  // Deutsch
  januar: 1, jan: 1,
  februar: 2, feb: 2,
  märz: 3, maerz: 3, mrz: 3,
  april: 4, apr: 4,
  mai: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  dezember: 12, dez: 12,

  // Englisch
  january: 1,
  february: 2,
  march: 3,
  april_en: 4,
  may: 5,
  june: 6,
  july: 7,
  august_en: 8,
  september_en: 9,
  october: 10,
  november_en: 11,
  december: 12,
};

/* ------------------------------------------------ */
/* HELFER                                            */
/* ------------------------------------------------ */

function normalizeShift(val: any) {
  if (!val) return "";
  const v = String(val).trim().toUpperCase();
  if (!v) return "";
  if (v.startsWith("ABW")) return "ABW";
  if (v === "NACHT") return "N";
  if (v === "55") return "OTHER";
  return KNOWN_SHIFT_CODES.includes(v) ? v : "OTHER";
}

function looksLikeName(val: any): boolean {
  if (typeof val !== "string") return false;
  const s = val.trim();
  if (!s) return false;
  if (s.length < 3) return false;
  if (/[0-9]/.test(s)) return false;
  if (KNOWN_SHIFT_CODES.includes(s.toUpperCase())) return false;
  if (s.includes(",") || s.includes(" ")) return true;
  return s.length >= 5;
}

function parseDayNumber(val: any): number | null {
  const n = Number(String(val).trim());
  return n >= 1 && n <= 31 ? n : null;
}

/* ------------------------------------------------ */
/* MONAT/Jahr aus SheetName EXTRAHIEREN             */
/* ------------------------------------------------ */

function parseMonthYearFromSheetName(name: string) {
  const lower = name.toLowerCase();

  let detectedMonth: number | null = null;
  let detectedYear: number | null = null;

  for (const key of Object.keys(MONTHS_DE_EN)) {
    if (lower.includes(key)) {
      detectedMonth = MONTHS_DE_EN[key];
      break;
    }
  }

  const yearMatch = lower.match(/20[0-9]{2}/);
  if (yearMatch) detectedYear = Number(yearMatch[0]);

  return { month: detectedMonth, year: detectedYear };
}

/* ------------------------------------------------ */
/* BACKUP: Monat/Jahr aus Header-Zeilen             */
/* ------------------------------------------------ */

function extractMonthYearFromHeader(text: string) {
  const lower = text.toLowerCase();

  let month: number | undefined;
  for (const key of Object.keys(MONTHS_DE_EN)) {
    if (lower.includes(key)) {
      month = MONTHS_DE_EN[key];
      break;
    }
  }

  const yearMatch = lower.match(/20[0-9]{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : undefined;

  return { month, year };
}

/* ------------------------------------------------ */
/* HAUPTFUNKTION                                    */
/* ------------------------------------------------ */

export async function parseShiftplanExcel(file: File | Blob | ArrayBuffer) {
  const buffer =
    file instanceof ArrayBuffer
      ? file
      : file instanceof Blob
      ? await file.arrayBuffer()
      : await (file as File).arrayBuffer();

  const workbook = XLSX.read(buffer, { type: "array" });
  const result: any = {};

  let lastYearForReference = null; // Für Jahreswechsel

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    if (rows.length < 3) continue;

    /* ------------------------------------------------ */
    /* 1) Monat + Jahr bestimmen                         */
    /* ------------------------------------------------ */

    let { month, year } = parseMonthYearFromSheetName(sheetName);

    // Backup: Header scannen falls SheetName nicht genug Info hat
    if (!month || !year) {
      for (let r = 0; r < 5; r++) {
        for (const cell of rows[r] || []) {
          if (typeof cell === "string") {
            const info = extractMonthYearFromHeader(cell);
            if (!month && info.month) month = info.month;
            if (!year && info.year) year = info.year;
          }
        }
      }
    }

    // Wenn Monat fehlt → Skip
    if (!month) continue;

    // Jahreswechsel-Logik (B)
    if (!year) {
      if (month === 1 && lastYearForReference) {
        year = lastYearForReference + 1;
      } else {
        year = new Date().getFullYear();
      }
    }

    lastYearForReference = year;

    const monthId = `${year}-${String(month).padStart(2, "0")}`;
    const label = `${Object.keys(MONTHS_DE_EN).find(
      (k) => MONTHS_DE_EN[k] === month && !k.includes("_")
    )?.replace(/^\w/, (a) => a.toUpperCase())} ${year}`;

    /* ------------------------------------------------ */
    /* 2) Kopfzeile mit Tagen finden                    */
    /* ------------------------------------------------ */

    let dayRowIndex = -1;
    let dayCols: { colIndex: number; day: number }[] = [];

    for (let r = 0; r < 20; r++) {
      const row = rows[r];
      if (!row) continue;

      const temp = [];

      for (let c = 0; c < row.length; c++) {
        const d = parseDayNumber(row[c]);
        if (d !== null) temp.push({ colIndex: c, day: d });
      }

      if (temp.length >= 3) {
        dayRowIndex = r;
        dayCols = temp;
        break;
      }
    }

    if (dayRowIndex === -1) continue;

    /* ------------------------------------------------ */
    /* 3) Namensspalte                                 */
    /* ------------------------------------------------ */

    let nameCol = -1;
    let bestScore = 0;

    for (let c = 0; c < rows[0].length; c++) {
      let score = 0;
      for (let r = dayRowIndex + 1; r < rows.length; r++) {
        if (looksLikeName(rows[r]?.[c])) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        nameCol = c;
      }
    }

    if (nameCol === -1) continue;

    /* ------------------------------------------------ */
    /* 4) Daten auslesen                                */
    /* ------------------------------------------------ */

    const employees = [];
    const usedDays = new Set<number>();

    for (let r = dayRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      const name = row[nameCol];
      if (!looksLikeName(name)) continue;

      const shifts: any = {};

      for (const { colIndex, day } of dayCols) {
        const raw = row[colIndex];
        const code = normalizeShift(raw);
        if (!code) continue;

        shifts[day] = code;
        usedDays.add(day);
      }

      if (Object.keys(shifts).length > 0) {
        employees.push({ name: String(name).trim(), shifts });
      }
    }

    if (employees.length === 0) continue;

    /* ------------------------------------------------ */
    /* 5) Max benutzten Tag bestimmen                   */
    /* ------------------------------------------------ */

    const daysInMonth =
      usedDays.size > 0 ? Math.max(...Array.from(usedDays)) : 31;

    /* ------------------------------------------------ */
    /* 6) Ergebnis speichern                             */
    /* ------------------------------------------------ */

    result[monthId] = {
      meta: { id: monthId, label, year, month, daysInMonth },
      employees,
    };
  }

  return result;
}

/* ------------------------------------------------ */
/* UNIT TESTS – Shiftplan Excel Importer            */
/* Run: npx vitest run src/utils/shiftplanExcelImporter.test.ts */
/* ------------------------------------------------ */

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseShiftplanExcel, KNOWN_SHIFT_CODES, PENDING_REVIEW_CODES } from "./shiftplanExcelImporter";

/* ------------------------------------------------ */
/* HELPERS: create in-memory Excel workbooks         */
/* ------------------------------------------------ */

function makeWorkbook(sheets: Record<string, any[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/* ------------------------------------------------ */
/* CONSTANTS                                         */
/* ------------------------------------------------ */

describe("KNOWN_SHIFT_CODES", () => {
  it("includes core shift codes", () => {
    for (const code of ["E1", "E2", "L1", "L2", "N", "FS", "ABW", "L3", "U", "K"]) {
      expect(KNOWN_SHIFT_CODES).toContain(code);
    }
  });

  it("includes L3, FS, ABW (new codes)", () => {
    expect(KNOWN_SHIFT_CODES).toContain("L3");
    expect(KNOWN_SHIFT_CODES).toContain("FS");
    expect(KNOWN_SHIFT_CODES).toContain("ABW");
  });
});

describe("PENDING_REVIEW_CODES", () => {
  it("L3 marked as pending review", () => {
    expect(PENDING_REVIEW_CODES).toContain("L3");
  });
});

/* ------------------------------------------------ */
/* LAYOUT A: Classic (Month in A1, days row 3,       */
/*           names in col A)                          */
/* ------------------------------------------------ */

describe("Layout A – Classic Format", () => {
  it("parses a minimal Layout A sheet", async () => {
    const data = [
      ["Januar 2025"],           // A1 = month
      [],                         // row 2 blank
      [null, 1, 2, 3],           // row 3: days
      ["Mustermann, Max", "E1", "L1", "N"],
      ["Schmidt, Anna", "E2", "FS", "U"],
    ];
    const buf = makeWorkbook({ "Januar 2025": data });
    const result = await parseShiftplanExcel(buf);

    expect(result.log.some(l => l.level === "error")).toBe(false);
    expect(result.ignoredSheets.length).toBe(0);

    const sheet = Object.values(result.sheets)[0];
    expect(sheet).toBeDefined();
    expect(sheet.meta.month).toBe(1);
    expect(sheet.meta.year).toBe(2025);
    expect(sheet.meta.layout).toBe("A");
    expect(sheet.employees.length).toBe(2);

    const max = sheet.employees.find(e => e.name.includes("Mustermann"));
    expect(max).toBeDefined();
    expect(max!.shifts[1]).toBe("E1");
    expect(max!.shifts[2]).toBe("L1");
    expect(max!.shifts[3]).toBe("N");
  });

  it("normalizes shift aliases", async () => {
    const data = [
      ["Februar 2025"],
      [],
      [null, 1, 2, 3, 4, 5],
      ["Böhm, Test", "NACHT", "FREI", "E1", "L1", "N"],
    ];
    const buf = makeWorkbook({ "Feb 2025": data });
    const result = await parseShiftplanExcel(buf);

    const sheet = Object.values(result.sheets)[0];
    expect(sheet).toBeDefined();
    const emp = sheet.employees[0];
    expect(emp.shifts[1]).toBe("N");   // NACHT → N
    expect(emp.shifts[2]).toBe("FS");  // FREI → FS
  });

  it("logs unknown shift codes as warnings", async () => {
    const data = [
      ["März 2025"],
      [],
      [null, 1, 2, 3, 4, 5],
      ["Test, User", "XYZ", "E1", "L1", "N", "E2"],
    ];
    const buf = makeWorkbook({ "März 2025": data });
    const result = await parseShiftplanExcel(buf);

    expect(result.unknownCodes).toContain("XYZ");
    expect(result.log.some(l => l.level === "warn" && l.message.includes("XYZ"))).toBe(true);

    // Unknown code still imported as raw value
    const sheet = Object.values(result.sheets)[0];
    expect(sheet.employees[0].shifts[1]).toBe("XYZ");
  });
});

/* ------------------------------------------------ */
/* LAYOUT B: New Format ("Insert here ↓" in B1,     */
/*           days row 1 from C1, names in col B)     */
/* ------------------------------------------------ */

describe("Layout B – New Format", () => {
  it("parses a minimal Layout B sheet", async () => {
    const data = [
      [null, "Insert here ↓", 1, 2, 3],   // B1 = marker, C1+ = days
      [null, "Mustermann, Max", "E1", "L2", "N"],
      [null, "Schmidt, Anna", "L1", "E2", "FS"],
    ];
    const buf = makeWorkbook({ "Januar 2025": data });
    const result = await parseShiftplanExcel(buf);

    const sheet = Object.values(result.sheets)[0];
    expect(sheet).toBeDefined();
    expect(sheet.meta.layout).toBe("B");
    expect(sheet.employees.length).toBe(2);

    const max = sheet.employees.find(e => e.name.includes("Mustermann"));
    expect(max).toBeDefined();
    expect(max!.shifts[1]).toBe("E1");
    expect(max!.shifts[2]).toBe("L2");
    expect(max!.shifts[3]).toBe("N");
  });
});

/* ------------------------------------------------ */
/* MONTH PARSING                                     */
/* ------------------------------------------------ */

describe("Month parsing edge cases", () => {
  it("handles English month names", async () => {
    const data = [
      ["January 2025"],
      [],
      [null, 1, 2, 3, 4, 5],
      ["Test, User", "E1", "L1", "N", "E2", "FS"],
    ];
    const buf = makeWorkbook({ "January 2025": data });
    const result = await parseShiftplanExcel(buf);
    const sheet = Object.values(result.sheets)[0];
    expect(sheet).toBeDefined();
    expect(sheet.meta.month).toBe(1);
  });

  it("handles typo 'Feburary'", async () => {
    const data = [
      ["Feburary 2025"],
      [],
      [null, 1, 2, 3, 4, 5],
      ["Test, User", "E1", "L1", "N", "E2", "FS"],
    ];
    const buf = makeWorkbook({ "Feburary 2025": data });
    const result = await parseShiftplanExcel(buf);
    const sheet = Object.values(result.sheets)[0];
    expect(sheet).toBeDefined();
    expect(sheet.meta.month).toBe(2);
  });
});

/* ------------------------------------------------ */
/* MULTIPLE SHEETS                                   */
/* ------------------------------------------------ */

describe("Multi-sheet workbook", () => {
  it("parses multiple month sheets", async () => {
    const jan = [
      ["Januar 2025"],
      [],
      [null, 1, 2, 3, 4, 5],
      ["Test, User", "E1", "L1", "N", "E2", "FS"],
    ];
    const feb = [
      ["Februar 2025"],
      [],
      [null, 1, 2, 3, 4, 5],
      ["Test, User", "L1", "E1", "N", "E2", "FS"],
    ];
    const buf = makeWorkbook({ "Januar 2025": jan, "Februar 2025": feb });
    const result = await parseShiftplanExcel(buf);

    expect(Object.keys(result.sheets).length).toBe(2);
    expect(result.log.some(l => l.level === "error")).toBe(false);
  });

  it("ignores sheets that cannot be parsed", async () => {
    const valid = [
      ["Januar 2025"],
      [],
      [null, 1, 2, 3, 4, 5],
      ["Test, User", "E1", "L1", "N", "E2", "FS"],
    ];
    const invalid = [
      ["Some random content"],
      ["no days, no names"],
    ];
    const buf = makeWorkbook({ "Januar 2025": valid, "Notizen": invalid });
    const result = await parseShiftplanExcel(buf);

    expect(Object.keys(result.sheets).length).toBe(1);
    expect(result.ignoredSheets).toContain("Notizen");
  });
});

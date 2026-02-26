/* ------------------------------------------------ */
/* GERMAN FEDERAL HOLIDAYS (BUNDESWEIT)             */
/* ------------------------------------------------ */

export function getGermanFederalHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // Fixed Dates
  holidays.push(new Date(year, 0, 1));   // Neujahr (Jan 1)
  holidays.push(new Date(year, 4, 1));   // Tag der Arbeit (May 1)
  holidays.push(new Date(year, 9, 3));   // Tag der Deutschen Einheit (Oct 3)
  holidays.push(new Date(year, 11, 25)); // 1. Weihnachtstag (Dec 25)
  holidays.push(new Date(year, 11, 26)); // 2. Weihnachtstag (Dec 26)

  // Easter-based (Movable)
  // Gauss algorithm for Easter Sunday
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);

  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed month
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easterSunday = new Date(year, month, day);

  // Good Friday (Karfreitag): -2 days
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(easterSunday.getDate() - 2);
  holidays.push(goodFriday);

  // Easter Monday (Ostermontag): +1 day
  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterSunday.getDate() + 1);
  holidays.push(easterMonday);

  // Ascension Day (Christi Himmelfahrt): +39 days
  const ascensionDay = new Date(easterSunday);
  ascensionDay.setDate(easterSunday.getDate() + 39);
  holidays.push(ascensionDay);

  // Whit Monday (Pfingstmontag): +50 days
  const whitMonday = new Date(easterSunday);
  whitMonday.setDate(easterSunday.getDate() + 50);
  holidays.push(whitMonday);

  return holidays;
}

export function isGermanFederalHoliday(date: Date, holidays?: Date[]): boolean {
  const list = holidays || getGermanFederalHolidays(date.getFullYear());
  return list.some(h =>
    h.getDate() === date.getDate() &&
    h.getMonth() === date.getMonth() &&
    h.getFullYear() === date.getFullYear()
  );
}

// ALIAS for backward compatibility / cache issues
export const getGermanHolidaysNationwide = getGermanFederalHolidays;

export type HolidayMap = Record<string, string>;

export function getGermanHolidayMap(year: number): HolidayMap {
  const dates = getGermanFederalHolidays(year);
  const map: HolidayMap = {};
  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const names: Record<string, string> = {
    "01-01": "Neujahr",
    "05-01": "Tag der Arbeit",
    "10-03": "Tag der Deutschen Einheit",
    "12-25": "1. Weihnachtstag",
    "12-26": "2. Weihnachtstag",
  };

  // Helper to find name if fixed, else generic
  // Since getGermanFederalHolidays returns computed dates, we can map them back or just use a generic name if not found.
  // Actually, for simplicity and robustness, let's just properly name them inside getGermanFederalHolidays or returns objects.
  // But to not break existing signature, let's map by date.

  // Re-calculate for naming (or just return "Feiertag" for movable ones if we don't want to duplicate logic)
  // Optimization: Just label them "Feiertag" or map known dates.
  // Known movable:
  // Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag.

  dates.forEach(d => {
    const key = format(d);
    // Simple lookup for fixed
    const mmdd = key.substring(5);
    if (names[mmdd]) {
      map[key] = names[mmdd];
    } else {
      // Movable detection (simple check of order?)
      // We know the order from getGermanFederalHolidays:
      // Fixed 5, then Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag
      // But array might be sorted? The function pushes them in order of definition.
      // 0-4: Fixed (Jan, May, Oct, Dec, Dec)
      // 5: Karfreitag
      // 6: Ostermontag
      // 7: Himmelfahrt
      // 8: Pfingstmontag
      // Let's rely on array index if the function is stable.
      // Using indexOf in the original array is safer.
      const idx = dates.findIndex(x => x.getTime() === d.getTime());
      if (idx === 5) map[key] = "Karfreitag";
      else if (idx === 6) map[key] = "Ostermontag";
      else if (idx === 7) map[key] = "Christi Himmelfahrt";
      else if (idx === 8) map[key] = "Pfingstmontag";
      else map[key] = "Feiertag";
    }
  });

  return map;
}

/* ------------------------------------------------ */
/* HESSEN HOLIDAYS (Nationwide + Fronleichnam)      */
/* ------------------------------------------------ */

/**
 * Returns a HolidayMap (YYYY-MM-DD -> name) with nationwide + Hessen-specific holidays.
 * Hessen adds Fronleichnam (Easter +60) compared to the national baseline.
 */
export function getHessenHolidayMap(year: number): HolidayMap {
  const base = getGermanHolidayMap(year);

  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const ii = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * ii - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month, day);

  // Fronleichnam = Easter + 60 days (Hessen only)
  const fronleichnam = new Date(easter);
  fronleichnam.setDate(easter.getDate() + 60);

  const fmt = (dt: Date) => {
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  return { ...base, [fmt(fronleichnam)]: 'Fronleichnam' };
}

/**
 * Returns Date[] of all Hessen holidays for grid highlighting.
 */
export function getHessianHolidayDates(year: number): Date[] {
  const map = getHessenHolidayMap(year);
  return Object.keys(map).map(k => new Date(k + 'T00:00:00'));
}

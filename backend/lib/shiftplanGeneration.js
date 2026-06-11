/* ================================================ */
/* Shiftplan Generation Helpers                     */
/* ================================================ */

export function normalizePlanningShiftTypeKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'e' || normalized === 'early') return 'early';
  if (normalized === 'l' || normalized === 'late') return 'late';
  if (normalized === 'n' || normalized === 'night') return 'night';

  return normalized;
}

export function normalizeApplicableDays(value) {
  if (Array.isArray(value)) {
    return [...new Set(value
      .map((entry) => Number.parseInt(String(entry), 10))
      .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6))];
  }

  if (typeof value === 'string') {
    try {
      return normalizeApplicableDays(JSON.parse(value));
    } catch {
      return [0, 1, 2, 3, 4, 5, 6];
    }
  }

  return [0, 1, 2, 3, 4, 5, 6];
}

export function isShiftDefinitionApplicable(definition, dayOfWeek) {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return true;
  return normalizeApplicableDays(definition?.applicable_days).includes(dayOfWeek);
}

export function buildStaffingRulesByShiftType(rows = []) {
  const rules = {};

  for (const row of rows) {
    const key = normalizePlanningShiftTypeKey(row?.shift_type);
    if (!key) continue;
    const minCount = Number.parseInt(String(row?.min_count ?? 0), 10);
    if (!Number.isFinite(minCount) || minCount < 0) continue;
    rules[key] = Math.max(rules[key] || 0, minCount);
  }

  return rules;
}

export function buildShiftSlots(shiftDefinitions = [], staffingRules = {}, dayOfWeek = null) {
  const effectiveDefinitions = Number.isInteger(dayOfWeek)
    ? shiftDefinitions.filter((definition) => isShiftDefinitionApplicable(definition, dayOfWeek))
    : shiftDefinitions;
  const groupedDefinitions = new Map();

  for (const definition of effectiveDefinitions) {
    const typeKey = normalizePlanningShiftTypeKey(definition?.shift_type) || String(definition?.shift_type || 'other');
    if (!groupedDefinitions.has(typeKey)) groupedDefinitions.set(typeKey, []);
    groupedDefinitions.get(typeKey).push(definition);
  }

  const slotCounts = new Map();

  for (const definitions of groupedDefinitions.values()) {
    let baseCount = 0;
    for (const definition of definitions) {
      const minStaff = Math.max(Number.parseInt(String(definition?.min_staff ?? 0), 10) || 0, 0);
      slotCounts.set(definition.code, minStaff);
      baseCount += minStaff;
    }

    const typeKey = normalizePlanningShiftTypeKey(definitions[0]?.shift_type);
    const targetCount = Math.max(baseCount, Number.parseInt(String(staffingRules[typeKey] ?? 0), 10) || 0);
    let remaining = targetCount - baseCount;

    while (remaining > 0) {
      let placedExtraSlot = false;

      for (const definition of definitions) {
        if (remaining <= 0) break;

        const maxStaff = Math.max(Number.parseInt(String(definition?.max_staff ?? 0), 10) || 0, 0);
        const current = slotCounts.get(definition.code) || 0;

        if (maxStaff > 0 && current >= maxStaff) continue;

        slotCounts.set(definition.code, current + 1);
        remaining -= 1;
        placedExtraSlot = true;
      }

      if (!placedExtraSlot) break;
    }
  }

  return effectiveDefinitions.map((definition) => ({
    ...definition,
    planned_slots: slotCounts.get(definition.code) || 0,
  }));
}

export function getShiftDurationHours(definition) {
  const parsed = Number.parseFloat(String(definition?.duration_hours ?? 8));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

const HALF_DAY_SHIFT_CODE_PATTERN = /^H[EL]\d+$/i;
const NON_DRAFT_SHIFT_CODES = new Set(['ABW', 'FS', 'S', 'SEMINAR']);

export function isHalfDayShiftCode(code) {
  return HALF_DAY_SHIFT_CODE_PATTERN.test(String(code || '').trim());
}

export function isShiftDefinitionDraftPlannable(definition) {
  const code = String(definition?.code || '').trim().toUpperCase();
  const typeKey = normalizePlanningShiftTypeKey(definition?.shift_type);

  if (!code) return false;
  if (isHalfDayShiftCode(code)) return false;
  if (NON_DRAFT_SHIFT_CODES.has(code)) return false;
  if (typeKey === 'free' || typeKey === 'absent') return false;

  return true;
}

export function getShiftSeriesDays(definition) {
  const parsed = Number.parseInt(String(definition?.series_days ?? 1), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function buildDailyShiftSlots({
  shiftDefinitions = [],
  staffingRules = {},
  activeEmployees = [],
  employeeHours = {},
  employeeTargetHours = {},
  monthlyTargetHours = 174,
  day = 1,
  numDays = 31,
  dayOfWeek = null,
} = {}) {
  const baseSlots = buildShiftSlots(shiftDefinitions, staffingRules, dayOfWeek);
  const baselineTotalSlots = baseSlots.reduce((sum, definition) => sum + (definition.planned_slots || 0), 0);
  const maxTotalSlots = baseSlots.reduce((sum, definition) => {
    const maxStaff = Number.parseInt(String(definition?.max_staff ?? definition?.planned_slots ?? 0), 10);
    return sum + (Number.isFinite(maxStaff) && maxStaff > 0 ? maxStaff : (definition.planned_slots || 0));
  }, 0);

  const avgShiftHours = baseSlots.length > 0
    ? baseSlots.reduce((sum, definition) => sum + getShiftDurationHours(definition), 0) / baseSlots.length
    : 8;

  const targetHoursPerEmployee = Number.parseFloat(String(monthlyTargetHours ?? 174));
  const sanitizedTargetHours = Number.isFinite(targetHoursPerEmployee) && targetHoursPerEmployee >= 0
    ? targetHoursPerEmployee
    : 174;
  const workedHours = activeEmployees.reduce((sum, employee) => sum + (employeeHours[employee] || 0), 0);
  const targetHoursTotal = activeEmployees.reduce((sum, employee) => {
    const rawEmployeeTarget = Number.parseFloat(String(employeeTargetHours?.[employee] ?? ''));
    const employeeTarget = Number.isFinite(rawEmployeeTarget) && rawEmployeeTarget >= 0
      ? rawEmployeeTarget
      : sanitizedTargetHours;
    return sum + employeeTarget;
  }, 0);
  const remainingHours = Math.max(targetHoursTotal - workedHours, 0);
  const remainingDays = Math.max(numDays - day + 1, 1);
  const desiredTotalSlots = Math.ceil(remainingHours / remainingDays / avgShiftHours);
  const clampedTargetSlots = Math.max(baselineTotalSlots, Math.min(maxTotalSlots, desiredTotalSlots));
  let remainingExtraSlots = Math.max(clampedTargetSlots - baselineTotalSlots, 0);

  const slotCounts = new Map(baseSlots.map((definition) => [definition.code, definition.planned_slots || 0]));

  while (remainingExtraSlots > 0) {
    let placedExtraSlot = false;

    for (const definition of baseSlots) {
      if (remainingExtraSlots <= 0) break;

      const maxStaff = Number.parseInt(String(definition?.max_staff ?? definition?.planned_slots ?? 0), 10);
      const normalizedMaxStaff = Number.isFinite(maxStaff) && maxStaff > 0 ? maxStaff : (definition.planned_slots || 0);
      const currentCount = slotCounts.get(definition.code) || 0;

      if (currentCount >= normalizedMaxStaff) continue;

      slotCounts.set(definition.code, currentCount + 1);
      remainingExtraSlots -= 1;
      placedExtraSlot = true;
    }

    if (!placedExtraSlot) break;
  }

  return baseSlots.map((definition) => ({
    ...definition,
    planned_slots: slotCounts.get(definition.code) || 0,
  }));
}
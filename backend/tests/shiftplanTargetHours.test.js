import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildDailyShiftSlots } from '../lib/shiftplanGeneration.js';

describe('shiftplan target hours planning', () => {
  it('increases daily slots above minimum staffing when target hours would otherwise be missed', () => {
    const planned = buildDailyShiftSlots({
      shiftDefinitions: [
        { code: 'E1', shift_type: 'early', min_staff: 1, max_staff: 5, duration_hours: 8 },
        { code: 'E2', shift_type: 'early', min_staff: 1, max_staff: 5, duration_hours: 8 },
        { code: 'L1', shift_type: 'late', min_staff: 1, max_staff: 5, duration_hours: 8 },
        { code: 'L2', shift_type: 'late', min_staff: 1, max_staff: 5, duration_hours: 8 },
        { code: 'N', shift_type: 'night', min_staff: 1, max_staff: 3, duration_hours: 8 },
      ],
      staffingRules: { early: 2, late: 2, night: 1 },
      activeEmployees: Array.from({ length: 20 }, (_, index) => `Emp ${index + 1}`),
      employeeHours: {},
      monthlyTargetHours: 174,
      day: 1,
      numDays: 31,
    });

    const totalSlots = planned.reduce((sum, entry) => sum + entry.planned_slots, 0);
    assert.ok(totalSlots > 5);
    assert.ok(totalSlots <= 23);
  });

  it('falls back to baseline slots once the target hours are already reached', () => {
    const employees = ['Alice', 'Bob'];
    const planned = buildDailyShiftSlots({
      shiftDefinitions: [
        { code: 'E1', shift_type: 'early', min_staff: 1, max_staff: 3, duration_hours: 8 },
        { code: 'L1', shift_type: 'late', min_staff: 1, max_staff: 3, duration_hours: 8 },
      ],
      staffingRules: { early: 1, late: 1 },
      activeEmployees: employees,
      employeeHours: { Alice: 174, Bob: 174 },
      monthlyTargetHours: 174,
      day: 20,
      numDays: 31,
    });

    assert.deepEqual(planned.map((entry) => entry.planned_slots), [1, 1]);
  });
});
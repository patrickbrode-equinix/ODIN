import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildShiftSlots,
  buildStaffingRulesByShiftType,
  normalizePlanningShiftTypeKey,
} from '../lib/shiftplanGeneration.js';

describe('shiftplanGeneration helpers', () => {
  it('normalizes staffing rule keys from legacy E/L/N format', () => {
    assert.equal(normalizePlanningShiftTypeKey('E'), 'early');
    assert.equal(normalizePlanningShiftTypeKey('L'), 'late');
    assert.equal(normalizePlanningShiftTypeKey('N'), 'night');
  });

  it('builds staffing rules keyed by planning shift type', () => {
    const rules = buildStaffingRulesByShiftType([
      { shift_type: 'E', min_count: 4 },
      { shift_type: 'L', min_count: 3 },
      { shift_type: 'night', min_count: 2 },
    ]);

    assert.deepEqual(rules, {
      early: 4,
      late: 3,
      night: 2,
    });
  });

  it('distributes staffing headcount across shift definitions without duplicating whole-type minima', () => {
    const planned = buildShiftSlots([
      { code: 'E1', shift_type: 'early', min_staff: 1, max_staff: 3 },
      { code: 'E2', shift_type: 'early', min_staff: 1, max_staff: 3 },
      { code: 'L1', shift_type: 'late', min_staff: 1, max_staff: 3 },
      { code: 'L2', shift_type: 'late', min_staff: 1, max_staff: 3 },
      { code: 'N', shift_type: 'night', min_staff: 1, max_staff: 2 },
    ], {
      early: 4,
      late: 2,
      night: 1,
    });

    assert.deepEqual(
      planned.map((entry) => ({ code: entry.code, planned_slots: entry.planned_slots })),
      [
        { code: 'E1', planned_slots: 2 },
        { code: 'E2', planned_slots: 2 },
        { code: 'L1', planned_slots: 1 },
        { code: 'L2', planned_slots: 1 },
        { code: 'N', planned_slots: 1 },
      ]
    );
  });
});
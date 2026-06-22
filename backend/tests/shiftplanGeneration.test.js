import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyFixedShiftSeriesPattern,
  buildDailyShiftSlots,
  buildShiftSlots,
  buildStaffingRulesByShiftType,
  canStartShiftSeries,
  getShiftContinuityAdjustment,
  getPreferenceShiftCode,
  getTargetHoursScore,
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

  it('uses per-employee monthly target hours when sizing daily slots', () => {
    const planned = buildDailyShiftSlots({
      shiftDefinitions: [
        { code: 'E1', shift_type: 'early', min_staff: 0, max_staff: 3, duration_hours: 8 },
      ],
      staffingRules: {},
      activeEmployees: ['Alice', 'Bob'],
      employeeHours: { Alice: 0, Bob: 0 },
      employeeTargetHours: { Alice: 160, Bob: 0 },
      monthlyTargetHours: 174,
      day: 1,
      numDays: 20,
      dayOfWeek: 1,
    });

    assert.deepEqual(
      planned.map((entry) => ({ code: entry.code, planned_slots: entry.planned_slots })),
      [
        { code: 'E1', planned_slots: 1 },
      ]
    );
  });

  it('keeps a stable shift block preferable without overpowering employee wishes', () => {
    assert.deepEqual(
      getShiftContinuityAdjustment({
        previousCode: 'E1', previousType: 'early', previousDay: 5,
        nextCode: 'E1', nextType: 'early', day: 8,
      }),
      { score: 100, reason: 'Schichtkontinuität: E1 aus dem letzten Block fortgeführt' }
    );
    assert.equal(getShiftContinuityAdjustment({
      previousCode: 'E1', previousType: 'early', previousDay: 5,
      nextCode: 'L1', nextType: 'late', day: 8,
    }).score, -50);
    assert.equal(getShiftContinuityAdjustment({
      previousCode: 'E1', previousType: 'early', previousDay: 1,
      nextCode: 'L1', nextType: 'late', day: 10,
    }).score, 0);
  });

  it('maps weekend variants to the shift codes employees can select as wishes', () => {
    assert.equal(getPreferenceShiftCode('E1SA'), 'E1');
    assert.equal(getPreferenceShiftCode('E1WE'), 'E1');
    assert.equal(getPreferenceShiftCode('L1WE'), 'L1');
    assert.equal(getPreferenceShiftCode('N'), 'N');
  });

  it('enforces the fixed Monday-to-weekend series patterns', () => {
    assert.deepEqual(applyFixedShiftSeriesPattern({ code: 'E1SA', series_days: 1 }).applicable_days, [1, 2, 3, 4, 5, 6]);
    assert.equal(applyFixedShiftSeriesPattern({ code: 'E1SA', series_days: 1 }).series_days, 6);
    assert.equal(applyFixedShiftSeriesPattern({ code: 'E1WE', series_days: 1 }).series_days, 7);
    assert.equal(applyFixedShiftSeriesPattern({ code: 'L1WE', series_days: 1 }).series_days, 7);
    assert.equal(canStartShiftSeries({ day: 3, dayOfWeek: 1, definition: { code: 'E1WE', series_days: 7 } }), true);
    assert.equal(canStartShiftSeries({ day: 4, dayOfWeek: 2, definition: { code: 'E1WE', series_days: 7 } }), false);
    assert.equal(canStartShiftSeries({ day: 1, dayOfWeek: 6, definition: { code: 'N', series_days: 7 } }), false);
    assert.equal(canStartShiftSeries({ day: 4, dayOfWeek: 2, definition: { code: 'E1', series_days: 5 } }), true);
  });

  it('gives every employee below target priority over employees already at target', () => {
    assert.ok(
      getTargetHoursScore({ currentHours: 168, targetHours: 174 })
      > getTargetHoursScore({ currentHours: 176, targetHours: 174 })
    );
  });
});

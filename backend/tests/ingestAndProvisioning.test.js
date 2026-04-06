import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeletionPlan,
  isCrawlerConfirmedComplete,
  normalizeQueueMetaByType,
} from '../services/queueIngest.service.js';
import { buildProvisioningPlan } from '../services/shiftUserProvisioning.service.js';

describe('normalizeQueueMetaByType', () => {
  it('merges queuesMeta and array payload metadata into canonical queue types', () => {
    const metaByType = normalizeQueueMetaByType({
      queuesMeta: {
        smartHands: { complete: true, expected: 4, actual: 4, attempts: 1 },
      },
      queues: [
        {
          queueType: 'TroubleTickets',
          complete: true,
          items: [{ ticketKey: 'TT-1' }, { ticketKey: 'TT-2' }],
        },
      ],
    });

    assert.deepEqual(metaByType.SmartHands, {
      sourceQueueKey: 'smartHands',
      complete: true,
      expected: 4,
      actual: 4,
      attempts: 1,
    });
    assert.deepEqual(metaByType.TroubleTickets, {
      sourceQueueKey: 'TroubleTickets',
      complete: true,
      expected: 2,
      actual: 2,
      attempts: null,
    });
  });
});

describe('isCrawlerConfirmedComplete', () => {
  it('accepts crawler metadata only when actual equals expected', () => {
    assert.equal(isCrawlerConfirmedComplete({ complete: true, expected: 0, actual: 0 }), true);
    assert.equal(isCrawlerConfirmedComplete({ complete: true, expected: 3, actual: 2 }), false);
    assert.equal(isCrawlerConfirmedComplete({ complete: false, expected: 3, actual: 3 }), false);
  });
});

describe('buildDeletionPlan', () => {
  it('allows deletion when the crawler confirms a complete empty snapshot', () => {
    const plan = buildDeletionPlan({
      completeTypes: ['SmartHands'],
      beforeCountByType: { SmartHands: 12 },
      incomingCountByType: { SmartHands: 0 },
      queueMetaByType: {
        SmartHands: { complete: true, expected: 0, actual: 0 },
      },
    });

    assert.equal(plan.safeForDeletion.has('SmartHands'), true);
    assert.deepEqual(plan.deletionSkipped, {});
  });

  it('blocks deletion for suspiciously empty snapshots without crawler confirmation', () => {
    const plan = buildDeletionPlan({
      completeTypes: ['TroubleTickets'],
      beforeCountByType: { TroubleTickets: 9 },
      incomingCountByType: { TroubleTickets: 0 },
      queueMetaByType: {
        TroubleTickets: { complete: true, expected: 9, actual: 0 },
      },
    });

    assert.equal(plan.safeForDeletion.has('TroubleTickets'), false);
    assert.deepEqual(plan.deletionSkipped.TroubleTickets, {
      reason: 'empty_snapshot',
      before: 9,
      incoming: 0,
    });
  });
});

describe('buildProvisioningPlan', () => {
  it('creates one approved shiftplan user for duplicate employee rows', () => {
    const plan = buildProvisioningPlan({
      employees: [
        { employeeName: 'John Doe', email: '' },
        { employeeName: 'John Doe', email: '' },
      ],
      existingUsers: [],
    });

    assert.equal(plan.totalEmployees, 2);
    assert.equal(plan.uniqueEmployees, 1);
    assert.equal(plan.creates.length, 1);
    assert.deepEqual(plan.creates[0], {
      firstName: 'John',
      lastName: 'Doe',
      username: 'jdoe',
      email: 'john.doe@eu.equinix.com',
      group: 'c-ops',
      department: 'c-ops',
      ibx: 'FR2',
      approved: true,
      isAdmin: false,
      isRoot: false,
      mustChangePassword: true,
      provisionedFromShiftplan: true,
      provisionedEmployeeName: 'John Doe',
    });
  });

  it('updates matching existing users instead of creating duplicates', () => {
    const plan = buildProvisioningPlan({
      employees: [{ employeeName: 'Jane Doe', email: '' }],
      existingUsers: [{
        id: 7,
        email: 'jane.doe@eu.equinix.com',
        username: 'jdoe',
        first_name: 'Jane',
        last_name: 'Doe',
        approved: false,
        provisioned_from_shiftplan: false,
        provisioned_employee_name: null,
      }],
    });

    assert.equal(plan.matchedExisting, 1);
    assert.equal(plan.creates.length, 0);
    assert.deepEqual(plan.updates, [{
      userId: 7,
      email: 'jane.doe@eu.equinix.com',
      match: 'email',
      patch: {
        approved: true,
        provisionedFromShiftplan: true,
        provisionedEmployeeName: 'Jane Doe',
      },
    }]);
  });

  it('accepts email-like shiftplan entries as valid identities', () => {
    const plan = buildProvisioningPlan({
      employees: [{ employeeName: 'Patrick.Brode@eu.equinix.com', email: '' }],
      existingUsers: [],
    });

    assert.equal(plan.creates.length, 1);
    assert.deepEqual(plan.creates[0], {
      firstName: 'Patrick',
      lastName: 'Brode',
      username: 'pbrode',
      email: 'patrick.brode@eu.equinix.com',
      group: 'c-ops',
      department: 'c-ops',
      ibx: 'FR2',
      approved: true,
      isAdmin: false,
      isRoot: false,
      mustChangePassword: true,
      provisionedFromShiftplan: true,
      provisionedEmployeeName: 'Patrick.Brode@eu.equinix.com',
    });
    assert.deepEqual(plan.skipped, []);
  });

  it('deduplicates name and email forms of the same employee', () => {
    const plan = buildProvisioningPlan({
      employees: [
        { employeeName: 'Brode, Patrick', email: '' },
        { employeeName: 'patrick.brode@eu.equinix.com', email: '' },
      ],
      existingUsers: [],
    });

    assert.equal(plan.uniqueEmployees, 1);
    assert.equal(plan.creates.length, 1);
    assert.deepEqual(plan.skipped, []);
  });

  it('deduplicates email short forms against longer name variants', () => {
    const plan = buildProvisioningPlan({
      employees: [
        { employeeName: 'Hafez, Nora Adel Mahmoud', email: '' },
        { employeeName: 'nora.hafez@eu.equinix.com', email: '' },
      ],
      existingUsers: [],
    });

    assert.equal(plan.uniqueEmployees, 1);
    assert.equal(plan.creates.length, 1);
    assert.equal(plan.creates[0].email, 'nora.hafez@eu.equinix.com');
    assert.deepEqual(plan.skipped, []);
  });

  it('falls back to a unique email when a conflicting address belongs to another user', () => {
    const plan = buildProvisioningPlan({
      employees: [{ employeeName: 'John Doe', email: '' }],
      existingUsers: [{
        id: 8,
        email: 'john.doe@eu.equinix.com',
        username: 'jsmith',
        first_name: 'John',
        last_name: 'Smith',
        approved: true,
        provisioned_from_shiftplan: false,
        provisioned_employee_name: null,
      }],
    });

    assert.equal(plan.creates.length, 1);
    assert.equal(plan.creates[0].email, 'john.doe+odin2@eu.equinix.com');
    assert.equal(plan.creates[0].username, 'jdoe');
  });

  it('skips invalid employee names', () => {
    const plan = buildProvisioningPlan({
      employees: [{ employeeName: 'singletoken', email: '' }],
      existingUsers: [],
    });

    assert.equal(plan.creates.length, 0);
    assert.deepEqual(plan.skipped, [{ employeeName: 'singletoken', reason: 'invalid_name' }]);
  });
});
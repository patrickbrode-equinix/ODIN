import pool from '../Backend/db.js';
import { loadCandidateWorkers, loadWorkerCurrentTickets } from '../Backend/assignment/candidates/loadCandidates.js';
import { normalizeTicket } from '../Backend/assignment/normalization/normalizeTicket.js';
import { readTicketOwnerCandidates, resolveActiveExistingOwner, resolveOwnerAgainstWorkers } from '../Backend/assignment/lib/ownerIdentity.js';

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function toDisplay(value) {
  return value == null || value === '' ? '-' : String(value);
}

function summarizeWorkerLoads(workers, workerTicketsMap) {
  return workers
    .filter((worker) => worker.shiftActive !== false)
    .map((worker) => ({
      name: worker.name,
      shiftCode: worker.shiftCode || '-',
      jarvisOwnerCode: worker.jarvisOwnerCode || '-',
      currentTickets: (workerTicketsMap.get(worker.id) || []).length,
    }))
    .sort((left, right) => right.currentTickets - left.currentTickets || left.name.localeCompare(right.name, 'de', { sensitivity: 'base' }));
}

async function main() {
  const workers = await loadCandidateWorkers({ currentShiftOnly: 'true', planningWindowHours: '72' });
  const workerTicketsMap = await loadWorkerCurrentTickets(workers);

  const { rows } = await pool.query(`
    SELECT
      id,
      external_id,
      queue_type,
      status,
      owner,
      system_name,
      remaining_hours,
      updated_at,
      commit_date,
      sched_start,
      first_seen_at,
      severity,
      group_key,
      active
    FROM queue_items
    WHERE active = TRUE
    ORDER BY updated_at DESC NULLS LAST, id ASC
  `);

  const normalizedTickets = rows.map((row) => normalizeTicket(row));

  const ownedAudit = normalizedTickets
    .map((ticket) => {
      const ownerCandidates = readTicketOwnerCandidates(ticket);
      const rawOwner = ownerCandidates[0] || null;
      const activeOwner = resolveActiveExistingOwner(ticket, workers);
      const anyKnownOwner = resolveOwnerAgainstWorkers(ticket, workers, { activeOnly: false });
      const recommendedAction = activeOwner
        ? 'keep_existing_owner'
        : anyKnownOwner
        ? 'eligible_for_reassign_owner_off_shift'
        : rawOwner
        ? 'manual_review_unknown_owner'
        : 'unowned_assignable';

      return {
        id: ticket.id,
        externalId: ticket.externalId || '-',
        queueType: ticket.queue || ticket.type || '-',
        status: ticket.status || '-',
        rawOwner: rawOwner || '-',
        activeOwner: activeOwner?.name || '-',
        knownOwner: anyKnownOwner?.name || '-',
        knownOwnerShiftActive: anyKnownOwner ? String(anyKnownOwner.shiftActive !== false) : '-',
        systemName: ticket.systemName || '-',
        remainingHours: ticket.remainingHours ?? '-',
        updatedAt: ticket.raw?.updated_at ? new Date(ticket.raw.updated_at).toISOString() : '-',
        recommendedAction,
      };
    });

  const activeOwnerCount = ownedAudit.filter((row) => row.recommendedAction === 'keep_existing_owner').length;
  const offShiftReassignCount = ownedAudit.filter((row) => row.recommendedAction === 'eligible_for_reassign_owner_off_shift').length;
  const unknownOwnerCount = ownedAudit.filter((row) => row.recommendedAction === 'manual_review_unknown_owner').length;

  printSection('Summary');
  console.log(JSON.stringify({
    totalActiveTickets: normalizedTickets.length,
    activeWorkersInShift: workers.filter((worker) => worker.shiftActive !== false).length,
    ticketsWithActiveOwnerInShift: activeOwnerCount,
    ticketsOwnedByKnownOffShiftWorker: offShiftReassignCount,
    ticketsWithUnknownOwner: unknownOwnerCount,
  }, null, 2));

  printSection('Active Worker Loads');
  console.table(summarizeWorkerLoads(workers, workerTicketsMap).slice(0, 25));

  printSection('Owner Off-Shift Candidates');
  console.table(ownedAudit.filter((row) => row.recommendedAction === 'eligible_for_reassign_owner_off_shift').slice(0, 50));

  printSection('Unknown Owner Candidates');
  console.table(ownedAudit.filter((row) => row.recommendedAction === 'manual_review_unknown_owner').slice(0, 50));

  printSection('Protected Active Owners');
  console.table(ownedAudit.filter((row) => row.recommendedAction === 'keep_existing_owner').slice(0, 50));

  const overloadedActiveWorkers = summarizeWorkerLoads(workers, workerTicketsMap)
    .filter((row) => row.currentTickets > 0)
    .slice(0, 10)
    .map((row) => `${row.name} (${row.shiftCode}) -> ${row.currentTickets}`);

  printSection('Top Load Snapshot');
  if (overloadedActiveWorkers.length === 0) {
    console.log('No active workers currently mapped to owned tickets.');
  } else {
    for (const line of overloadedActiveWorkers) {
      console.log(line);
    }
  }
}

try {
  await main();
} finally {
  await pool.end();
}
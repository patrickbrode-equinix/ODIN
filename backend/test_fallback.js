import db from './db.js';
async function run() {
    try {
        const activeQueueRes = await db.query("SELECT * FROM queue_items WHERE external_id IN ('56', '57', '58', '59')");
        const fallbackRows = activeQueueRes.rows.map(qi => ({
            ...qi,
            external_id: qi.external_id,
            id: qi.external_id,
            ticketNumber: qi.external_id,
            systemName: qi.system_name || (qi.details && (qi.details.systemName || qi.details.system_name)) || '',
            salesOrder: qi.details?.salesOrder || '',
            activityNumber: qi.external_id,
            activityType: qi.queue_type === 'TroubleTickets' ? 'TroubleTicket' : (qi.queue_type || 'Unknown'),
            activityStatus: qi.status || 'Open',
            owner: qi.owner || 'Unassigned',
            activitySubType: qi.subtype || '',
            group: qi.group_key || '',
            remainingRaw: qi.details?.remainingRaw || '',
            commitDate: qi.commit_date ? new Date(qi.commit_date).toISOString() : (qi.revised_commit_date ? new Date(qi.revised_commit_date).toISOString() : null),
        }));
        console.log(JSON.stringify(fallbackRows.map(r => ({ id: r.id, sysName: r.systemName, system_name: r.system_name })), null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

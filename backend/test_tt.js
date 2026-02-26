import db from './db.js';
async function run() {
    try {
        const res = await db.query("SELECT external_id, queue_type, system_name, details, revised_commit_date FROM queue_items WHERE queue_type = 'TroubleTickets' AND active = true ORDER BY updated_at DESC LIMIT 5");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

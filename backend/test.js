import db from './db.js';
async function run() {
    try {
        const res = await db.query("SELECT external_id, queue_type, system_name, commit_date, revised_commit_date, details FROM queue_items WHERE external_id IN ('56', '57', '58', '59')");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

import db from './db.js';

async function run() {
    try {
        const res = await db.query(`UPDATE queue_items SET subtype = 'Trouble Tickets', system_name = 'OES System Fixed' WHERE external_id IN ('56', '57', '58', '59')`);
        console.log('Fixed DB. Rows updated:', res.rowCount);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

run();

import db from './db.js';
import commitRouter from './routes/commit.js';
import express from 'express';
import request from 'supertest';

const app = express();
// mock jwt middleware
app.use((req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
});
app.use('/commit', commitRouter);

async function run() {
    const res = await request(app).get('/commit/latest');
    const payload = res.body.data;

    if (Array.isArray(payload)) {
        const subset = payload.filter(t => ['56', '57', '58', '59'].includes(String(t.external_id || t.ticketNumber || t.id)));
        console.log(JSON.stringify(subset, null, 2));
    } else {
        console.log('Payload data is not an array.');
    }

    process.exit(0);
}
run();

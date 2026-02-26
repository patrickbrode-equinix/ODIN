/* ------------------------------------------------ */
/* METRICS – SYSTEM + PROCESS (ESM)                  */
/* ------------------------------------------------ */

import express from "express";
import os from "os";

const router = express.Router();

/* ------------------------------------------------ */
/* HELPERS                                          */
/* ------------------------------------------------ */

function bytesToMB(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10; // 1 decimal
}

function cpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }

  return { idle, total };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sampleCpuUsagePct(sampleMs = 200) {
  const a = cpuSnapshot();
  await sleep(sampleMs);
  const b = cpuSnapshot();

  const idleDelta = b.idle - a.idle;
  const totalDelta = b.total - a.total;

  if (totalDelta <= 0) return null;

  const usage = 1 - idleDelta / totalDelta; // 0..1
  return Math.round(usage * 1000) / 10; // 1 decimal
}

/* ------------------------------------------------ */
/* GET /api/metrics                                  */
/* ------------------------------------------------ */

router.get("/", async (req, res) => {
  const mem = process.memoryUsage();

  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  const cpuCount = os.cpus().length;
  const [l1, l5, l15] = os.loadavg();

  const cpuUsagePct = await sampleCpuUsagePct(200);

  res.json({
    uptimeSec: Math.round(process.uptime()),
    process: {
      rssMB: bytesToMB(mem.rss),
      heapUsedMB: bytesToMB(mem.heapUsed),
      heapTotalMB: bytesToMB(mem.heapTotal),
    },
    system: {
      platform: process.platform,
      cpuCount,
      memTotalMB: bytesToMB(total),
      memFreeMB: bytesToMB(free),
      memUsedMB: bytesToMB(used),
      memUsedPct: Math.round((used / total) * 1000) / 10,
      cpuUsagePct, // <-- DAS ist für deine Anzeige im Header
      loadavg: {
        load1: Math.round(l1 * 100) / 100,
        load5: Math.round(l5 * 100) / 100,
        load15: Math.round(l15 * 100) / 100,
      },
      loadPct: {
        load1: Math.round((l1 / cpuCount) * 1000) / 10,
        load5: Math.round((l5 / cpuCount) * 1000) / 10,
        load15: Math.round((l15 / cpuCount) * 1000) / 10,
      },
    },
    pid: process.pid,
    node: process.version,
    timestamp: new Date().toISOString(),
  });
});

export default router;

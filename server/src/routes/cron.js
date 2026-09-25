'use strict';

const express = require('express');
const { getDb } = require('../config/database');
const { ok, cronAuth } = require('../middleware/http');
const scrapeService = require('../services/scrape.service');

const router = express.Router();

// POST /api/cron/scrape — called by cron-job.org every 2 hours.
// Protected by Authorization: Bearer <CRON_SECRET>. Overlap-guarded by a
// Postgres advisory lock held for the whole run (see db.withCronLock);
// scrape_runs rows are audit history, not the lock itself.
router.post('/cron/scrape', cronAuth, async (req, res, next) => {
  const t0 = Date.now();
  try {
    const db = await getDb();
    const gate = await db.withCronLock(async () => {
      const run = await db.tryStartRun('cron');
      try {
        const summary = await scrapeService.runAll(db, { trigger: 'cron', onlyDue: true });
        if (run) await db.finishRun(run.id, 'completed').catch(() => {});
        return { ...summary, runId: run ? run.id : null, durationMs: Date.now() - t0 };
      } catch (e) {
        if (run) await db.finishRun(run.id, 'failed').catch(() => {});
        throw e;
      }
    });
    if (!gate.acquired) {
      return ok(res, { processed: 0, successful: 0, failed: 0, skipped: 'previous run still active', durationMs: Date.now() - t0 });
    }
    ok(res, gate.result);
  } catch (e) { next(e); }
});

module.exports = router;

'use strict';

const express = require('express');
const { getDb } = require('../config/database');
const { ok, fail, cronAuth } = require('../middleware/http');
const scrapeService = require('../services/scrape.service');

const router = express.Router();

// POST /api/cron/scrape — called by cron-job.org every 2 hours.
// Protected by Authorization: Bearer <CRON_SECRET>. Overlap-guarded via scrape_runs.
router.post('/cron/scrape', cronAuth, async (req, res, next) => {
  const t0 = Date.now();
  try {
    const db = await getDb();
    const run = await db.tryStartRun('cron');
    if (!run) return ok(res, { processed: 0, successful: 0, failed: 0, skipped: 'previous run still active', durationMs: Date.now() - t0 });
    try {
      const summary = await scrapeService.runAll(db, { trigger: 'cron', onlyDue: true });
      await db.finishRun(run.id || run.runId || run.ID, 'completed').catch(() => {});
      ok(res, { ...summary, runId: run.id, durationMs: Date.now() - t0 });
    } catch (e) {
      await db.finishRun(run.id, 'failed').catch(() => {});
      throw e;
    }
  } catch (e) { next(e); }
});

module.exports = router;

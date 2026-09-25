'use strict';

const express = require('express');
const { z } = require('zod');
const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/http');
const productService = require('../services/product.service');
const scrapeService = require('../services/scrape.service');
const { attemptsToCsv } = require('../utils/csv');

const router = express.Router();

router.get('/health', (req, res) => ok(res, { status: 'ok', timestamp: new Date().toISOString() }));

// --- Product search ---
router.get('/products/search', async (req, res, next) => {
  try {
    const db = await getDb();
    const data = await productService.search(req.query.q || '', db);
    ok(res, data);
  } catch (e) { next(e); }
});

// --- Product details (+ cached options) ---
router.get('/products/:productId', async (req, res, next) => {
  try {
    const db = await getDb();
    const data = await productService.details(req.params.productId, db);
    ok(res, data);
  } catch (e) { next(e); }
});

// --- Track a product + option ---
const trackSchema = z.object({ productId: z.string().min(1), optionId: z.string().min(1) });
router.post('/tracked-products', async (req, res, next) => {
  try {
    const body = trackSchema.parse(req.body);
    const db = await getDb();
    const withOpts = await db.getProductWithOptions(body.productId);
    if (!withOpts) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found. Open it from search first.');
    const opt = (withOpts.options || []).find((o) => o.id === body.optionId);
    if (!opt) return fail(res, 400, 'OPTION_NOT_FOUND', 'Option does not belong to this product.');
    const { row, created } = await db.createTracked({ productId: withOpts.id, optionId: opt.id });
    res.status(created ? 201 : 200);
    ok(res, row);
  } catch (e) {
    if (e instanceof z.ZodError) return fail(res, 400, 'VALIDATION_ERROR', e.errors.map((x) => x.message).join('; '));
    next(e);
  }
});

router.get('/tracked-products', async (req, res, next) => {
  try {
    const db = await getDb();
    const list = await db.listTracked();
    // Attach latest successful scrape so cards can show current price/stock.
    const withLatest = await Promise.all(list.map(async (t) => ({
      ...t,
      latest: await db.latestHistory(t.id).catch(() => null),
    })));
    ok(res, withLatest);
  } catch (e) { next(e); }
});

router.get('/tracked-products/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const t = await db.getTracked(req.params.id);
    if (!t) return fail(res, 404, 'TRACKED_NOT_FOUND', 'Tracked product not found.');
    ok(res, { ...t, latest: await db.latestHistory(t.id).catch(() => null) });
  } catch (e) { next(e); }
});

router.patch('/tracked-products/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const t = await db.setTrackedActive(req.params.id, req.body.active !== false);
    if (!t) return fail(res, 404, 'TRACKED_NOT_FOUND', 'Tracked product not found.');
    ok(res, t);
  } catch (e) { next(e); }
});

// --- History / logs ---
router.get('/tracked-products/:id/history', async (req, res, next) => {
  try {
    const db = await getDb();
    ok(res, await db.getHistory(req.params.id, { limit: Number(req.query.limit) || 500 }));
  } catch (e) { next(e); }
});

router.get('/tracked-products/:id/logs', async (req, res, next) => {
  try {
    const db = await getDb();
    ok(res, await db.getAttempts(req.params.id, { limit: Number(req.query.limit) || 200 }));
  } catch (e) { next(e); }
});

// --- Manual scrape (same production service as cron) ---
router.post('/tracked-products/:id/scrape', async (req, res, next) => {
  try {
    const db = await getDb();
    const result = await scrapeService.runSingle(req.params.id, db, { headed: req.body && req.body.headed === true });
    ok(res, result);
  } catch (e) { next(e); }
});

// --- CSV export: every attempt, failures with blank price/stock ---
router.get('/export/scrape-history.csv', async (req, res, next) => {
  try {
    const db = await getDb();
    const csv = attemptsToCsv(await db.allAttemptsForExport());
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="scrape-history.csv"');
    res.send(csv);
  } catch (e) { next(e); }
});

module.exports = router;

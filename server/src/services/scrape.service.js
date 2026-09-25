'use strict';

// Scrape service: runs scrapeTrackedProduct, persists attempts + (only on
// validated success) price_history, updates tracking metadata, emits bonus
// events (PRICE_DROP / BACK_IN_STOCK / STRUCTURE_CHANGED).

const { scrapeTrackedProduct } = require('../scraper/index');
const { pool } = require('../utils/concurrency');
const { env } = require('../config/env');

async function runSingle(trackedId, db, { headed = false } = {}) {
  const tracked = await db.getTracked(trackedId);
  if (!tracked) throw Object.assign(new Error('Tracked product not found.'), { status: 404, code: 'TRACKED_NOT_FOUND' });

  const prevLatest = await db.latestHistory(trackedId).catch(() => null);
  const result = await scrapeTrackedProduct(tracked, { headed, db });

  for (const a of result.attempts) await db.insertAttempt(a);

  if (result.ok) {
    const scrapedAt = new Date().toISOString();
    await db.insertHistory({ trackedProductId: trackedId, price: result.data.price, stock: result.data.stock, scrapedAt });
    await db.touchTracked(trackedId, { success: true });
    await maybeEmitEvents(db, trackedId, prevLatest, result.data);
    return { success: true, data: result.data, attempts: result.attempts.length };
  }
  await db.touchTracked(trackedId, { success: false });
  return { success: false, errorCode: result.errorCode, errorMessage: result.errorMessage, attempts: result.attempts.length };
}

async function runAll(db, { trigger = 'manual', onlyDue = true } = {}) {
  const all = await db.listTracked();
  const due = all.filter((t) => t.active && (!onlyDue || isDue(t)));
  const results = await pool(due, env.SCRAPE_CONCURRENCY, (t) =>
    runSingle(t.id, db).then((r) => ({ id: t.id, ...r })).catch((e) => ({ id: t.id, success: false, errorMessage: e.message })));
  const vals = results.map((r) => r.value || r);
  const successful = vals.filter((v) => v.success).length;
  return { processed: vals.length, successful, failed: vals.length - successful, results: vals };
}

function isDue(t) {
  if (!t.lastScrapedAt) return true;
  const mins = (Date.now() - new Date(t.lastScrapedAt).getTime()) / 60000;
  return mins >= (t.scrapeIntervalMinutes || 120) - 1;
}

async function maybeEmitEvents(db, trackedId, prevLatest, data) {
  try {
    if (prevLatest) {
      if (Number(data.price) < Number(prevLatest.price ?? prevLatest.price)) {
        await db.insertEvent({ trackedProductId: trackedId, eventType: 'PRICE_DROP', message: `Price dropped from ${prevLatest.price} to ${data.price}.`, metadata: { from: Number(prevLatest.price), to: Number(data.price) } });
      }
      const prevStock = prevLatest.stock === true || prevLatest.stock === 'true' || prevLatest.stock === 1;
      if (!prevStock && data.stock === true) {
        await db.insertEvent({ trackedProductId: trackedId, eventType: 'BACK_IN_STOCK', message: `${data.productName} (${data.optionValue}) is back in stock.`, metadata: {} });
      }
    }
  } catch { /* events are best-effort */ }
}

module.exports = { runSingle, runAll };

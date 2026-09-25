'use strict';

// Headed demo CLI: npm run scrape:headed -- --tracked=<id>
// Uses the SAME production scrapeTrackedProduct with headless=false so the
// retry/fallback behavior can be observed and screen-recorded.

require('dotenv').config();
const { getDb } = require('./config/database');
const scrapeService = require('./services/scrape.service');

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--tracked='));
  const trackedId = arg ? arg.split('=')[1] : process.env.TRACKED_ID;
  if (!trackedId) {
    console.error('Usage: npm run scrape:headed -- --tracked=<trackedProductId>');
    process.exit(1);
  }
  const db = await getDb();
  console.log(`[headed] scraping ${trackedId} with visible browser...`);
  const result = await scrapeService.runSingle(trackedId, db, { headed: true });
  console.log(JSON.stringify(result, null, 2));
  await db.close();
  process.exit(result.success ? 0 : 2);
}

main().catch((e) => { console.error(e); process.exit(1); });

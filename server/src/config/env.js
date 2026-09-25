'use strict';

try {
  // eslint-disable-next-line global-require
  require('dotenv').config();
} catch { /* dotenv optional for tests */ }

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: num('PORT', 5000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  STORE_BASE_URL: (process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com').replace(/\/$/, ''),
  CRON_SECRET: process.env.CRON_SECRET || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  HTTP_TIMEOUT_MS: num('HTTP_TIMEOUT_MS', 10000),
  BROWSER_TIMEOUT_MS: num('BROWSER_TIMEOUT_MS', 20000),
  MAX_SCRAPE_ATTEMPTS: num('MAX_SCRAPE_ATTEMPTS', 3),
  SCRAPE_CONCURRENCY: num('SCRAPE_CONCURRENCY', 2),
  HEADLESS: process.env.HEADLESS !== 'false',
};

module.exports = { env };

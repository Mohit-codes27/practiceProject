'use strict';

function ok(res, data) {
  return res.json({ success: true, data });
}

function fail(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  if (process.env.NODE_ENV !== 'production') console.error(err);
  return fail(res, status, code, status === 500 ? 'Something went wrong.' : (err.message || 'Request failed.'));
}

function cronAuth(req, res, next) {
  const { env } = require('../config/env');
  // Allow empty CRON_SECRET in local dev only.
  if (!env.CRON_SECRET && env.NODE_ENV !== 'production') return next();
  // Defense in depth: if production somehow boots without a secret (the
  // startup check in index.js should already have refused), fail closed with
  // 503 instead of comparing against `Bearer ` (empty secret must NEVER pass).
  if (!env.CRON_SECRET) return fail(res, 503, 'CRON_MISCONFIGURED', 'Cron endpoint is not configured.');
  const header = req.headers.authorization || '';
  if (header === `Bearer ${env.CRON_SECRET}`) return next();
  return fail(res, 401, 'CRON_UNAUTHORIZED', 'Invalid cron secret.');
}

function requestLogger(req, res, next) {
  const t = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t}ms)`);
  });
  next();
}

module.exports = { ok, fail, errorHandler, cronAuth, requestLogger };

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { getDb } = require('./config/database');
const { requestLogger, errorHandler } = require('./middleware/http');
const api = require('./routes/api');
const cron = require('./routes/cron');
const logger = require('./utils/logger');

const app = express();
app.use(cors({ origin: env.NODE_ENV === 'production' ? env.FRONTEND_URL : true }));
app.use(express.json({ limit: '256kb' }));
app.use(requestLogger);

app.use('/api', api);
app.use('/api', cron);
app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
app.use(errorHandler);

const server = app.listen(env.PORT, async () => {
  try { await getDb(); } catch (e) { logger.error(e); }
  logger.info(`API listening on :${env.PORT} (store=${env.STORE_BASE_URL})`);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  server.close(async () => {
    try {
      const db = await getDb();
      await db.close();
    } catch { /* ignore */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;

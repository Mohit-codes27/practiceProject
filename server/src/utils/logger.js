'use strict';

// Structured logger. Falls back to console if pino isn't installed so unit
// tests and zero-setup runs never crash on a missing optional dependency.

let logger;
try {
  // eslint-disable-next-line global-require
  const pino = require('pino');
  logger = pino({ level: process.env.LOG_LEVEL || 'info' });
} catch {
  logger = {
    info: (...a) => console.log('[info]', ...a),
    warn: (...a) => console.warn('[warn]', ...a),
    error: (...a) => console.error('[error]', ...a),
    debug: (...a) => console.debug('[debug]', ...a),
  };
}

module.exports = logger;

'use strict';

// Retry policy: max 3 attempts per run, exponential backoff with jitter.
// Errors are classified so permanent misconfigurations fail fast instead of
// burning 3 browser launches.

const RETRYABLE = new Set([
  'HTTP_TIMEOUT', 'HTTP_5XX', 'HTTP_NETWORK', 'NAV_TIMEOUT', 'BROWSER_ERROR',
  'PRICE_NOT_FOUND', 'STOCK_UNKNOWN', 'CONSENT_BLOCKED', 'CHALLENGE_FAILED',
  'EXTRACT_TIMEOUT', 'STORE_FLAKY_DROP',
]);

const NON_RETRYABLE = new Set([
  'INVALID_CONFIG', 'PRODUCT_NOT_FOUND', 'OPTION_NOT_FOUND', 'OPTION_MISMATCH',
  'PRICE_INVALID', 'BAD_URL', 'BROWSER_NOT_INSTALLED', 'PLAYWRIGHT_NOT_INSTALLED',
]);

function isRetryable(code) {
  if (NON_RETRYABLE.has(code)) return false;
  return true; // unknown errors: retry (bounded by max attempts anyway)
}

function backoffMs(attempt /* 1-based, failed attempt number */, baseMs = 1000) {
  const exp = baseMs * 2 ** (attempt - 1); // 1s, 2s, 4s...
  const jitter = Math.random() * 300;
  return Math.round(exp + jitter);
}

module.exports = { RETRYABLE, NON_RETRYABLE, isRetryable, backoffMs };

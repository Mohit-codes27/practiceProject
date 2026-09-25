'use strict';

let stringifyFn = null;
try {
  // eslint-disable-next-line global-require
  stringifyFn = require('csv-stringify/sync').stringify;
} catch {
  stringifyFn = null; // fallback below (no deps installed)
}

function fallbackStringify(records, { header, columns }) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = records.map((r) => columns.map((c) => esc(r[c])).join(','));
  if (header) lines.unshift(columns.join(','));
  return lines.join('\n') + '\n';
}

// One row per scrape ATTEMPT (successes + failures). Failures keep blank price/stock.
function attemptsToCsv(rows) {
  const records = rows.map((a) => ({
    product_id: a.storeProductId || '',
    product_name: a.productName || '',
    selected_option: a.optionLabel || '',
    timestamp: toIso(a.startedAt || a.started_at || a.createdAt || a.created_at),
    price: a.price === null || a.price === undefined ? '' : String(a.price),
    stock: a.stock === null || a.stock === undefined ? '' : String(a.stock),
    outcome: a.status || '',
  }));
  return (stringifyFn || fallbackStringify)(records, { header: true, columns: ['product_id', 'product_name', 'selected_option', 'timestamp', 'price', 'stock', 'outcome'] });
}

function toIso(v) {
  try {
    return new Date(v).toISOString();
  } catch {
    return '';
  }
}

module.exports = { attemptsToCsv };

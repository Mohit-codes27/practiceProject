'use strict';

// Parsing / normalization / validation. Pure functions — unit tested in tests/.
// NEVER let a parse failure become price=0 or stock=false (anti-pattern). Return
// { ok:false } and let the caller retry/fail honestly.

function parsePrice(raw) {
  if (raw === null || raw === undefined) return { ok: false, reason: 'PRICE_NOT_FOUND' };
  let s = String(raw);
  // Convert full-width unicode digits to ASCII.
  s = s.replace(/[\uFF10-\uFF19]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));
  // The store glues invisible separators between split-span characters
  // (word joiners, zero-width spaces, nbsp, narrow nbsp, ... — the exact set
  // rotates with the layout). Instead of allow-listing separators, keep only
  // digits and ./,  — everything else (currency marks, spaces, joiners,
  // stray text) is noise. So "₹6<ZWSP>9<ZWSP>,9..." still parses as 69999.
  s = s.replace(/[^\d.,]/g, '');
  // "Rs. 69,999.00" (lakh format) / "69,999/- (incl. of all taxes)" / "69.999,00"
  // Number must START with a digit (so "Rs." / "No." prefixes can't glue to it).
  const m = s.match(/\d[\d.,]*/);
  if (!m) return { ok: false, reason: 'PRICE_NOT_FOUND' };
  let num = m[0];
  const hasComma = num.includes(',');
  const hasDot = num.includes('.');
  if (hasComma && hasDot) {
    // whichever separator comes last is the decimal separator
    if (num.lastIndexOf(',') > num.lastIndexOf('.')) num = num.replace(/\./g, '').replace(',', '.');
    else num = num.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    num = num.replace(/,/g, '');
  }
  const value = Number(num);
  if (!Number.isFinite(value)) return { ok: false, reason: 'PRICE_NOT_FOUND' };
  if (value < 0) return { ok: false, reason: 'PRICE_INVALID' };
  if (value === 0) return { ok: false, reason: 'PRICE_SUSPICIOUS_ZERO' }; // store never sells at 0
  return { ok: true, value: Math.round(value * 100) / 100 };
}

function parseStock(raw) {
  if (raw === null || raw === undefined) return { ok: false, reason: 'STOCK_UNKNOWN' };
  const s = String(raw).trim();
  if (/sold\s*out/i.test(s)) return { ok: true, value: false };
  const m = s.match(/(\d+)/);
  // Only accept KNOWN templates; anything else is unknown, never default false.
  if (m && /(units available|last few|available|stock:|ready to ship)/i.test(s)) {
    return { ok: true, value: Number(m[1]) > 0 };
  }
  return { ok: false, reason: 'STOCK_UNKNOWN' };
}

// The page can list several options; never take "the first price on the page".
// Here the option is chosen by clicking its chip before unlock, and the quote
// endpoint is keyed by option id, so matching = the clicked chip's label must
// equal the tracked option label (case-insensitive).
function matchOption(trackedLabel, clickedLabel) {
  if (!trackedLabel || !clickedLabel) return false;
  return String(trackedLabel).trim().toLowerCase() === String(clickedLabel).trim().toLowerCase();
}

function validateScraped(d) {
  if (!d) return { ok: false, code: 'EMPTY_RESULT', message: 'Empty scrape result.' };
  if (!d.storeProductId) return { ok: false, code: 'PRODUCT_ID_MISSING', message: 'Product id missing.' };
  if (!d.productName) return { ok: false, code: 'PRODUCT_NAME_MISSING', message: 'Product name missing.' };
  if (!d.optionValue) return { ok: false, code: 'OPTION_MISMATCH', message: 'Option identity not confirmed.' };
  if (typeof d.price !== 'number' || !Number.isFinite(d.price) || d.price <= 0) {
    return { ok: false, code: 'PRICE_INVALID', message: 'Price is not a valid positive number.' };
  }
  if (typeof d.stock !== 'boolean') return { ok: false, code: 'STOCK_UNKNOWN', message: 'Stock state unknown.' };
  if (!d.sourceUrl) return { ok: false, code: 'URL_MISSING', message: 'Source URL missing.' };
  return { ok: true };
}

module.exports = { parsePrice, parseStock, matchOption, validateScraped };

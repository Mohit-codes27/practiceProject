'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePrice, parseStock, matchOption, validateScraped } = require('../src/scraper/parser');
const { isRetryable, backoffMs } = require('../src/scraper/retry');
const { attemptsToCsv } = require('../src/utils/csv');

test('parsePrice handles store formats', () => {
  assert.equal(parsePrice('₹69,999').value, 69999);
  assert.equal(parsePrice('Rs. 69,999.00').value, 69999);
  assert.equal(parsePrice('₹69,999/- (incl. of all taxes)').value, 69999);
  assert.equal(parsePrice('₹69.999,00').value, 69999);
  assert.equal(parsePrice('⁠₹⁠69,999').value, 69999); // joiner separators
  assert.equal(parsePrice('６９９９９').value, 69999); // full-width digits
  // split-span invisible separators: every char glued with a different zero-width char
  assert.equal(parsePrice('₹⁠6⁠9⁠,⁠9⁠9⁠9').value, 69999); // word joiners U+2060
  assert.equal(parsePrice('₹​6​9​,​9​9​9').value, 69999); // zero-width spaces U+200B
  assert.equal(parsePrice('₹‍6‍9‍,‍9‍9‍9').value, 69999); // zero-width joiners U+200D
  assert.equal(parsePrice('₹ 6 9 , 9 9 9').value, 69999); // nbsp / narrow nbsp
  assert.equal(parsePrice('Member price ₹64,999').value, 64999); // stray text ignored
  assert.equal(parsePrice('₹₹₹').ok, false);
  assert.equal(parsePrice(null).ok, false);
  assert.equal(parsePrice('').ok, false);
  assert.equal(parsePrice('₹0').ok, false); // suspicious zero rejected
});

test('parseStock never fabricates state', () => {
  assert.deepEqual(parseStock('Sold out'), { ok: true, value: false });
  assert.deepEqual(parseStock('42 units available'), { ok: true, value: true });
  assert.deepEqual(parseStock('Last few: 2'), { ok: true, value: true });
  assert.equal(parseStock('In stock').ok, false); // unknown template -> unknown
  assert.equal(parseStock('').ok, false);
  assert.equal(parseStock(null).ok, false);
});

test('option matching is exact', () => {
  assert.equal(matchOption('256GB', '256GB'), true);
  assert.equal(matchOption('256GB', '512GB'), false);
  assert.equal(matchOption('Standard kit', 'standard kit'), true);
  assert.equal(matchOption('', 'x'), false);
});

test('validation rejects invalid scrapes', () => {
  assert.equal(validateScraped(null).ok, false);
  assert.equal(validateScraped({ storeProductId: '1', productName: 'p', optionValue: 'o', price: NaN, stock: true, sourceUrl: 'u' }).ok, false);
  assert.equal(validateScraped({ storeProductId: '1', productName: 'p', optionValue: 'o', price: 100, stock: 'yes', sourceUrl: 'u' }).ok, false);
  assert.equal(validateScraped({ storeProductId: '1', productName: 'p', optionValue: 'o', price: 100, stock: false, sourceUrl: 'u' }).ok, true);
});

test('retry classification', () => {
  assert.equal(isRetryable('HTTP_TIMEOUT'), true);
  assert.equal(isRetryable('PRICE_NOT_FOUND'), true);
  assert.equal(isRetryable('PRODUCT_NOT_FOUND'), false);
  assert.equal(isRetryable('OPTION_MISMATCH'), false);
  assert.ok(backoffMs(1) >= 1000 && backoffMs(2) >= 2000);
});

test('CSV keeps failures with blank price/stock', () => {
  const csv = attemptsToCsv([
    { storeProductId: '123', productName: 'Laptop', optionLabel: 'Storage:256GB', startedAt: '2026-09-25T10:00:00.000Z', price: null, stock: null, status: 'retried' },
    { storeProductId: '123', productName: 'Laptop', optionLabel: 'Storage:256GB', startedAt: '2026-09-25T10:00:03.000Z', price: 69999, stock: true, status: 'success' },
  ]);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'product_id,product_name,selected_option,timestamp,price,stock,outcome');
  assert.match(lines[1], /retried/);
  assert.match(lines[2], /69999,true,success/);
});

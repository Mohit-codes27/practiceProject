'use strict';

// Lightweight HTTP layer (axios + cheerio).
// Used for: catalog search, product details, manifest fetch, and an initial
// HTML probe that proves why Playwright is needed (SPA => no price in HTML).

const axios = require('axios');
const cheerio = require('cheerio');
const { env } = require('../config/env');
const { API } = require('./selectors');
const logger = require('../utils/logger');

function client(timeoutMs) {
  return axios.create({
    baseURL: env.STORE_BASE_URL,
    timeout: timeoutMs || env.HTTP_TIMEOUT_MS,
    headers: { 'User-Agent': 'INE-Price-Tracker/1.0 (+assignment; contact: student)' },
    validateStatus: () => true,
  });
}

function classifyHttp(status, err) {
  if (err && (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')) {
    return { code: 'HTTP_TIMEOUT', message: `Store did not respond within timeout (${err.message})`, retryable: true };
  }
  if (err) return { code: 'HTTP_NETWORK', message: err.message, retryable: true };
  if (status === 404) return { code: 'PRODUCT_NOT_FOUND', message: 'Store returned 404.', retryable: false };
  if (status >= 500) return { code: 'HTTP_5XX', message: `Store returned ${status}.`, retryable: true };
  if (status === 429) return { code: 'HTTP_5XX', message: 'Rate limited (429).', retryable: true };
  if (status >= 400) return { code: 'HTTP_4XX', message: `Store returned ${status}.`, retryable: false };
  return null;
}

async function fetchItem(storeProductId) {
  const t = Date.now();
  const http = client();
  const res = await http.get(API.item(storeProductId)).catch((e) => ({ error: e }));
  if (res.error) {
    const c = classifyHttp(0, res.error);
    return { ok: false, ...c, httpStatus: 0, durationMs: Date.now() - t };
  }
  const bad = classifyHttp(res.status);
  if (bad) return { ok: false, ...bad, httpStatus: res.status, durationMs: Date.now() - t };
  return { ok: true, item: res.data, durationMs: Date.now() - t };
}

async function fetchManifest() {
  const t = Date.now();
  const http = client();
  const res = await http.get(API.manifest).catch((e) => ({ error: e }));
  if (res.error) return { ok: false, code: 'HTTP_NETWORK', message: res.error.message, durationMs: Date.now() - t };
  if (res.status !== 200) return { ok: false, code: 'HTTP_5XX', message: `manifest ${res.status}`, durationMs: Date.now() - t };
  return { ok: true, manifest: res.data, durationMs: Date.now() - t };
}

// Partial/full-name search: page through listings, filter in memory.
async function searchProducts(query, { maxPages = 10, limit = 100 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { ok: true, results: [] };
  const http = client();
  const out = [];
  const seen = new Set(); // store pages can repeat/overlap items — never return dupes
  let totalPages = maxPages;
  for (let page = 1; page <= Math.min(totalPages, maxPages); page++) {
    const res = await http.get(API.listings(page, limit)).catch(() => null);
    if (!res || res.status !== 200) break;
    totalPages = res.data.totalPages || 1;
    for (const p of res.data.results || []) {
      if (seen.has(p.id)) continue;
      if ((p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)) {
        seen.add(p.id);
        out.push(p);
        if (out.length >= 30) return { ok: true, results: out };
      }
    }
    if (page >= totalPages) break;
  }
  return { ok: true, results: out };
}

// HTML probe: fetch the product page as HTML and show there is no price in it.
// Kept to honor "HTTP first, prove Playwright is necessary" + cheerio usage.
async function probeProductPageHtml(storeProductId) {
  const t = Date.now();
  const http = client();
  try {
    const res = await http.get(`/item/${encodeURIComponent(storeProductId)}`, { headers: { Accept: 'text/html' } });
    const $ = cheerio.load(res.data || '');
    const hasRoot = $('#root').length > 0;
    const bodyText = $('body').text();
    const hasPrice = /₹|Rs\.|price/i.test(bodyText);
    return { ok: true, hasRoot, hasPriceInHtml: hasPrice, durationMs: Date.now() - t, httpStatus: res.status };
  } catch (err) {
    return { ok: false, code: 'HTTP_NETWORK', message: err.message, durationMs: Date.now() - t };
  }
}

module.exports = { fetchItem, fetchManifest, searchProducts, probeProductPageHtml, classifyHttp, client };

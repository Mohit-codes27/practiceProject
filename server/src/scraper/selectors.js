'use strict';

// Store findings (inspected 2026-09-25, https://demo.inelabteamdev.com).
//
// The mock store is a client-side-rendered React SPA:
//   - GET / returns an empty <div id="root"> + one JS bundle. No product data in HTML,
//     so naive Cheerio selectors like `.price` can NEVER work. This is why the
//     pipeline tries lightweight HTTP first and falls back to Playwright.
//   - Catalog API:  GET /api/v2/listings?page=N&limit=M
//       -> { page, perPage, totalPages, count, results: [{id,name,brand,category,sku,description}] }
//     960 products. No server-side `q` param (frontend ignores it), so search is
//     implemented by paging through listings and filtering by name in memory.
//   - Item API:     GET /api/v2/items/:id
//       -> { id,name,brand,category,sku,description,specs,reviews,
//            optionAxis: "Kit"|"Storage"|..., options: [{id:"o1",label:"..."}] }
//   - Layout manifest: GET /api/v2/ui/manifest
//       -> { revision, classes:{priceWrap,priceValue,mrp,...}, order:[...],
//            priceTag:"span"|"strong"|..., priceCarrier:"split"|..., ... }
//     Class names + tag names + fact order ROTATE (revision changes). Selectors must
//     be read from the manifest at scrape time, never hardcoded. A revision change
//     fires a STRUCTURE_CHANGED event (bonus) but does not fail the scrape.
//   - Price/stock are GATED behind interaction + bot checks (deliberately awkward):
//       * price panel starts "locked"; requires hovering the price area
//         (>=8 mousemoves, >=600ms dwell) then clicking "Check today's price"
//       * random consent dialog (~75% of loads, random position, 1-3 dismissals)
//       * ~35% of navigations are delayed/dropped (client-side flakiness)
//       * price request needs canvas+webgl fingerprint, frame-timing sample,
//         hover snapshot, WASM proof-of-work + encrypted quote response
//       * up to 6 client-side retries with 300ms*n backoff
//       * price formatting rotates: default/lakh/spaced/euro/trailing/unicode/nbsp,
//         sometimes rendered as split spans with zero-width-joiner separators,
//         plus hidden decoy prices (display:none / data-price) that must be ignored
//       * stock text rotates: "N units available" | "Last few: N" | "Available (N)"
//         | "Stock: N remaining" | "Ready to ship — N available" | "Sold out"
  //   - Consequence for us: HTTP alone can fetch catalog/item/manifest but CANNOT
//     unlock price/stock (challenge needs a real browser). So the honest
//     description is: HTTP-first metadata acquisition + manifest lookup, with
//     Playwright performing the browser-gated price/stock extraction. (We do
//     NOT attempt HTTP price extraction first — the price endpoint requires a
//     live browser session, so that would always fail by design.)

const API = {
  listings: (page, limit) => `/api/v2/listings?page=${page}&limit=${limit}`,
  item: (id) => `/api/v2/items/${encodeURIComponent(id)}`,
  manifest: '/api/v2/ui/manifest',
};

// Selectors the store treats as STABLE app hooks (present in every observed
// bundle revision; selected by role/text, not by rotating classes).
const STABLE_SELECTORS = {
  consentBox: '.consent-box',
  summaryTitle: '.pdp-summary h1',
  productReady: '.pdp-summary, .offer-panel',
  panel: '.offer-panel',
  optionChip: '.opt-chip',
  row: '.offer-row',
  facts: '.offer-facts',
  ready: '.offer-ready',
  failed: '.offer-failed',
  unlockButton: '.offer-panel button.ctl-main',
  unlockButtonText: 'Check', // text fallback if control classes ever rotate
};

// Build the full selector set for one scrape. Everything the manifest rotates
// (priceValue, mrp, sale, badge, ...) comes from the manifest; anything the
// manifest doesn't cover falls back to a documented generic guess and the
// extractor's structural heuristics (longest digit run, line-through skip).
// Nothing rotating is hardcoded here.
function buildSelectors(manifest) {
  const classes = (manifest && manifest.classes) || {};
  const rotating = (name, fallback) => (classes[name] ? `.${classes[name]}` : fallback);
  return {
    ...STABLE_SELECTORS,
    priceValue: rotating('priceValue', '.price-value, [data-price="true"]'),
    priceWrap: rotating('priceWrap', null),
    mrp: rotating('mrp', null),
    sale: rotating('sale', null),
    badge: rotating('badge', null),
    rating: rotating('rating', null),
    seller: rotating('seller', null),
    delivery: rotating('delivery', null),
    stock: rotating('stock', null),
    priceTag: (manifest && manifest.priceTag) || null,
    priceCarrier: (manifest && manifest.priceCarrier) || null,
    manifestRevision: (manifest && manifest.revision) ?? null,
  };
}

module.exports = { API, STABLE_SELECTORS, buildSelectors };

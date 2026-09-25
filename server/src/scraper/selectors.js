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
//     unlock price/stock (challenge needs a real browser). So:
//       strategy "http"       -> metadata + manifest + structure fingerprint
//       strategy "playwright" -> full price/stock unlock (hover, consent, click,
//                                wait for .offer-ready, extract visible price only)

const API = {
  listings: (page, limit) => `/api/v2/listings?page=${page}&limit=${limit}`,
  item: (id) => `/api/v2/items/${encodeURIComponent(id)}`,
  manifest: '/api/v2/ui/manifest',
};

module.exports = { API };

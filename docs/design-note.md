# Design Note

## Scraping reliability — why HTTP first, Playwright second

The store is a React SPA: `GET /` returns an empty `<div id="root">`. No price
exists in HTML, so Cheerio selectors can never work for price — we proved this
with `probeProductPageHtml` instead of assuming it. HTTP (axios) handles
catalog (`/api/v2/listings`), item details (`/api/v2/items/:id`) and the UI
manifest (`/api/v2/ui/manifest`): fast, cheap, no browser. But price/stock are
gated behind hover-dwell tracking, a proof-of-work + WASM challenge and an
encrypted quote response that only a real browser session can complete, so
Playwright is the genuine fallback — used only where HTTP provably cannot work.

## Retries — why 3 attempts with exponential backoff + jitter

The store drops ~35% of navigations client-side and the price endpoint needs up
to 6 internal retries itself. One attempt would flake constantly; unbounded
retries would hang cron runs. 3 attempts (1s → 2s + jitter) absorbs transient
flakes while bounding a single product to ~1 minute. Errors are classified:
timeouts/5xx/parse-misses retry; bad config/404/option-mismatch fail fast.

## Validation — keeping garbage out of history

`parser.js` is pure and strict: `parsePrice` rejects null/NaN/zero-as-failure
(the store never legitimately sells at ₹0); `parseStock` only accepts known
templates ("N units available", "Sold out", …) and returns UNKNOWN otherwise —
never `false`-by-default. `validateScraped` re-checks id/name/option/price/stock
after extraction. Only then does `scrape.service.js` insert `price_history`.

## Honest logging — attempts vs history

`scrape_attempts` gets one row per attempt (`success|retried|failed`, nullable
price/stock); `price_history` gets a row only for validated success. A 3-attempt
run with 2 flakes shows 3 log rows and 1 history point — charts stay truthful
and interviewers can see the flakes.

## Scheduling — why cron-job.org, not setInterval

Render free tier sleeps; an in-process timer dies with the dyno and can double-
fire across instances. An external cron POSTing to a secret-protected endpoint
survives sleep. Overlap is guarded by `scrape_runs` (a new run refuses to start
if one is active <15 min). Per-product `scrape_interval_minutes` (default 120)
lets one 2-hour cron serve products with different frequencies via due-checks.

## Trade-offs

- HTTP is 100x cheaper than Chromium but blind to gated content — hence the split.
- Playwright per-scrape launch is slow (~5–15s) but leak-proof (`finally` close);
  a persistent browser would be faster but risks orphaned processes on Render.
- Concurrency 2: polite to the mock store, bounded memory, still parallel.
- In-memory DB fallback: zero-setup local dev; real history needs Postgres.
- Plain JS (not TS): chosen per request; Zod still validates API input at runtime.

## AI usage

- AI did: repo scaffold, boilerplate, and first-pass parsing of the store's
  obfuscated bundle (endpoints, gating logic, format rotation).
- Human must still: run headed scrape, verify selectors against live layout
  `revision`, accumulate 2–3 tracked products of real cron history before
  submission, and record the demo. Anything in `selectors.js` that drifts from
  the live site should be corrected there — it is the single source of truth.

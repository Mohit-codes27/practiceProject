# Architecture

```
Vercel (client/) ──REST──▶ Render (server/) ──pg──▶ Supabase Postgres
                                │  axios (listings/item/manifest)
                                │  Playwright (price unlock)
                                ▼
                    demo.inelabteamdev.com
cron-job.org ──POST /api/cron/scrape (Bearer secret)──▶ every 2h
```

## Backend layout (`server/src/`)

- `config/` — env, database (pg + in-memory fallback, same interface)
- `routes/` — `api.js` (products/tracking/history/logs/export), `cron.js`
- `services/` — `product.service.js`, `scrape.service.js` (persistence + events)
- `scraper/` — `index.js` (orchestrator), `http-scraper.js`, `playwright-scraper.js`,
  `parser.js`, `retry.js`, `selectors.js` (store findings), `structure-fingerprint.js`
- `middleware/http.js` — response envelope, cron auth, error handler
- `utils/` — logger, csv, concurrency pool

## Data flow (scheduled run)

cron → overlap check → due products → pool(2) → scrapeTrackedProduct →
persist attempts → (if valid) history + touch tracked + events → summary JSON.

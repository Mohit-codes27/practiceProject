import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTracked, useDetails } from '../hooks/useApi';
import { exportCsvUrl, scrapeNow } from '../api/client';
import TrackedCard from '../components/TrackedCard';
import PriceChart from '../components/PriceChart';
import { formatPrice, formatDate, stockLabel } from '../utils/format';

export function Dashboard() {
  const { data, loading, error, reload } = useTracked();
  const [scrapingId, setScrapingId] = useState(null);
  const [msg, setMsg] = useState('');

  async function onScrape(id) {
    setScrapingId(id);
    setMsg('Scrape started… (HTTP metadata → Playwright unlock → validation)');
    try {
      const r = await scrapeNow(id);
      setMsg(r.success ? `Success ✓ price ${formatPrice(r.data.price)}` : `Failed: ${r.errorCode} — logged honestly, no fake history.`);
      await reload();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setScrapingId(null);
    }
  }

  return (
    <section>
      <div className="row-between">
        <h1>Tracked Products {data.length ? `(${data.length})` : ''}</h1>
        <div>
          <Link className="btn" to="/search">+ Track a product</Link>{' '}
          <a className="btn" href={exportCsvUrl()}>Export CSV</a>
        </div>
      </div>
      {msg && <p className="note">{msg}</p>}
      {loading && <p>Loading…</p>}
      {error && <p className="error">Unable to load tracked products: {error} <button className="btn" onClick={reload}>Retry</button></p>}
      {!loading && !error && data.length === 0 && (
        <div className="empty">No tracked products yet. <Link to="/search">Search the store</Link> to start tracking.</div>
      )}
      <div className="grid">
        {data.map((t) => (
          <TrackedCard key={t.id} t={t} scraping={scrapingId === t.id} onScrape={onScrape} />
        ))}
      </div>
    </section>
  );
}

export function DetailsPage({ trackedId }) {
  const { tracked, history, logs, loading, error, reload, scrape, scraping } = useDetails(trackedId);
  const [msg, setMsg] = useState('');
  const autoTried = useRef(false);
  async function onScrape(first = false) {
    setMsg(first
      ? 'First scrape running automatically… (HTTP metadata → Playwright unlock → validation, can take ~30s)'
      : 'Scrape started… attempt 1: HTTP metadata → Playwright unlock…');
    try {
      const r = await scrape();
      setMsg(r.success ? `Success ✓ — history updated.` : `Failed (${r.errorCode}): ${r.errorMessage || 'no details'} — see log table below.`);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  }
  // A freshly tracked product has no history: run the first scrape automatically
  // so the user immediately sees current price/stock instead of empty panels.
  useEffect(() => {
    if (!loading && !error && tracked && history.length === 0 && logs.length === 0 && !autoTried.current) {
      autoTried.current = true;
      onScrape(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tracked]);
  if (loading) return <p>Loading…</p>;
  if (error) return <p className="error">Unable to load: {error} <button className="btn" onClick={reload}>Retry</button></p>;
  if (!tracked) return <p>Not found.</p>;
  const latest = history[0];
  const prices = history.map((h) => Number(h.price)).filter(Number.isFinite);
  return (
    <section>
      <Link to="/">← All tracked</Link>
      <h1>{tracked.product?.name}</h1>
      <p className="muted">{tracked.option?.optionName}: <strong>{tracked.option?.optionValue}</strong></p>
      <div className="stats">
        <div><span>Current price</span><strong>{latest ? formatPrice(latest.price) : '—'}</strong></div>
        <div><span>Stock</span><strong>{latest ? stockLabel(latest.stock) : '—'}</strong></div>
        <div><span>Low / High</span><strong>{prices.length ? `${formatPrice(Math.min(...prices))} / ${formatPrice(Math.max(...prices))}` : '—'}</strong></div>
        <div><span>Last success</span><strong>{formatDate(tracked.lastSuccessAt)}</strong></div>
      </div>
      <div className="row-between">
        <h2>Price history</h2>
        <button className="btn primary" disabled={scraping} onClick={() => onScrape(false)}>{scraping ? 'Scraping…' : 'Scrape Now'}</button>
      </div>
      {msg && <p className="note">{msg}</p>}
      <PriceChart history={history} />
      <h2>Scrape log (every attempt)</h2>
      <ScrapeLogTableWrap logs={logs} />
    </section>
  );
}

import { ScrapeLogTable } from '../components/badges';
function ScrapeLogTableWrap({ logs }) {
  return <ScrapeLogTable logs={logs} />;
}

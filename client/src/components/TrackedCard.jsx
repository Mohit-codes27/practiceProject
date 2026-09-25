import { Link } from 'react-router-dom';
import { formatPrice, formatDate } from '../utils/format';
import { StockBadge } from './badges';

export default function TrackedCard({ t, onScrape, scraping }) {
  const id = t.id;
  const name = t.product?.name || t.productName || 'Unknown product';
  const opt = t.option ? `${t.option.optionName || t.option.option_name}: ${t.option.optionValue || t.option.option_value}` : '';
  const latest = t.latest || null; // attached by GET /tracked-products
  const price = latest ? latest.price : null;
  const stock = latest ? latest.stock : null;
  const scrapedAt = latest ? (latest.scrapedAt || latest.scraped_at) : null;
  return (
    <div className="card">
      <div>
        <h3>{name}</h3>
        <p className="muted">{opt}</p>
        <p className="price-line">{price !== null && price !== undefined ? formatPrice(price) : 'No price yet — run a scrape'}</p>
        <p className="muted small">Last success: {formatDate(t.lastSuccessAt || t.last_success_at)} · Last scrape: {formatDate(t.lastScrapedAt || t.last_scraped_at)}</p>
        {scrapedAt && <p className="muted small">Price as of {formatDate(scrapedAt)}</p>}
      </div>
      <div className="card-actions">
        <StockBadge stock={stock === null || stock === undefined ? undefined : stock === true || stock === 'true' || stock === 1} />
        <Link className="btn" to={`/tracked/${id}`}>View History</Link>
        <button className="btn primary" disabled={scraping} onClick={() => onScrape(id)}>
          {scraping ? 'Scraping…' : 'Scrape Now'}
        </button>
      </div>
    </div>
  );
}

export function latestPrice(history) {
  if (!history || !history.length) return null;
  return history[0];
}

export function PriceLine({ history }) {
  const h = latestPrice(history);
  if (!h) return <span className="muted">no history yet</span>;
  return <strong>{formatPrice(h.price ?? h.price)}</strong>;
}

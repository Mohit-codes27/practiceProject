import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../hooks/useApi';
import { getProduct, trackProduct } from '../api/client';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const { data, loading, error } = useSearch(q);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [optionId, setOptionId] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  async function openProduct(p) {
    setSelected(p);
    setMsg('Loading options…');
    try {
      const d = await getProduct(p.storeProductId);
      setDetail(d);
      setOptionId(d.options?.[0]?.id || '');
      setMsg('');
    } catch (e) {
      setMsg(`Could not load product: ${e.message}`);
    }
  }

  async function startTracking() {
    if (!detail || !optionId) return;
    setMsg('Tracking…');
    try {
      const t = await trackProduct(detail.product.id, optionId);
      navigate(`/tracked/${t.id}`);
    } catch (e) {
      setMsg(`Track failed: ${e.message}`);
    }
  }

  return (
    <section>
      <h1>Search products</h1>
      <div className="search-row">
        <input autoFocus placeholder="laptop, phone, camera…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading && <p>Searching…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && q.trim().length >= 2 && data.length === 0 && <div className="empty">No products match “{q}”.</div>}
      <div className="grid">
        {data.map((p, i) => (
          <div key={`${p.storeProductId}-${i}`} className="card">
            <div>
              <h3>{p.name}</h3>
              <p className="muted small">{p.brand} · {p.category} · {p.sku}</p>
            </div>
            <button className="btn" onClick={() => openProduct(p)}>Select</button>
          </div>
        ))}
      </div>

      {selected && detail && (
        <div className="panel">
          <h2>{detail.product.name}</h2>
          <p className="muted">{detail.optionAxis} — choose one option to track:</p>
          <div className="opts">
            {(detail.options || []).map((o) => (
              <label key={o.id} className={o.id === optionId ? 'opt on' : 'opt'}>
                <input type="radio" name="opt" checked={o.id === optionId} onChange={() => setOptionId(o.id)} />
                {o.optionValue}
              </label>
            ))}
          </div>
          <button className="btn primary" disabled={!optionId} onClick={startTracking}>Start Tracking</button>
        </div>
      )}
      {msg && <p className="note">{msg}</p>}
    </section>
  );
}

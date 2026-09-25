export function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  const cls = s === 'success' ? 'badge ok' : s === 'retried' ? 'badge warn' : 'badge bad';
  return <span className={cls}>{String(status || '').toUpperCase()}</span>;
}

export function StockBadge({ stock }) {
  if (stock === true) return <span className="badge ok">● In Stock</span>;
  if (stock === false) return <span className="badge bad">● Sold Out</span>;
  return <span className="badge warn">● Unknown</span>;
}

export function ScrapeLogTable({ logs }) {
  if (!logs || logs.length === 0) return <div className="empty">No scrape attempts yet.</div>;
  const ts = (l) => l.startedAt || l.started_at;
  return (
    <table className="table">
      <thead>
        <tr><th>Timestamp (UTC)</th><th>Attempt</th><th>Strategy</th><th>Status</th><th>Price</th><th>Error</th><th>Message</th></tr>
      </thead>
      <tbody>
        {logs.map((l) => {
          const msg = l.errorMessage || l.error_message || '';
          return (
          <tr key={l.id}>
            <td>{ts(l) ? new Date(ts(l)).toISOString().replace('T', ' ').slice(0, 19) : '—'}</td>
            <td>#{l.attemptNumber ?? l.attempt_number}</td>
            <td>{l.strategy}</td>
            <td><StatusBadge status={l.status} /></td>
            <td>{l.price ?? '—'}</td>
            <td className="err">{l.errorCode || l.error_code || '—'}</td>
            <td className="muted small" title={msg}>{msg ? (msg.length > 80 ? msg.slice(0, 80) + '…' : msg) : '—'}</td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

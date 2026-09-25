export function formatPrice(v, currency = '₹') {
  if (v === null || v === undefined) return '—';
  return `${currency}${Number(v).toLocaleString('en-IN')}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
}

export function stockLabel(stock) {
  if (stock === true) return 'In Stock';
  if (stock === false) return 'Sold Out';
  return 'Unknown';
}

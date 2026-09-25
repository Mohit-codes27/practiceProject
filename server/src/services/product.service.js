'use strict';

// Product service: search + details, caching metadata into Postgres.

const { env } = require('../config/env');
const { searchProducts, fetchItem } = require('../scraper/http-scraper');

async function search(query, db) {
  const r = await searchProducts(query);
  if (!r.ok) throw Object.assign(new Error('Search failed'), { status: 502, code: 'SEARCH_FAILED' });
  // Cache lightweight metadata so tracking can reference it.
  for (const p of r.results.slice(0, 30)) {
    await db.upsertProduct({
      storeProductId: p.id,
      name: p.name,
      productUrl: `${env.STORE_BASE_URL}/item/${p.id}`,
      description: p.description || '',
      imageUrl: null,
    }).catch(() => {});
  }
  return r.results.map((p) => ({ storeProductId: String(p.id), name: p.name, brand: p.brand, category: p.category, sku: p.sku, productUrl: `${env.STORE_BASE_URL}/item/${p.id}` }));
}

async function details(storeProductId, db) {
  const r = await fetchItem(storeProductId);
  if (!r.ok) {
    const status = r.code === 'PRODUCT_NOT_FOUND' ? 404 : 502;
    throw Object.assign(new Error(r.message), { status, code: r.code });
  }
  const item = r.item;
  const product = await db.upsertProduct({
    storeProductId: item.id,
    name: item.name,
    productUrl: `${env.STORE_BASE_URL}/item/${item.id}`,
    description: item.description || '',
    imageUrl: null,
  });
  const options = [];
  for (const o of item.options || []) {
    const row = await db.upsertOption({ productId: product.id, optionName: item.optionAxis || 'Option', optionValue: o.label, storeOptionId: o.id });
    options.push({ ...row, storeOptionId: o.id });
  }
  return { product, optionAxis: item.optionAxis || 'Option', options, brand: item.brand, category: item.category, sku: item.sku, specs: item.specs || {}, reviews: item.reviews || [] };
}

module.exports = { search, details };

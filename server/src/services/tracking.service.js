'use strict';

// Tracking service: owns the product -> option -> tracked_product creation
// rules so routes stay thin and the logic is unit-testable without HTTP.

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

async function trackProduct(productId, optionId, db, { intervalMinutes } = {}) {
  const withOpts = await db.getProductWithOptions(productId);
  if (!withOpts) throw httpError(404, 'PRODUCT_NOT_FOUND', 'Product not found. Open it from search first.');
  const opt = (withOpts.options || []).find((o) => o.id === optionId);
  if (!opt) throw httpError(400, 'OPTION_NOT_FOUND', 'Option does not belong to this product.');
  return db.createTracked({ productId: withOpts.id, optionId: opt.id, intervalMinutes });
}

module.exports = { trackProduct };

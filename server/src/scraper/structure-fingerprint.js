'use strict';

const crypto = require('crypto');

// Stable fingerprint of the store's price-panel structure (from ui/manifest).
// Used for STRUCTURE_CHANGED detection: log the event, but let validation
// decide whether extraction still works.

function fingerprintManifest(manifest) {
  const stable = {
    classes: manifest.classes || {},
    order: manifest.order || [],
    priceTag: manifest.priceTag || '',
    priceCarrier: manifest.priceCarrier || '',
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 16);
}

module.exports = { fingerprintManifest };

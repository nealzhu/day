import { fontManifest } from './font-assets.mjs';
import { verifyFontDelivery } from './verify-font-delivery.mjs';

const assets = await fontManifest();
await verifyFontDelivery(assets);
console.log(`Verified bytes, content types, cache policy and production CORS for ${assets.length} CDN font assets.`);

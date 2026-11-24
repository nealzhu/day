import { createHash } from 'node:crypto';
import { fontCdn } from './font-assets.mjs';

// Read the public representation with the page Origin, as the browser would.
export async function verifyFontDelivery(assets, cdn = fontCdn, origin = 'https://qians.day') {
  for (let start = 0; start < assets.length; start += 8) {
    await Promise.all(assets.slice(start, start + 8).map(async asset => {
      const url = `${cdn}/${asset.key}`;
      const response = await fetch(url, { headers: { Origin: origin }, redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (response.status !== 200) throw new Error(`${url}: HTTP ${response.status}`);
      const type = response.headers.get('content-type')?.split(';')[0].trim();
      if (type !== asset.contentType) throw new Error(`${url}: expected ${asset.contentType}, got ${type}`);
      const allowed = response.headers.get('access-control-allow-origin');
      if (allowed !== origin) throw new Error(`${url}: expected Access-Control-Allow-Origin ${origin}, got ${allowed}`);
      const cache = (response.headers.get('cache-control') ?? '').toLowerCase().split(',').map(value => value.trim());
      if (asset.cacheControl.split(', ').some(value => !cache.includes(value))) {
        throw new Error(`${url}: expected Cache-Control ${asset.cacheControl}, got ${cache.join(', ')}`);
      }
      const digest = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      if (digest !== asset.sha256) throw new Error(`${url}: content digest mismatch`);
    }));
  }
}

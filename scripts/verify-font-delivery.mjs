import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fontCdn } from './font-assets.mjs';

export const productionOrigin = 'https://qians.day';
// Bump this when changing the acceptance criteria or the smoke sample.
export const fontVerificationPolicy = '1';
const maxAttempts = 3;
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

export function fontSmokeAssets(assets) {
  const subsets = assets.filter(asset => asset.contentType === 'font/woff2');
  // Cover subsets across the stylesheet, including its final Latin subset.
  return [assets.find(asset => asset.contentType === 'text/css'), ...new Set([
    subsets[0], subsets[Math.floor(subsets.length / 2)], subsets.at(-1),
  ])];
}

function verifyHeaders(response, asset, origin) {
  const type = response.headers.get('content-type')?.split(';')[0].trim();
  if (type !== asset.contentType) throw new Error(`expected ${asset.contentType}, got ${type}`);
  const allowed = response.headers.get('access-control-allow-origin');
  if (allowed !== origin) throw new Error(`expected Access-Control-Allow-Origin ${origin}, got ${allowed}`);
  const cache = (response.headers.get('cache-control') ?? '').toLowerCase().split(',').map(value => value.trim());
  if (asset.cacheControl.split(', ').some(value => !cache.includes(value))) {
    throw new Error(`expected Cache-Control ${asset.cacheControl}, got ${cache.join(', ')}`);
  }
}

// Read the public representation with the page Origin, as the browser would.
export async function verifyFontDelivery(assets, cdn = fontCdn, origin = productionOrigin, mode = 'full') {
  const started = performance.now();
  let requests = 0;
  let success = false;

  async function verifyAsset(asset) {
    const url = `${cdn}/${asset.key}`;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      requests++;
      let retryable = true;
      let response;
      try {
        response = await fetch(url, { headers: { Origin: origin }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
        if (response.status !== 200) {
          retryable = retryableStatuses.has(response.status);
          throw new Error(`HTTP ${response.status}`);
        }
        retryable = false;
        verifyHeaders(response, asset, origin);
        retryable = true;
        const bytes = await response.arrayBuffer();
        retryable = false;
        const digest = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
        if (digest !== asset.sha256) throw new Error('content digest mismatch');
        return;
      } catch (error) {
        if (response?.body && !response.bodyUsed) await response.body.cancel().catch(() => {});
        if (!retryable || attempt === maxAttempts) throw new Error(`${url}: ${error.message}`, { cause: error });
        console.warn(`Retrying ${url} after ${error.message} (${attempt}/${maxAttempts - 1})`);
        await delay(250 * 2 ** (attempt - 1));
      }
    }
  }

  try {
    for (let start = 0; start < assets.length; start += 8) {
      const results = await Promise.allSettled(assets.slice(start, start + 8).map(verifyAsset));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    }
    success = true;
  } finally {
    console.log(`CDN font ${mode}: ${success ? 'passed' : 'failed'}, ${assets.length} assets, ${requests} GET attempts, ${(performance.now() - started).toFixed(0)} ms`);
  }
}

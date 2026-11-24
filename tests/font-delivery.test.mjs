import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import { fontManifest } from '../scripts/font-assets.mjs';
import { verifyFontDelivery } from '../scripts/verify-font-delivery.mjs';

test('CDN release gate checks every stylesheet dependency and blocks invalid responses', async t => {
  const assets = await fontManifest();
  const entries = new Map(assets.map(asset => ['/' + asset.key, asset]));
  const seen = new Set();
  const origin = 'https://qians.day';
  let fault = '';
  let attempts = 0;
  const server = createServer(async (req, res) => {
    attempts++;
    const asset = entries.get(req.url);
    if (!asset || fault === 'missing') return res.writeHead(404).end();
    if (fault === 'unavailable') return res.writeHead(503).end();
    if (fault === 'transient' && attempts === 1) return req.socket.destroy();
    if (fault === 'redirect') return res.writeHead(302, { Location: req.url }).end();
    seen.add(req.url);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': fault === 'cors' ? '*' : req.headers.origin,
      'Content-Type': fault === 'type' ? 'text/html' : asset.contentType,
      'Cache-Control': fault === 'cache' ? 'no-store' : asset.cacheControl,
    }).end(fault === 'bytes' ? 'truncated' : await readFile(asset.path));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const cdn = 'http://127.0.0.1:' + server.address().port;
  await verifyFontDelivery(assets, cdn, origin);
  assert.equal(seen.size, 323);
  for (const [problem, error] of [
    ['missing', /HTTP 404/], ['type', /expected font\/woff2/], ['cors', /Access-Control-Allow-Origin/],
    ['cache', /Cache-Control/], ['bytes', /digest mismatch/], ['redirect', /HTTP 302/],
  ]) {
    fault = problem;
    attempts = 0;
    await assert.rejects(verifyFontDelivery([assets[0]], cdn, origin), error);
    assert.equal(attempts, 1);
  }
  t.mock.method(console, 'warn', () => {});
  fault = 'transient';
  attempts = 0;
  await verifyFontDelivery([assets[0]], cdn, origin);
  assert.equal(attempts, 2);

  fault = 'unavailable';
  attempts = 0;
  await assert.rejects(verifyFontDelivery([assets[0]], cdn, origin), /HTTP 503/);
  assert.equal(attempts, 3);
});

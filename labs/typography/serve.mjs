// Local cross-origin rehearsal. Keep all listeners on loopback.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { preview } from 'astro';

const root = new URL('./', import.meta.url);
const fontRoot = new URL('fonts/v1.530/', root);
const pageOrigin = 'http://127.0.0.1:4601';
const fonts = createServer(async (req, res) => {
  const match = /^\/fonts\/v1\.530\/([0-9a-f]{20}\.woff2|faces\.css|OFL\.txt)$/.exec(req.url);
  if (!match) { res.writeHead(404).end(); return; }
  try {
    const name = match[1];
    const isFont = name.endsWith('.woff2');
    let body = await readFile(new URL(name, fontRoot));
    res.setHeader('Access-Control-Allow-Origin', pageOrigin);
    res.setHeader('Timing-Allow-Origin', pageOrigin);
    res.setHeader('Content-Type', isFont ? 'font/woff2' : name.endsWith('.css') ? 'text/css' : 'text/plain');
    res.setHeader('Cache-Control', isFont ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (name.endsWith('.css')) {
      res.setHeader('Vary', 'Accept-Encoding');
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
        body = gzipSync(body);
        res.setHeader('Content-Encoding', 'gzip');
      }
      const tag = '"' + createHash('sha256').update(body).digest('hex') + '"';
      res.setHeader('ETag', tag);
      if (req.headers['if-none-match'] === tag) {
        res.writeHead(304).end();
        return;
      }
    }
    res.setHeader('Content-Length', body.length);
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => fonts.once('error', reject).listen(4602, '127.0.0.1', resolve));
const site = await preview({ root: fileURLToPath(root), server: { host: '127.0.0.1', port: 4601 } });
if (site.server.address().port !== 4601) {
  fonts.close();
  await site.stop();
  throw new Error('Port 4601 is required for the cross-origin font check.');
}
console.log(pageOrigin + '/essay/');

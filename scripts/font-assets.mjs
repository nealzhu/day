import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const fontDirectory = 'labs/typography/fonts/v1.530';
export const fontPrefix = 'fonts/lxgw-wenkai/v1.530';
export const fontCdn = 'https://site-cdn.qians.day';
const cssHash = 'a59f232fe7586593306b20a833093a5956019462d0ea766afbf939bdae876c77';
const licenseHash = '1a25e35da1031c6c3436fde545bb9cb5aca954e9873afe510c834b8b79bd21a0';
export const immutableCache = 'public, max-age=31536000, immutable';

export async function fontManifest(directory = fontDirectory) {
  const css = await readFile(join(directory, 'faces.css'), 'utf8');
  // Pin the approved stylesheet, including all unicode ranges and relative URLs.
  if (createHash('sha256').update(css).digest('hex') !== cssHash) throw new Error('Unexpected v1.530 faces.css digest');
  const subsets = [...css.matchAll(/url\("\.\/([0-9a-f]{20}\.woff2)"\)/g)].map(match => match[1]);
  if (subsets.length !== 321 || new Set(subsets).size !== 321) throw new Error('Expected 321 unique WOFF2 references');
  const names = [...subsets, 'OFL.txt', 'faces.css'];
  const files = await readdir(directory);
  if (files.some(name => !name.startsWith('.') && !names.includes(name))) throw new Error('Unexpected file in the versioned font directory');

  const assets = [];
  for (const name of names) {
    const path = join(directory, name);
    const bytes = await readFile(path);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const isFont = name.endsWith('.woff2');
    if (isFont && (bytes.toString('ascii', 0, 4) !== 'wOF2' || name !== sha256.slice(0, 20) + '.woff2')) {
      throw new Error(`Invalid WOFF2 or content hash: ${path}`);
    }
    if (name === 'OFL.txt' && sha256 !== licenseHash) throw new Error('Unexpected v1.530 OFL digest');
    assets.push({
      path, key: `${fontPrefix}/${name}`, sha256, size: bytes.length,
      contentType: isFont ? 'font/woff2' : name === 'faces.css' ? 'text/css' : 'text/plain',
      cacheControl: isFont ? immutableCache : 'public, no-cache',
    });
  }
  return assets;
}

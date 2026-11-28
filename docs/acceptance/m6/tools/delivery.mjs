import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { cardPlaceholderKey } from '../../../../scripts/card-placeholder.mjs';
import { fontCdn, fontManifest, fontPrefix } from '../../../../scripts/font-assets.mjs';
import { args, origins } from './config.mjs';
import { pickedHeaders } from './instrument.mjs';

const options = args({ dist: { type: 'string', default: 'dist' }, actions: { type: 'boolean' } });
const dist = options.dist;
const origin = origins.production;
await mkdir(options.out, { recursive: true });
const save = (name, value) => writeFile(join(options.out, name), JSON.stringify(value, null, 2) + '\n');
const hash = data => createHash('sha256').update(data).digest('hex');

const fontAssets = await fontManifest();
const files = [];
const duplicates = {};
for (const name of (await readdir(dist, { recursive: true, withFileTypes: true }))
  .filter(file => file.isFile()).map(file => relative(dist, join(file.parentPath, file.name))).sort()) {
  const data = await readFile(join(dist, name));
  const type = name.startsWith('pagefind/') ? 'pagefind'
    : name.endsWith('.html') ? 'html' : name.endsWith('.css') ? 'css'
    : name.endsWith('.js') ? 'js' : /\.(wof[f2]*|ttf)$/.test(name) ? 'font'
    : /\.(svg|ico|png|webp|jpeg|jpg)$/.test(name) ? 'image' : 'other';
  const sha256 = hash(data);
  files.push({ name, type, size: data.length, gzip: gzipSync(data).length, sha256 });
  (duplicates[sha256] ??= []).push(name);
}
const totals = {};
for (const { type, size, gzip } of files) {
  const group = totals[type] ??= { count: 0, bytes: 0, gzip: 0 };
  group.count++;
  group.bytes += size;
  group.gzip += gzip;
}
await save('build.json', {
  readAt: new Date().toISOString(), dist, sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  count: files.length, bytes: files.reduce((sum, f) => sum + f.size, 0), types: totals,
  duplicates: Object.values(duplicates).filter(paths => paths.length > 1),
  possibleFixtures: files.filter(f => /\/lab-|\/fixture|\/test-resources/i.test('/' + f.name)).map(f => f.name),
  files, fonts: fontAssets.map(({ key, size, sha256, contentType }) => ({ key, size, sha256, contentType })),
});

const cdn = [
  ['home', origin + '/'], ['html', origin + '/posts/m2-smoke-test/'],
  ['comments-theme', origin + '/comments/theme.css'],
  ['cover', fontCdn + '/' + cardPlaceholderKey],
  ['article-photo', fontCdn + '/posts/01K00000000000000000000000/test-27e984fd8dc5.webp'],
  ['font-css', fontCdn + '/' + fontPrefix + '/faces.css'],
  ['font', fontCdn + '/' + fontAssets[0].key],
  ['font-iframe', fontCdn + '/' + fontAssets[0].key, 'https://giscus.app'],
];
for (const file of files.filter(f => f.name.startsWith('_astro/') || f.type === 'pagefind' && !f.name.endsWith('.txt'))) {
  cdn.push([file.name, origin + '/' + file.name]);
}

const tmp = await mkdtemp(join(tmpdir(), 'qians-m6-headers-'));
const output = [];
try {
  for (const [label, url, requestOrigin = origin] of cdn) {
    const probe = async (request, extra = []) => {
      const rawHeaders = join(tmp, 'headers');
      const body = join(tmp, 'body');
      await rm(body, { force: true });
      const startedAt = new Date().toISOString();
      const timings = JSON.parse(execFileSync('curl', [
        '--silent', '--show-error', '--max-time', '20', '--compressed', '--noproxy', 'localhost,127.0.0.1',
        '--header', 'Origin: ' + requestOrigin, '--dump-header', rawHeaders, '--output', body, '--write-out', '%{json}',
        ...extra, url,
      ], { encoding: 'utf8' }));
      const raw = (await readFile(rawHeaders, 'utf8')).trim().split(/\r?\n\r?\n/).at(-1);
      const headers = pickedHeaders(Object.fromEntries(raw.split(/\r?\n/).slice(1)
        .filter(line => line.includes(':')).map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()])));
      const { http_code: status, http_version: protocol, size_download: encoded,
        time_namelookup, time_connect, time_appconnect, time_starttransfer, time_total } = timings;
      const bytes = await readFile(body).catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return Buffer.alloc(0);
      });
      const row = { label, request, url, requestOrigin, startedAt, status, protocol, encoded, headers,
        decodedBytes: bytes.length, ...(bytes.length ? { sha256: hash(bytes) } : {}),
        time: { dns: time_namelookup * 1000, tcp: (time_connect - time_namelookup) * 1000,
          tls: time_appconnect > 0 ? (time_appconnect - time_connect) * 1000 : null,
          ttfb: time_starttransfer * 1000, total: time_total * 1000 } };
      output.push(row);
      return row;
    };
    const first = await probe('GET');
    if (first.status !== 200) continue;
    const etag = first.headers.etag;
    const modified = first.headers['last-modified'];
    if (etag || modified) await probe('conditional GET', ['--header', etag ? 'If-None-Match: ' + etag : 'If-Modified-Since: ' + modified]);
  }
} finally {
  await save('delivery.json', output);
  await rm(tmp, { recursive: true, force: true });
}

if (options.actions) {
  const get = async path => {
    const response = await fetch('https://api.github.com/repos/nealzhu/day/' + path,
      { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('GitHub API ' + response.status + ' ' + path);
    return response.json();
  };
  const { workflow_runs } = await get('actions/workflows/deploy.yml/runs?status=success&branch=main&per_page=5');
  const rows = [];
  for (const { id, head_sha, created_at, updated_at, html_url } of workflow_runs) {
    const { jobs } = await get('actions/runs/' + id + '/jobs');
    rows.push({ id, head_sha, created_at, updated_at, html_url, jobs: jobs.map(job => ({
      id: job.id, name: job.name, html_url: job.html_url, started_at: job.started_at,
      completed_at: job.completed_at, conclusion: job.conclusion,
      steps: job.steps.map(step => ({ ...step, seconds: step.completed_at && step.started_at ?
        (Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000 : null })),
    })) });
  }
  await save('actions.json', rows);
}

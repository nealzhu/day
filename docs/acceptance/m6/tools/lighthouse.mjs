import { execFileSync } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, readFile, readdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { args, origins, networks, profiles, rolePaths } from './config.mjs';

const options = args({ reports: { type: 'string' } });
const samples = Number(options.samples);
if (!Number.isSafeInteger(samples) || samples < 1) throw new Error('samples must be a positive integer');
const pin = 'lighthouse@13.6.0';
const auditFile = join(options.out, 'lighthouse.jsonl');
const cases = [
  ['production', 'desktop', 'native', 'cards'],
  ['production', 'mobile', 'shaped', 'cards'],
  ['production', 'mobile', 'shaped', 'pictured'],
  ['local', 'desktop', 'native', 'cards'],
  ['local', 'mobile', 'shaped', 'tech'],
  ['local', 'mobile', 'shaped', 'life'],
  ['local', 'mobile', 'shaped', 'essay'],
];
const filter = new RegExp(options.filter);
await mkdir(options.out, { recursive: true });
if (options.reports) await mkdir(options.reports, { recursive: true });
const tmp = await mkdtemp(join(tmpdir(), 'qians-m6-lighthouse-'));
try {
  for (const [site, device, network, role] of cases) {
    const key = [site, device, network, role].join('-');
    if (!filter.test(key)) continue;
    const url = new URL(rolePaths[role], origins[site]).href;
    const { width, height } = profiles[device];
    const { latency, downloadThroughput, uploadThroughput, cpu } = networks[network];
    for (let sample = 1; sample <= samples; sample++) {
      const saveReport = Boolean(options.reports && sample === 1 && ['cards', 'tech'].includes(role));
      const stem = join(tmp, key + '-' + sample);
      const command = [
        'dlx', pin, url, '--quiet', '--only-categories=performance',
        '--chrome-flags=--headless=new --no-first-run',
        `--form-factor=${device}`, `--screenEmulation.width=${width}`, `--screenEmulation.height=${height}`,
        '--screenEmulation.deviceScaleFactor=1', `--screenEmulation.mobile=${device === 'mobile'}`,
        `--throttling-method=${network === 'native' ? 'provided' : 'devtools'}`,
        '--max-wait-for-load=20000', '--output=json', `--output-path=${stem}.json`,
      ];
      if (device === 'desktop') command.push('--preset=desktop');
      if (network === 'shaped') command.push(
        `--throttling.requestLatencyMs=${latency}`,
        `--throttling.downloadThroughputKbps=${downloadThroughput * 8 / 1000}`,
        `--throttling.uploadThroughputKbps=${uploadThroughput * 8 / 1000}`,
        `--throttling.cpuSlowdownMultiplier=${cpu}`,
      );
      if (saveReport) command.push('--output=html', '--save-assets');
      console.log(`Lighthouse ${key} ${sample}/${samples}`);
      execFileSync('pnpm', command, { timeout: 75_000, stdio: 'inherit' });
      const results = await readdir(tmp);
      const report = results.find(name => name === key + '-' + sample + '.json' || name === key + '-' + sample + '.report.json');
      if (!report) throw new Error(`Lighthouse JSON missing for ${stem}: ${results}`);
      const lhr = JSON.parse(await readFile(join(tmp, report), 'utf8'));
      if (lhr.runtimeError) throw new Error(JSON.stringify(lhr.runtimeError));
      // Screenshot payloads are represented by the captured report PNG and sample trace.
      for (const id of ['screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot']) {
        if (lhr.audits[id]?.details) delete lhr.audits[id].details;
      }
      delete lhr.fullPageScreenshot;
      await appendFile(auditFile, JSON.stringify({ key, sample, lhr }) + '\n');
      if (saveReport) {
        const html = results.find(name => name === key + '-' + sample + '.report.html');
        if (html) await copyFile(join(tmp, html), resolve(options.reports, key + '.html'));
        if (device === 'mobile') {
          const trace = results.find(name => name.startsWith(key + '-' + sample) && name.endsWith('.trace.json'));
          if (trace && role === 'cards') await writeFile(join(options.out, 'lighthouse-production-mobile.trace.json.gz'),
            gzipSync(await readFile(join(tmp, trace))));
        }
      }
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

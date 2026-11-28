import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { args } from './config.mjs';

const { out } = args();
const entries = await readdir(out);
const distinctFiles = new Set(entries.filter(n => /^(chrome-.+|lighthouse)\.jsonl(?:\.gz)?$/.test(n)).map(n => n.replace(/\.gz$/, '')));
const byCase = { navigation: {}, interaction: {}, lighthouse: {} };
const environments = [];
const errors = [];
const fontMaps = JSON.parse(await readFile(join(out, 'font-cmaps.json'), 'utf8'));
const declared = new Set(Object.values(fontMaps).flatMap(font => font.chars));
const rounds = numbers => {
  const values = numbers.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return null;
  const round = n => Number(n.toFixed(4));
  const middle = Math.floor(values.length / 2);
  return {
    n: values.length, median: round(values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2),
    min: round(values[0]), max: round(values.at(-1)),
  };
};
const fontName = url => url.split('/').at(-1)?.split('?')[0];
const countBy = (rows, key) => rows.reduce((acc, row) => {
  const type = key(row);
  acc[type] = (acc[type] ?? 0) + 1;
  return acc;
}, {});
const subsetStats = {};
const corpus = new Map();
const bad = requests => requests.filter(r => (r.error && !r.canceled) || r.status >= 400)
  .map(r => ({ type: r.type, url: r.url, error: r.error, status: r.status, cors: r.cors }));
const pushed = (set, key, row) => (set[key] ??= []).push(row);
const live = request => request.status >= 200 && request.status < 400 && !request.error;
const requestCount = (requests, re) => requests.filter(r => re.test(r.url)).length;
const sum = (requests, field) => requests.reduce((total, row) => total + (row[field] ?? 0), 0);
const featureSize = (requests, pattern) => requests.filter(r => pattern.test(r.url))
  .reduce((total, row) => total + (row.encoded ?? row.fallbackBodyBytes ?? row.responseBodySize ?? 0), 0);
for (const plain of [...distinctFiles].sort()) {
  const file = entries.includes(plain) ? plain : plain + '.gz';
  const raw = await readFile(join(out, file));
  const source = (file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
  const site = plain.split('-')[1];
  for (const line of source.split('\n').filter(Boolean)) {
    const row = JSON.parse(line);
    if (row.type === 'environment') environments.push({ file, ...row });
    if (row.type === 'error') errors.push({ file, ...row });
    if (row.type === 'navigation') {
      const { data, requests } = row;
      if (site === 'local' && row.cache === 'cold' && row.device === 'desktop' &&
          row.network === 'native' && row.scenario !== 'list' && row.sample === 1) {
        for (const [hex, count] of Object.entries(data.text)) {
          const codepoint = Number.parseInt(hex, 16);
          if (/\p{Script=Han}/u.test(String.fromCodePoint(codepoint))) {
            corpus.set(codepoint, (corpus.get(codepoint) ?? 0) + count);
          }
        }
      }
      const document = requests.find(r => r.type === 'Document' && r.url === row.url);
      const fontRequests = requests.filter(r => r.type === 'Font');
      const loaded = new Set(fontRequests.filter(live).map(r => fontName(r.url)).filter(n => n in fontMaps));
      const loadedCodepoints = new Set([...loaded].flatMap(name => fontMaps[name].chars));
      const coverage = (input, include = cp => declared.has(cp)) => {
        const chars = Object.keys(input).map(key => Number.parseInt(key, 16));
        const eligible = chars.filter(include);
        return eligible.length ? 100 * eligible.filter(cp => loadedCodepoints.has(cp)).length / eligible.length : null;
      };
      const han = cp => /\p{Script=Han}/u.test(String.fromCodePoint(cp));
      const network = {};
      for (const request of requests) {
        const group = network[request.type ?? 'Other'] ??= { requests: 0, wireBytes: 0, zeroBytes: 0, revalidated: 0 };
        group.requests++;
        group.wireBytes += request.encoded ?? 0;
        group.zeroBytes += request.encoded === 0 ? 1 : 0;
        group.revalidated += (request.wireStatus ?? request.status) === 304 ? 1 : 0;
      }
      if (row.cache === 'cold') {
        for (const name of loaded) {
          const group = subsetStats[name] ??= { requests: 0, sites: {}, routeTypes: {}, eligibleUsed: [], matches: [], priority: {} };
          group.requests++;
          group.sites[site] = (group.sites[site] ?? 0) + 1;
          group.routeTypes[row.scenario] = (group.routeTypes[row.scenario] ?? 0) + 1;
          const codepoints = fontMaps[name].chars;
          group.eligibleUsed.push(codepoints.filter(cp => data.text[cp.toString(16)]).length);
          group.matches.push(codepoints.filter(cp => data.visibleText[cp.toString(16)]).length);
          const priority = fontRequests.find(r => fontName(r.url) === name)?.priority;
          group.priority[priority] = (group.priority[priority] ?? 0) + 1;
        }
      }
      const documentMs = (end, begin) => end >= 0 && begin >= 0 ? end - begin : null;
      const doc = document?.timing;
      const lcp = data.lcp.at(-1);
      const fontEvents = Array.isArray(data.fonts) ? data.fonts : [];
      const finalFontEvent = fontEvents.filter(f => f.type === 'loadingdone').at(-1);
      const transferredFontEnds = data.fontResources.filter(r => /\.woff2$/.test(r.url) && r.end > 0).map(r => r.end);
      pushed(byCase.navigation, [site, row.device, row.network, row.scenario, row.cache].join('/'), {
        dns: documentMs(doc?.dnsEnd, doc?.dnsStart),
        tcp: doc ? documentMs(doc.sslStart >= 0 ? doc.sslStart : doc.connectEnd, doc.connectStart) : null,
        tls: documentMs(doc?.sslEnd, doc?.sslStart),
        ttfb: data.nav?.responseStart, responseRequest: data.nav ? data.nav.responseStart - data.nav.requestStart : null,
        load: data.nav?.loadEventEnd,
        fcp: data.paints.find(p => p.name === 'first-contentful-paint')?.ms,
        lcp: lcp?.ms, lcpNode: lcp ? (lcp.url || lcp.node?.join('.') || 'unavailable') : 'unavailable',
        cls: data.cls, scripts: data.mainThread.ScriptDuration, longTasks: data.tasks.length,
        maxTask: Math.max(0, ...data.tasks.map(t => t.duration)),
        fontReady: finalFontEvent?.ms, firstFontReady: fontEvents.find(f => f.type === 'loadingdone')?.ms,
        loadedFonts: data.fontStates?.loaded ?? data.fonts.loaded,
        firstWoff2ResourceEnd: transferredFontEnds.length ? Math.min(...transferredFontEnds) : null,
        lastWoff2ResourceEnd: transferredFontEnds.length ? Math.max(...transferredFontEnds) : null,
        fontStylesheet: requests.filter(r => /\/faces\.css$/.test(r.url)).reduce((sum, r) => sum + (r.encoded ?? 0), 0),
        taoAvailableFontResources: data.fontResources.filter(r => r.ttfb > 0).length,
        coverageVisible: coverage(data.visibleText), coverageDocument: coverage(data.text),
        coverageHanVisible: coverage(data.visibleText, han), coverageHanDocument: coverage(data.text, han),
        bytes: Object.values(network).reduce((sum, r) => sum + r.wireBytes, 0),
        requests: requests.length, network, consoleCount: row.console.length, bad: bad(requests),
        pagefind: requestCount(requests, /\/pagefind\//), gallery: requestCount(requests, /image-viewer/), giscus: requestCount(requests, /https:\/\/giscus\.app/),
      });
    }
    if (row.type === 'interaction') {
      for (const step of row.steps) {
        const main = row.requests.filter(r => r.phase === step.name);
        const sub = row.subframes.filter(r => r.phase === step.name);
        const auxiliary = (row.auxiliary ?? []).filter(r => r.phase === step.name);
        const all = [...main, ...sub, ...auxiliary];
        const fonts = main.filter(r => r.type === 'Font');
        const beforeFonts = new Set(row.requests.filter(r => r.phase === 'initial' && r.type === 'Font' && live(r)).map(r => fontName(r.url)));
        const matching = fonts.filter(r => beforeFonts.has(fontName(r.url)));
        const inputs = step.events ?? [];
        pushed(byCase.interaction, [site, row.device, row.network, row.scenario, step.name].join('/'), {
          readyMs: step.readyMs, throughPaintMs: step.throughPaintMs, scriptMs: step.scriptMs,
          indexBytesReadyMs: step.observed?.indexReadyMs ? step.observed.indexReadyMs - (step.firstInput?.ms ?? step.start) : null,
          eventMs: inputs.length ? Math.max(...inputs.map(e => e.duration)) : null,
          eventQueueMs: inputs.length ? Math.max(...inputs.map(e => e.processingStart - e.ms)) : null,
          eventCount: inputs.length, longTasks: step.tasks?.length,
          nextFCP: step.next?.paints.find(p => p.name === 'first-contentful-paint')?.ms,
          nextLCP: step.next?.lcp.at(-1)?.ms,
          requests: main.length + auxiliary.length, bytes: main.reduce((s, r) => s + (r.encoded ?? 0), 0),
          auxiliaryBodyBytes: auxiliary.reduce((s, r) => s + (r.responseBodySize ?? 0), 0)
            + main.reduce((s, r) => s + (r.fallbackBodyBytes ?? 0), 0),
          frameRequests: sub.length, frameBodyBytes: sub.reduce((s, r) => s + (r.responseBodySize ?? 0), 0),
          pagefind: requestCount(all, /\/pagefind\//), gallery: requestCount(all, /image-viewer/),
          pagefindBytes: featureSize(all, /\/pagefind\//),
          galleryBytes: featureSize(all, /image-viewer/),
          giscus: requestCount(all, /https:\/\/giscus\.app/),
          images: requestCount(all, /\.webp$/),
          imageBytes: featureSize(all, /\.webp$/),
          initialPagefind: requestCount([...row.requests, ...(row.auxiliary ?? [])].filter(r => r.phase === 'initial'), /\/pagefind\//),
          initialGallery: requestCount(row.requests.filter(r => r.phase === 'initial'), /image-viewer/),
          initialGiscus: requestCount(row.requests.filter(r => r.phase === 'initial'), /https:\/\/giscus\.app/),
          initialFontsReady: (Array.isArray(row.initial.fonts) ? row.initial.fonts : [])
            .find(f => f.type === 'loadingdone')?.ms,
          fontCount: fonts.length, fontReuse: matching.length, wireFreeFonts: matching.filter(r => r.encoded === 0).length,
          revalidatedFonts: matching.filter(r => (r.wireStatus ?? r.status) === 304).length,
          fontsWire: sum(fonts, 'encoded'),
          consoleCount: row.console.length, bad: bad(all), observed: step.observed,
        });
      }
    }
    if (row.lhr) {
      const { audits, categories, configSettings } = row.lhr;
      pushed(byCase.lighthouse, row.key, {
        fcp: audits['first-contentful-paint'].numericValue,
        lcp: audits['largest-contentful-paint'].numericValue,
        cls: audits['cumulative-layout-shift'].numericValue,
        tbt: audits['total-blocking-time'].numericValue,
        si: audits['speed-index'].numericValue,
        jsBoot: audits['bootup-time']?.numericValue,
        score: categories.performance.score,
        configSettings,
      });
    }
  }
}

const summary = Object.fromEntries(Object.entries(byCase).map(([group, cases]) => [group,
  Object.fromEntries(Object.entries(cases).map(([name, rows]) => {
    const keys = new Set(rows.flatMap(Object.keys));
    const values = {};
    for (const key of keys) {
      const cells = rows.map(row => row[key]);
      if (key === 'network') {
        const types = new Set(cells.flatMap(Object.keys));
        values.network = Object.fromEntries([...types].sort().map(type => [type, Object.fromEntries(
          ['requests', 'wireBytes', 'zeroBytes', 'revalidated'].map(k => [k, rounds(cells.map(row => row[type]?.[k] ?? 0))]),
        )]));
      } else if (key === 'lcpNode') values[key] = countBy(cells, v => v);
      else if (key === 'bad') values[key] = [...new Set(cells.flat().map(v => JSON.stringify(v)))].map(v => JSON.parse(v));
      else if (key === 'observed') {
        values.triggers = countBy(cells.filter(v => v?.trigger), v => v.trigger);
        const prose = cells.filter(v => v?.proseBefore);
        if (prose.length) values.proseUnaffected = prose.every(v => v.proseBefore.visible &&
          v.proseAfter.visible && v.proseBefore.size === v.proseAfter.size);
        if (cells.some(v => v?.sameFrame !== undefined)) values.sameFrame = cells.every(v => v?.sameFrame);
        if (cells.some(v => v?.iframeFontStates)) values.frameFontErrors = rounds(cells.map(v => v?.iframeFontStates?.error ?? 0));
        if (cells.some(v => v?.fallback)) {
          values.swapCls = rounds(cells.map(v => v?.cls));
          values.swapFontDone = rounds(cells.map(v => v?.fonts.find(f => f.type === 'loadingdone')?.ms));
        }
      } else if (key === 'configSettings') values[key] = cells[0];
      else values[key] = rounds(cells);
    }
    return [name, { n: rows.length, ...values }];
  }))]));
const topHan = new Set([...corpus].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 100).map(([cp]) => cp));
const subsets = Object.entries(subsetStats).map(([name, values]) => ({
  name, bytes: fontMaps[name].bytes, glyphs: fontMaps[name].chars.length, ...values,
  top100Han: fontMaps[name].chars.filter(cp => topHan.has(cp)).length,
  eligibleUsed: rounds(values.eligibleUsed), matchesInViewport: rounds(values.matches), matches: undefined,
})).sort((a, b) => b.requests - a.requests || b.bytes - a.bytes);
await writeFile(join(out, 'summary.json'), JSON.stringify({
  environments, errors, ...summary, subsets,
  top100Han: [...topHan].map(cp => [String.fromCodePoint(cp), corpus.get(cp)]),
}, null, 2) + '\n');

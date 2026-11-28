import { execFileSync } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import { cpus, release, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { fontDirectory, fontCdn, fontPrefix } from '../../../../scripts/font-assets.mjs';
import { giscusClientFixture, giscusWidgetFixture } from '../../../../tests/fixtures.mjs';
import { args, networks, origins, profiles, rolePaths, routes } from './config.mjs';
import { cls, collectNetwork, installObservers, renderedFonts, settle, snapshotTiming } from './instrument.mjs';

const options = args({
  suite: { type: 'string', default: 'navigation' },
  site: { type: 'string' },
  screenshots: { type: 'string' },
  'start-at': { type: 'string', default: '1' },
});
const repeats = Number(options.samples);
const firstSample = Number(options['start-at']);
if ([repeats, firstSample].some(n => !Number.isSafeInteger(n) || n < 1)) {
  throw new Error('samples and start-at must be positive integers');
}
if (!['navigation', 'interaction'].includes(options.suite)) throw new Error('Unknown suite');
if (!Object.hasOwn(origins, options.site)) throw new Error('Pass --site=production or --site=local');
const filter = new RegExp(options.filter);
const file = join(options.out, `chrome-${options.site}-${options.suite}.jsonl`);
const base = origins[options.site];
const goTo = (page, role, origin = base) => page.goto(new URL(rolePaths[role], origin).href, { waitUntil: 'load' });
const searchQuery = '媒体同步';

await mkdir(options.out, { recursive: true });
if (options.screenshots) await mkdir(options.screenshots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const write = row => appendFile(file, JSON.stringify(row) + '\n');
let failures = 0;

try {
  await write({
    type: 'environment', start: new Date().toISOString(), browser: browser.version(),
    node: process.version, system: process.platform, kernel: release(), hostCPUs: cpus()[0]?.model,
    cores: cpus().length, bytesRAM: totalmem(), headless: true, profiles, networks,
    uncached: 'new incognito context per pair, HTTP cache enabled for both visits',
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    changes: execFileSync('git', ['status', '--short', '--untracked-files=no'], { encoding: 'utf8' }).trim(),
  });

  for (const [device, profile] of Object.entries(profiles)) {
    for (const [network, { cpu, ...shaping }] of Object.entries(networks)) {
      const items = options.suite === 'navigation' ? routes[options.site] : interactionNames(options.site, device);
      for (const scenario of items) {
        const name = [device, network, scenario].join('/');
        if (!filter.test(name)) continue;
        for (let sample = firstSample; sample < firstSample + repeats; sample++) {
          console.log(`${options.site} ${options.suite} ${name} sample ${sample}`);
          const start = new Date().toISOString();
          const { width, height, ...features } = profile;
          const context = await browser.newContext({
            viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light', serviceWorkers: 'block', ...features,
          });
          try {
            await context.addInitScript(installObservers);
            if (scenario === 'list') {
              await context.addInitScript(() => {
                try { localStorage.setItem('qians.day:post-view', 'list'); } catch {}
              });
            }
            const page = await context.newPage();
            page.setDefaultTimeout(22_000);
            const cdp = await context.newCDPSession(page);
            const requests = await collectNetwork(page, cdp, options.suite === 'interaction' ? context : undefined);
            const console = [];
            page.on('console', message => {
              if (['error', 'warning'].includes(message.type())) console.push({
                type: message.type(), text: message.text().slice(0, 500),
              });
            });
            page.on('pageerror', error => console.push({ type: 'exception', text: error.message }));
            await cdp.send('Performance.enable');
            await cdp.send('DOM.enable');
            await cdp.send('CSS.enable');
            if (network === 'shaped') {
              await cdp.send('Network.emulateNetworkConditions', { offline: false, ...shaping });
              await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
            }
            const details = { context, page, cdp, requests, console, sample, scenario, device, network, start };
            const rows = options.suite === 'navigation' ? await navigation(details) : [await interaction(details)];
            await requests.flush();
            for (const row of rows) await write(row);
          } catch (error) {
            failures++;
            await write({ type: 'error', device, network, scenario, sample, start, error: String(error), stack: error.stack });
            console.error(error.message);
          } finally {
            await context.close();
          }
        }
      }
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;

async function getJS(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.filter(m => ['ScriptDuration', 'TaskDuration', 'LayoutDuration'].includes(m.name))
    .map(m => [m.name, m.value * 1000]));
}

async function samplePage(page, cdp, before) {
  await settle(page);
  await page.waitForFunction(() => window.__m6.paints.some(entry => entry.name === 'first-contentful-paint') &&
    window.__m6.lcp.length > 0, undefined, { timeout: 5000 });
  const timing = await page.evaluate(snapshotTiming);
  const view = await page.evaluate(() => ({
    view: document.documentElement.dataset.view,
    text: (document.querySelector('main') ?? document.body).innerText,
    visibleText: [...document.querySelectorAll('h1,h2,h3,p,figcaption,header a,main a')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.height && r.bottom > 0 && r.top < innerHeight; })
      .map(el => el.innerText).join('\n'),
    readyImages: [...document.images].filter(i => i.complete && i.naturalWidth).length,
    galleryLinks: document.querySelectorAll('a[data-gallery-open]').length,
    fontStates: [...document.fonts].reduce((counts, f) => ({ ...counts, [f.status]: (counts[f.status] ?? 0) + 1 }), {}),
  }));
  const after = await getJS(cdp);
  return {
    ...timing, cls: cls(timing.shifts),
    // Store a histogram instead of duplicating article text in every row.
    ...view, text: characters(view.text), visibleText: characters(view.visibleText),
    platformFonts: await renderedFonts(cdp),
    mainThread: Object.fromEntries(Object.entries(after).map(([k, v]) => [k, Math.max(0, v >= (before[k] ?? 0) ? v - (before[k] ?? 0) : v)])),
  };
}

function characters(text) {
  const counts = {};
  for (const char of text) {
    if (/\s/u.test(char)) continue;
    const cp = char.codePointAt(0).toString(16);
    counts[cp] = (counts[cp] ?? 0) + 1;
  }
  return counts;
}

async function navigation({ page, cdp, requests, console, device, network, scenario, sample, start }) {
  const measurements = [];
  for (const cache of ['cold', 'warm-reload']) {
    requests.phase(cache);
    const before = await getJS(cdp);
    const offset = requests.rows.length;
    const logOffset = console.length;
    const response = cache === 'cold'
      ? await goTo(page, scenario)
      : await page.reload({ waitUntil: 'load' });
    if (!response?.ok()) throw new Error(`Navigation failed: ${response?.status()} ${page.url()}`);
    const data = await samplePage(page, cdp, before);
    if (scenario === 'list' && data.view !== 'list') throw new Error('Stored list preference was not applied');
    if (scenario === 'cards' && data.view !== 'cards') throw new Error('Default card view was not applied');
    const row = { type: 'navigation', start, device, network, scenario, cache, sample, url: page.url(),
      data, requests: requests.rows.slice(offset), console: console.slice(logOffset) };
    measurements.push(row);
    if (options.screenshots && sample === 1 && cache === 'cold' && network === 'native' &&
      ['cards', 'list', 'tech', 'life', 'essay'].includes(scenario)) {
      await page.screenshot({ path: join(options.screenshots, `${options.site}-${device}-${scenario}.png`) });
    }
  }
  return measurements;
}

function interactionNames(site, device) {
  const shared = ['search', 'gallery', 'outline', 'comments', 'cross-article'];
  if (device === 'desktop') shared.push('reading', 'font-fallback');
  if (site === 'production') shared.push('comments-delayed-failure');
  return shared;
}

async function measurePhase(page, cdp, requests, name, operation) {
  requests.phase(name);
  const start = await page.evaluate(() => performance.now());
  const before = await getJS(cdp);
  const observed = await operation();
  await settle(page);
  const end = await page.evaluate(() => performance.now());
  const after = await getJS(cdp);
  const timing = await page.evaluate(snapshotTiming);
  const inputs = timing.inputs.filter(e => e.ms >= start);
  // The semantic completion endpoint is distinct from paint and Event Timing.
  const firstInput = inputs.find(event => event.type !== 'scroll') ?? inputs[0];
  return {
    name, start, observed, readyMs: observed.ms - (firstInput?.ms ?? start),
    throughPaintMs: end - (firstInput?.ms ?? start), firstInput,
    events: timing.events.filter(e => e.ms >= start),
    tasks: timing.tasks.filter(e => e.ms >= start),
    scriptMs: after.ScriptDuration - before.ScriptDuration,
  };
}

async function interaction({ context, page, cdp, requests, console, device, network, scenario, sample, start }) {
  const local = options.site === 'local';
  const commentFixture = local && scenario === 'comments';
  const pictured = local ? 'life' : 'pictured';
  const textRole = local ? 'tech' : 'unpictured';
  const role = scenario === 'search' ? 'cards'
    : scenario === 'comments' && local ? 'tech'
    : ['cross-article', 'gallery', 'comments', 'comments-delayed-failure'].includes(scenario) ? pictured
    : local ? 'tech' : 'pictured';
  if (scenario === 'comments-delayed-failure') {
    // A separate run. Routing in Playwright disables the browser HTTP cache.
    await context.route('https://giscus.app/client.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.abort('failed');
    });
  }
  if (commentFixture) await isolateComments(context);
  if (scenario === 'font-fallback') {
    await context.route(/\.woff2$/, async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
  }
  const steps = [];
  requests.phase('initial');
  const before = await getJS(cdp);
  let fallback;
  if (scenario === 'font-fallback') {
    await page.goto(new URL(rolePaths[role], base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
    fallback = { at: await page.evaluate(() => performance.now()), fonts: await renderedFonts(cdp) };
    await page.waitForLoadState('load');
  } else {
    await goTo(page, role, commentFixture ? origins.production : base);
  }
  const initial = await samplePage(page, cdp, before);
  const phase = (name, operation) => measurePhase(page, cdp, requests, name, operation);
  const stamp = () => page.evaluate(() => ({ ms: performance.now() }));
  const checkProse = () => page.locator('.prose p').first().evaluate(el => ({
    size: el.getBoundingClientRect().width, visible: getComputedStyle(el).visibility === 'visible' && el.innerText.length > 0,
  }));

  switch (scenario) {
    case 'search':
      steps.push(await phase('open-search', async () => {
        const wasm = context.waitForEvent('response', {
          predicate: r => /\/pagefind\/wasm\..*\.pagefind$/.test(r.url()),
          timeout: 8000,
        });
        await page.locator('#search-trigger').click();
        await page.locator('#search-input').waitFor();
        const visible = await stamp();
        await (await wasm).finished();
        return { ...visible, indexReadyMs: (await stamp()).ms };
      }));
      steps.push(await phase('keyword', async () => {
        await page.locator('#search-input').fill(searchQuery);
        await page.locator('#search-results a').first().waitFor();
        return stamp();
      }));
      await capture('search');
      await page.keyboard.press('Escape');
      steps.push(await phase('reopen-search', async () => {
        await page.locator('#search-trigger').click();
        await page.locator('#search-input').waitFor();
        return stamp();
      }));
      break;
    case 'gallery': {
      const picture = page.locator('a[data-gallery-open]').first();
      steps.push(await phase('open-gallery', async () => {
        await picture.click();
        await page.locator('.pswp__img').first().waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('.pswp__img')].some(i => i.complete && i.naturalWidth));
        return stamp();
      }));
      await capture('gallery');
      await page.keyboard.press('Escape');
      await page.locator('.pswp').waitFor({ state: 'detached' });
      steps.push(await phase('reopen-gallery', async () => {
        await picture.click();
        await page.locator('.pswp__img').first().waitFor();
        return stamp();
      }));
      break;
    }
    case 'reading':
      await page.locator('.intro').hover();
      steps.push(await phase('enter-reading', async () => {
        await page.locator('#reading-mode').click();
        await page.locator('html[data-reading]').waitFor({ state: 'attached' });
        return stamp();
      }));
      await capture('reading');
      steps.push(await phase('exit-reading', async () => {
        await page.locator('#reading-mode').click();
        await page.locator('html[data-reading]').waitFor({ state: 'detached' });
        return stamp();
      }));
      break;
    case 'outline': {
      const tocToggle = page.locator('[popovertarget="article-contents"]');
      if (device === 'mobile') {
        steps.push(await phase('open-outline', async () => {
          await tocToggle.click();
          await page.locator('#article-contents:popover-open').waitFor();
          return stamp();
        }));
      }
      steps.push(await phase('follow-outline', async () => {
        const link = page.locator('#article-contents [data-heading]').last();
        const hash = await link.getAttribute('href');
        await link.click();
        await page.waitForFunction(hash => decodeURIComponent(location.hash) === decodeURIComponent(hash), hash);
        return page.evaluate(() => ({ hash: location.hash, ms: performance.now() }));
      }));
      break;
    }
    case 'comments':
    case 'comments-delayed-failure': {
      const prose = await checkProse();
      const section = page.locator('.comments');
      const reach = await phase('reach-comments', async () => {
        const initialState = await section.getAttribute('data-state');
        await section.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const scroll = await page.evaluate(() => scrollY);
        const expected = scenario === 'comments-delayed-failure' ? 'failed' : 'ready';
        const trigger = initialState ? 'initial-viewport' : scroll > 0 ? 'scroll' : 'viewport';
        await page.locator(`.comments[data-state="${expected}"]`).waitFor({ state: 'attached' });
        return { ...(await stamp()), trigger, initialState, scroll, state: expected,
          proseBefore: prose, proseAfter: await checkProse(),
          iframeCount: await page.locator('.giscus-frame').count() };
      });
      if (reach.observed.initialState) {
        reach.readyMs = null;
        reach.throughPaintMs = null;
      }
      steps.push(reach);
      await capture(scenario);
      const frame = page.frames().find(f => f.url().startsWith('https://giscus.app/'));
      if (frame) {
        const handle = await page.locator('.giscus-frame').elementHandle();
        const fonts = await frame.evaluate(async () => {
          await document.fonts.ready;
          return [...document.fonts].reduce((counts, f) => ({ ...counts, [f.status]: (counts[f.status] ?? 0) + 1 }), {});
        });
        steps.at(-1).observed.iframeFontStates = fonts;
        steps.push(await phase('revisit-comments', async () => {
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
          await section.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          return { ...(await stamp()), sameFrame: await handle.evaluate(el => el === document.querySelector('.giscus-frame')) };
        }));
        await handle.dispose();
      }
      break;
    }
    case 'font-fallback':
      steps.push({ name: 'swap-font', observed: { fallback, finalFonts: initial.platformFonts,
        fonts: initial.fonts.map(f => ({ type: f.type, ms: f.ms, count: f.faces.length })), cls: initial.cls,
        shifts: initial.shifts, fcp: initial.paints.find(p => p.name === 'first-contentful-paint')?.ms } });
      break;
    case 'cross-article': {
      requests.phase('cross-article');
      const beforeNext = await getJS(cdp);
      // The mobile page exposes adjacent articles, while desktop shows the whole archive.
      const destination = local && device === 'mobile' ? '/posts/lab-depth/' : rolePaths[textRole];
      const link = page.locator(`a[href="${destination}"]:visible`).first();
      await Promise.all([page.waitForURL(url => url.pathname === destination, { waitUntil: 'domcontentloaded' }), link.click()]);
      await page.waitForLoadState('load');
      steps.push({ name: 'cross-article', next: await samplePage(page, cdp, beforeNext) });
      break;
    }
  }
  await requests.flush();
  return { type: 'interaction', start, device, network, scenario, sample, initial, steps, url: page.url(),
    requests: requests.rows, auxiliary: requests.auxiliary(), subframes: requests.subframe, console };

  async function capture(name) {
    if (options.screenshots && sample === 1 && network === 'native') {
      await page.screenshot({ path: join(options.screenshots, `${options.site}-${device}-${name}.png`) });
    }
  }
}

async function isolateComments(context) {
  const previewOrigin = 'http://127.0.0.1:4633';
  // Use the production allowlisted origin inside this context. Every fixture request is local.
  await context.route(origins.production + '/**', async route => {
    const url = new URL(route.request().url());
    const response = await context.request.get(new URL(url.pathname + url.search, previewOrigin).href);
    const headers = { ...response.headers(), 'access-control-allow-origin': '*' };
    try {
      await route.fulfill({ response, headers });
    } finally {
      await response.dispose();
    }
  });
  await context.route(fontCdn + '/**', route => {
    const path = new URL(route.request().url()).pathname;
    const name = path.slice(fontPrefix.length + 2);
    if (!path.startsWith('/' + fontPrefix + '/') || !/^(?:faces\.css|[a-f0-9]{20}\.woff2)$/.test(name)) return route.abort();
    return route.fulfill({ path: resolve(fontDirectory, name), headers: { 'access-control-allow-origin': '*' } });
  });
  await context.route('https://giscus.app/**', route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/client.js') return route.fulfill({ contentType: 'text/javascript', body: giscusClientFixture });
    if (pathname === '/zh-CN/widget') return route.fulfill({ contentType: 'text/html', body: giscusWidgetFixture({ discussion: true }) });
    return route.abort();
  });
}

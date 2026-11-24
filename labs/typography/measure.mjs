// Run inside ego-browser nodejs using the wrapper in the report.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = 'http://127.0.0.1:4601';
const scenes = ['tech', 'essay', 'life'];
const sizes = [[1440, 900], [1024, 768], [390, 844], [375, 812]];
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function viewport(page, width, height) {
  await page.cdp('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600,
  });
}
async function openPage(page, scene, query) {
  await page.goto(base + '/' + scene + '/?' + new URLSearchParams(query));
  await page.waitForFunction(() => document.readyState === 'complete' &&
    [...document.fonts].some(face => face.status === 'loaded') && document.fonts.status === 'loaded');
  await page.evaluate(settle);
}
async function fontsFor(page, selector) {
  const { root } = await page.cdp('DOM.getDocument');
  const { nodeId } = await page.cdp('DOM.querySelector', { nodeId: root.nodeId, selector });
  return (await page.cdp('CSS.getPlatformFontsForNode', { nodeId })).fonts;
}
function observeSwap() {
  window.fontAudit = { bounds: [], shifts: [] };
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) window.fontAudit.shifts.push({ ms: e.startTime, value: e.value });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  let last = '';
  function sample() {
    const a = document.querySelector('article');
    if (a) {
      const loaded = [...document.fonts].filter(f => f.status === 'loaded').length;
      const height = a.offsetHeight;
      const first = document.querySelector('.prose p').offsetHeight;
      const key = [loaded, height, first].join(',');
      if (key !== last) window.fontAudit.bounds.push({ ms: performance.now(), loaded, height, first });
      last = key;
    }
    if (document.fonts.status !== 'loaded' || !a || !last || last.startsWith('0,')) requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
function cls(entries) {
  let start = -Infinity, last = -Infinity, sum = 0, max = 0;
  for (const { ms, value } of entries) {
    if (ms - last >= 1000 || ms - start >= 5000) { start = ms; sum = 0; }
    last = ms; sum += value; max = Math.max(max, sum);
  }
  return max;
}
function metrics() {
  const entries = performance.getEntriesByType('resource');
  const files = entries.filter(e => e.name.endsWith('.woff2'));
  const css = entries.find(e => e.name.endsWith('faces.css'));
  return {
    resources: files.map(e => ({ file: e.name.split('/').pop(), body: e.encodedBodySize, transfer: e.transferSize, ms: e.duration })),
    count: files.length, transfer: files.reduce((s,e) => s + e.transferSize, 0),
    body: files.reduce((s,e) => s + e.encodedBodySize, 0), cached: files.filter(e => !e.transferSize).length,
    css: { transfer: css.transferSize, encoded: css.encodedBodySize, decoded: css.decodedBodySize },
    lastFontEnd: Math.max(...files.map(e => e.responseEnd)), protocol: css.nextHopProtocol,
    ...window.fontAudit, finalHeight: document.querySelector('article').offsetHeight,
  };
}
function geometry() {
  const q = s => document.querySelector(s);
  const rect = el => el.getBoundingClientRect();
  const body = q('.prose');
  const style = getComputedStyle(body);
  const faults = [], firstLineLengths = [];
  let lines = 0;
  // Group visible text by rendered line. Inspect Chinese punctuation on both ends.
  for (const el of document.querySelectorAll('.prose p, h1, h2, h3, figcaption')) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textLines = new Map();
    while (walker.nextNode()) {
      const node = walker.currentNode, range = document.createRange();
      for (let i = 0; i < node.length; i++) {
        range.setStart(node,i); range.setEnd(node,i+1);
        const r = range.getBoundingClientRect();
        if (r.width) textLines.set(r.top, (textLines.get(r.top) || '') + node.data[i]);
      }
    }
    for (const line of textLines.values()) {
      lines++;
      if (/^[，。！？、：；）》】”’]/.test(line.trim()) || /[（《【“‘]$/.test(line.trim())) faults.push(line);
    }
    if (el.matches('.prose > p')) firstLineLengths.push([...textLines.values()][0]?.length);
  }
  const heading = q('h1');
  const code = q('pre');
  let codeScroll = null;
  if (code) {
    code.scrollLeft = code.scrollWidth;
    codeScroll = { end: code.scrollLeft, pageX: window.scrollX };
    code.scrollLeft = 0;
  }
  return {
    colors: { paper: getComputedStyle(document.body).backgroundColor, ink: style.color,
      muted: getComputedStyle(q('nav')).color, accent: getComputedStyle(q('.caption')).color },
    codeScroll, viewport: [innerWidth,innerHeight], theme: document.documentElement.dataset.theme,
    column: rect(body).width, size: style.fontSize, leading: style.lineHeight,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    titleLines: Math.round(rect(heading).height / parseFloat(getComputedStyle(heading).lineHeight)),
    lines, punctuationFaults: faults, firstLineCharacters: firstLineLengths[0], height: Math.round(rect(body).height),
    blocks: [...document.querySelectorAll('pre,table')].map(el => ({ type: el.tagName, width: el.clientWidth, content: el.scrollWidth, overflow: getComputedStyle(el).overflowX })),
    images: [...document.images].map(im => ({ decoded: im.complete && im.naturalWidth > 0, width: rect(im).width, height: rect(im).height, natural: [im.naturalWidth,im.naturalHeight] })),
  };
}
export async function audit(task, out) {
  const page = task.page('p1');
  await mkdir(join(out,'screenshots'), { recursive: true });
  const save = (name,obj) => writeFile(join(out,name), JSON.stringify(obj,null,2) + '\n');
  await page.cdp('Network.enable');
  await page.cdp('DOM.enable');
  await page.cdp('CSS.enable');
  const {identifier} = await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source: '(' + observeSwap.toString() + ')()'});
  const network = [];
  for (const [width,height] of [sizes[0],sizes[3]]) {
    await viewport(page,width,height);
    for (const scene of scenes) {
      for (const mode of ['cold','prime','repeat','delay']) {
        // Prime using normal cache before testing a separate repeat navigation.
        await page.cdp('Network.setCacheDisabled',{cacheDisabled:mode === 'cold' || mode === 'delay'});
        if (mode === 'delay') await page.cdp('Network.emulateNetworkConditions', {
          offline:false,latency:100,downloadThroughput:600000,uploadThroughput:200000,
        });
        await openPage(page,scene,{theme:'light',visit:mode});
        if (mode !== 'prime') {
          const m = await page.evaluate(metrics);
          if (!m.count || (mode === 'repeat' ? m.cached !== m.count : m.cached > 0)) {
            throw Error('Unexpected font cache result for ' + scene + '/' + mode);
          }
          network.push({width,scene,mode,...m,cls:cls(m.shifts),
            fonts:await fontsFor(page,'.prose p'),...(scene === 'tech' && {code:await fontsFor(page,'pre code')})});
        }
        if (mode === 'delay') await page.cdp('Network.emulateNetworkConditions', {
          offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1,
        });
      }
    }
  }
  await save('network.json',network);
  await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier});
  await page.cdp('Network.setCacheDisabled',{cacheDisabled:false});
  const matrix = [];
  for (const [width,height] of sizes) {
    await viewport(page,width,height);
    for (const scene of scenes) {
      for (const theme of ['light','dark']) {
        for (const profile of [{size:17,leading:1.8,measure:680},{size:18,leading:1.9,measure:720},{leading:1.85,measure:700}]) {
          const query = {theme,...profile};
          await openPage(page,scene,query);
          const m = await page.evaluate(geometry);
          if (m.viewport[0] !== width || m.pageOverflow || m.punctuationFaults.length ||
              m.images.some(x => !x.decoded) || (m.codeScroll && (m.codeScroll.pageX || !m.codeScroll.end))) {
            throw Error(JSON.stringify(m));
          }
          matrix.push({width,scene,query,...m});
          const hero = !profile.size && ((width === 1440 && theme === 'light') || (width === 375 && theme === 'dark'));
          const middle = !profile.size && scene === 'essay' &&
            (width === 390 || width === 1024 || (width === 375 && theme === 'light') || (width === 1440 && theme === 'dark'));
          const compare = profile.size && scene === 'essay' && width === 390 && theme === 'light';
          const detail = hero && scene === 'tech';
          const screenshot = part => page.screenshot({path:join(out,'screenshots',[scene,width,theme,profile.size || 'default',part].join('-') + '.png')});
          if (hero) await screenshot('top');
          if (hero && scene === 'life') {
            await page.evaluate(() => document.querySelectorAll('figure')[1].scrollIntoView({block:'center'}));
            await page.evaluate(settle);
            await screenshot('photo');
          }
          if (middle || compare || detail) {
            await page.evaluate(target => document.querySelector(target).scrollIntoView({block:'start'}),detail?'pre':'.prose > p:nth-child(6)');
            await page.evaluate(settle);
            await screenshot(detail?'code':'middle');
          }
        }
      }
    }
    await save('matrix.json',matrix);
  }
  console.log({rows:matrix.length,network:network.length,ua:await page.evaluate(()=>navigator.userAgent)});
}

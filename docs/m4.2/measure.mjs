// Called by ego-browser in an existing QA TaskSpace. See README for the invocation.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = 'http://127.0.0.1:4632';
const sizes = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812]];
const captures = new Set([
  'list-1440-light', 'cards-1440-light', 'cards-1024-dark', 'list-390-light',
  'cards-375-dark', 'tech-1440-light', 'tech-1024-light', 'tech-768-dark',
  'tech-390-light', 'tech-375-dark', 'life-390-dark', 'essay-1440-dark',
]);

function measure() {
  const q = s => document.querySelector(s);
  const prose = q('.prose');
  const pre = q('pre');
  const table = q('.table-scroll');
  const rail = q('.library');
  return {
    viewport: innerWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    theme: getComputedStyle(document.documentElement).colorScheme,
    subsets: [...document.fonts].filter(f => f.status === 'loaded').length,
    column: prose?.clientWidth,
    font: getComputedStyle(document.body).fontSize,
    leading: getComputedStyle(document.body).lineHeight,
    images: [...document.images].map(img => [img.naturalWidth, img.naturalHeight]),
    archivePosition: rail && getComputedStyle(rail).position,
    archiveSize: rail?.querySelectorAll('a').length,
    tocPosition: q('.contents') && getComputedStyle(q('.contents')).position,
    codeOverflow: pre && pre.scrollWidth - pre.clientWidth,
    tableOverflow: table && table.scrollWidth - table.clientWidth,
  };
}

export async function audit(page) {
  const rows = [];
  for (const [width, height] of sizes) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    for (const theme of ['light', 'dark']) {
      await page.cdp('Emulation.setEmulatedMedia', { features: [
        { name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' },
      ] });
      for (const scene of ['list', 'cards', 'tech', 'life', 'essay']) {
        const home = scene === 'list' || scene === 'cards';
        await page.goto(base + (home ? '/' : `/posts/lab-${scene}/`));
        if (home) await page.click('#settings-trigger');
        if (home) await page.click(`button[data-mode="${scene}"]`);
        await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.fonts].some(f => f.status === 'loaded'));
        if (scene !== 'list') await page.evaluate(async () => {
          await Promise.all([...document.images].map(img => img.decode()));
        });
        const result = await page.evaluate(measure);
        assert.equal(result.viewport, width);
        assert.equal(result.theme, theme);
        assert.equal(result.overflow, 0);
        assert.equal(result.font, width <= 600 ? '17px' : '18px');
        if (!home) {
          assert.equal(result.archiveSize, 5);
          assert.equal(result.archivePosition, width >= 1180 ? 'sticky' : 'static');
          assert.equal(result.column, Math.min(700, width - 40));
        }
        if (scene === 'tech') {
          assert.equal(result.tocPosition, 'sticky');
          assert.ok(result.codeOverflow > 0);
        }
        if (scene === 'cards') assert.equal(result.images.length, 5);
        if (scene === 'life') assert.equal(result.images.length, 2);
        const name = `${scene}-${width}-${theme}`;
        if (captures.has(name)) {
          let anchor;
          if (name === 'tech-375-dark') anchor = 'pre';
          if (name === 'essay-1440-dark') anchor = '.prose p:nth-child(6)';
          if (name === 'life-390-dark') anchor = 'figure';
          if (anchor) await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), anchor);
          await page.screenshot({ path: fileURLToPath(new URL(`screenshots/${name}.png`, import.meta.url)) });
        }
        rows.push({ scene, width, height, ...result });
      }
    }
  }
  await writeFile(new URL('matrix.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n');
  console.log({ passed: rows.length, screenshots: captures.size });
}

// Called by ego-browser in an existing QA TaskSpace. See README for the invocation.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sizes = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812]];
const captures = new Set([
  'list-1440-light', 'cards-1440-light', 'cards-1024-dark', 'list-390-light',
  'cards-375-dark', 'tech-1440-light', 'tech-1024-light', 'tech-768-dark',
  'tech-390-light', 'tech-375-dark', 'life-390-dark', 'essay-1440-dark',
  'depth-1440-light', 'depth-390-dark', 'code-375-dark', 'markdown-1024-light',
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

function outlineMarks() {
  return [...document.querySelectorAll('.contents a')].map(a => {
    const mark = getComputedStyle(a, '::before');
    const row = getComputedStyle(a);
    return {
      width: parseFloat(mark.width), height: parseFloat(mark.height), step: a.getBoundingClientRect().height,
      alignment: row.justifyContent,
      end: a.getBoundingClientRect().right - parseFloat(row.paddingInlineEnd),
      target: document.getElementById(a.dataset.heading)?.tagName,
    };
  });
}

export async function audit(page, base = 'http://localhost:4632') {
  const rows = [];
  for (const [width, height] of sizes) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    for (const theme of ['light', 'dark']) {
      await page.cdp('Emulation.setEmulatedMedia', { features: [
        { name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' },
      ] });
      for (const scene of ['list', 'cards', 'tech', 'life', 'essay', 'depth', 'code', 'markdown']) {
        const home = scene === 'list' || scene === 'cards';
        await page.goto(base + (home ? '/' : `/posts/lab-${scene}/`));
        if (home) {
          await page.click('#settings-trigger');
          await page.click(`button[data-mode="${scene}"]`);
          await page.keyboard.press('Escape');
        }
        if (scene === 'depth') {
          await page.click('#settings-trigger');
          await page.click('[data-outline="mini"]');
          await page.keyboard.press('Escape');
          await page.click('.contents a:nth-child(5)');
          await page.waitForFunction(() => document.querySelector('.contents a:nth-child(5)').hasAttribute('aria-current'));
        }
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
          assert.equal(result.archiveSize, 8);
          assert.equal(result.archivePosition, width >= 1180 ? 'sticky' : 'static');
          assert.equal(result.column, Math.min(700, width - 40));
        }
        if (scene === 'tech') {
          assert.equal(result.tocPosition, 'sticky');
          assert.ok(result.codeOverflow > 0);
        }
        if (scene === 'cards') assert.equal(result.images.length, 8);
        if (scene === 'life') assert.equal(result.images.length, 2);
        if (scene === 'depth') {
          await page.mouse.move(width / 2, 100);
          const resting = await page.evaluate(outlineMarks);
          assert.deepEqual(resting.slice(0, 5).map(m => m.target), ['H2','H3','H4','H5','H6']);
          assert.ok(resting.every(m => m.target && m.height === 2 && m.width === 12 && m.step === 10 && m.alignment === 'flex-end' && m.end === resting[0].end));
          await page.hover('.contents a:nth-child(3)');
          const expanded = await page.evaluate(outlineMarks);
          assert.ok(expanded.every(m => m.height === 2 && m.end === resting[0].end && m.alignment === 'flex-end'));
          assert.ok(expanded.slice(1, 5).every((m, i) => m.width < expanded[i].width));
          if (width === 1440 && theme === 'light') {
            await page.screenshot({ path: fileURLToPath(new URL('screenshots/depth-hover-1440-light.png', import.meta.url)) });
          }
          await page.mouse.move(width / 2, 100);
          assert.deepEqual(await page.evaluate(outlineMarks), resting);
          if (width >= 1180) assert.ok(await page.evaluate(() => Math.abs(document.querySelector('.library').getBoundingClientRect().top - document.querySelector('.contents').getBoundingClientRect().top) <= 1));
        }
        if (scene === 'code') assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('pre')].map(p => p.dataset.language)), ['json','python','bash','sql','typescript','html','css','yaml']);
        if (scene === 'markdown') {
          const missing = await page.evaluate(() => [
            'h1','h2','h3','h4','h5','h6','blockquote blockquote','ol ul','ul ol','li p',
            'pre[data-language="plaintext"]','pre[data-language="text"]','em','strong','code','a[title]',
            'a[href^="mailto:"]','br','hr','figure figcaption','abbr','details','del',
            '.table-scroll table','input[type=checkbox]:checked','input[type=checkbox]:not(:checked)','[data-footnotes]',
          ].filter(s => !document.querySelector('.prose ' + s)));
          assert.deepEqual(missing, []);
          assert.equal(result.images.length, 2);
        }
        const name = `${scene}-${width}-${theme}`;
        if (captures.has(name)) {
          let anchor;
          if (name === 'tech-375-dark') anchor = 'pre';
          if (name === 'essay-1440-dark') anchor = '.prose p:nth-child(6)';
          if (name === 'life-390-dark') anchor = 'figure';
          if (name === 'code-375-dark') anchor = 'h3:has(+ pre[data-language="typescript"])';
          if (name === 'markdown-1024-light') anchor = '.table-scroll';
          if (anchor) await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), anchor);
          await page.screenshot({ path: fileURLToPath(new URL(`screenshots/${name}.png`, import.meta.url)) });
        }
        rows.push({ scene, width, height, ...result });
        if (scene === 'depth') {
          await page.click('#settings-trigger');
          await page.click('[data-outline="full"]');
          await page.keyboard.press('Escape');
        }
      }
    }
  }
  await writeFile(new URL('matrix.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n');
  console.log({ passed: rows.length });
}

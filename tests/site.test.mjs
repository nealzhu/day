import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { preview } from 'astro';
import { chromium } from 'playwright-core';
import { cardPlaceholderFile, cardPlaceholderKey } from '../scripts/card-placeholder.mjs';
import { article, copySiteFixture, temporaryDirectory } from './fixtures.mjs';

test('production build and browser behaviour', async t => {
  const project = await temporaryDirectory(t);
  await copySiteFixture(project);

  const posts = join(project, 'src/content/posts');
  await rm(posts, { recursive: true });
  const bytes = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const file = `first-${digest}.webp`;
  const second = `second-${digest}.webp`;
  const directory = await article(posts, 'pictured', {}, [
    '`![example](./assets/ignored.webp)`', '## Notes', '![first][ref]',
    ['| Key | Value |', '| --- | --- |', `| Asset | ${'0123456789abcdef'.repeat(10)} |`].join('\n'),
    `![second](./assets/${second})`, '段落中的文字。'.repeat(160), '### Notes', '| 甲 | 乙 |\n| --- | --- |\n| 一 | 二 |', '下一节的正文。'.repeat(160), `[ref]: ./assets/${file} "图注"`,
    '#### Afterword', '##### Imprint', '###### Credits', 'End.',
  ].join('\n\n'));
  await mkdir(join(directory, 'assets'));
  for (const name of [file, second]) await writeFile(join(directory, 'assets', name), bytes);
  await article(posts, 'text-only', { category: undefined });
  const older = Array.from({ length: 30 }, (_, i) => `archive-${String(i).padStart(2, '0')}`);
  for (const id of older) await article(posts, id, { category: undefined, publishedAt: '2025-01-01' });
  await article(posts, 'secret-draft', { status: 'draft' });
  await article(posts, 'implicit-draft', { status: undefined });

  const cdn = 'https://fixture.invalid';
  execFileSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build', '--force'], {
    cwd: project, env: { ...process.env, MEDIA_BASE_URL: cdn }, stdio: 'pipe',
  });
  const dist = join(project, 'dist');
  const placeholder = await readFile(join(project, cardPlaceholderFile));
  const placeholderUrl = `${cdn}/${cardPlaceholderKey}`;
  const cover = `${cdn}/posts/pictured/${file}`;
  const html = path => readFile(join(dist, path), 'utf8');

  await t.test('drafts and WebPs are absent from the entire output', async () => {
    const files = await readdir(dist, { recursive: true, withFileTypes: true });
    for (const entry of files.filter(entry => entry.isFile())) {
      const path = join(entry.parentPath, entry.name);
      assert.doesNotMatch(path, /\.webp$|secret-draft|implicit-draft/i);
      if (path.endsWith('.woff2')) continue;
      assert.doesNotMatch(await readFile(path, 'utf8'), /secret-draft|implicit-draft/);
    }
  });

  await t.test('routes, CDN cover, headings, canonical, RSS and sitemap', async () => {
    const home = await html('index.html');
    assert.ok(home.includes(cover));
    assert.ok(!home.includes(second));
    const detail = await html('posts/pictured/index.html');
    assert.ok(detail.includes(cover) && detail.includes(second));
    assert.match(detail, /href="#notes-1"/);
    assert.match(detail, /id="notes-1"/);
    assert.match(detail, /rel="canonical" href="https:\/\/qians.day\/posts\/pictured\/"/);
    assert.doesNotMatch(await html('posts/text-only/index.html'), /<img\b/);
    assert.doesNotMatch(await html('posts/text-only/index.html'), /categories\/undefined|未分类/);
    assert.match(detail, /<figcaption>图注<\/figcaption>/);
    assert.equal(detail.split(cover).length - 1, 1);
    assert.match(home, /href="\/posts\/text-only\/"/);
    assert.match(await html('categories/index.html'), /1 篇/);
    assert.doesNotMatch(await html('categories/engineering/index.html'), /href="\/posts\/text-only\/"/);
    assert.match(await html('rss.xml'), /posts\/text-only\//);
    assert.match(await html('sitemap.xml'), /posts\/text-only\//);
    assert.match(await html('rss.xml'), /Test &amp; verify/);
    assert.match(await html('sitemap.xml'), /<loc>https:\/\/qians.day\/posts\/pictured\/<\/loc>/);
    assert.match(await html('404.html'), /content="noindex"/);
  });

  await t.test('list, cards, restored preference and mobile navigation', async t => {
    const server = await preview({ root: project, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
    try {
      const browser = await chromium.launch({ channel: 'chrome' });
      try {
        const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
        await page.route(cdn + '/**', route => route.fulfill({
          contentType: 'image/webp',
          body: route.request().url() === placeholderUrl ? placeholder : bytes,
        }));
        await page.goto(`http://127.0.0.1:${server.server.address().port}/`);
        const settings = page.getByRole('button', { name: '阅读设置' });
        const list = page.locator('button[data-mode="list"]');
        const cards = page.locator('button[data-mode="cards"]');
        async function choose(button) {
          await settings.click();
          await button.click();
        }
        await settings.waitFor();
        assert.equal(await list.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('img').count(), 0);
        await choose(cards);
        assert.equal(await page.locator('img:visible').count(), older.length + 2);
        const imageFor = title => page.getByRole('listitem')
          .filter({ has: page.getByRole('link', { name: title, exact: true }) })
          .locator('img');
        const fallback = imageFor('text-only');
        assert.equal(await fallback.getAttribute('src'), placeholderUrl);
        assert.equal(await fallback.getAttribute('alt'), '');
        await fallback.evaluate(img => img.decode());
        const coverSize = await imageFor('pictured').boundingBox();
        const fallbackSize = await fallback.boundingBox();
        assert.equal(fallbackSize.width, coverSize.width);
        assert.equal(fallbackSize.height, coverSize.height);
        assert.ok(Math.abs(coverSize.width / coverSize.height - 5 / 3) < 0.01);
        await page.reload();
        assert.equal(await cards.getAttribute('aria-pressed'), 'true');
        assert.equal(await imageFor('pictured').getAttribute('src'), cover);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await choose(list);
        assert.equal(await page.locator('img:visible').count(), 0);
        await page.reload();
        assert.equal(await list.getAttribute('aria-pressed'), 'true');
        await page.getByRole('link', { name: '工程' }).click();
        await choose(cards);
        await page.emulateMedia({ colorScheme: 'light' });
        await choose(page.getByRole('button', { name: '深色', exact: true }));
        await page.getByRole('link', { name: 'pictured' }).click();
        await page.waitForURL('**/posts/pictured/');
        await page.waitForLoadState('load');
        const scheme = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
        assert.equal(await scheme(), 'dark');
        await page.goBack();
        assert.equal(await cards.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.posts').getAttribute('data-view'), 'cards');
        await page.getByRole('link', { name: 'pictured' }).click();
        await choose(page.getByRole('button', { name: '随系统' }));
        assert.equal(await scheme(), 'light');
        const section = page.locator('[data-heading="notes-1"]');
        await section.click();
        await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('href') === '#notes-1');
        const mini = page.getByRole('button', { name: '迷你', exact: true });
        const full = page.getByRole('button', { name: '完整', exact: true });
        function markWidths() {
          return [...document.querySelectorAll('.contents a')].map(a => parseFloat(getComputedStyle(a, '::before').width));
        }
        await choose(mini);
        await page.reload();
        assert.equal(await page.locator('[data-outline="mini"]').getAttribute('aria-pressed'), 'true');
        const first = page.locator('[data-heading="notes"]');
        await first.hover();
        const hint = page.locator('.chapter-hint');
        await hint.waitFor();
        assert.equal(await hint.innerText(), 'Notes');
        await first.click();
        await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('href') === '#notes');
        assert.notEqual(await first.evaluate(a => getComputedStyle(a).color), await section.evaluate(a => getComputedStyle(a).color));
        await first.focus();
        await page.mouse.move(10, 100);
        await page.keyboard.press('Tab');
        await hint.waitFor();
        assert.equal(await section.evaluate(a => a === document.activeElement), true);
        assert.deepEqual(await page.evaluate(markWidths), [20, 17, 14, 11, 8]);
        await page.keyboard.press('Escape');
        assert.equal(await hint.isVisible(), false);
        await page.keyboard.press('Enter');
        await page.waitForURL('**/#notes-1');
        await choose(full);
        await section.click();
        await page.waitForFunction(() => {
          const nav = document.querySelector('.contents nav');
          const active = nav.querySelector('[aria-current="location"]');
          if (!active) return false;
          const link = active.getBoundingClientRect();
          const box = nav.getBoundingClientRect();
          return link.left >= box.left - 1 && link.right <= box.right + 1;
        });
        const tables = page.locator('.prose .table-scroll');
        const shortTable = await tables.last().locator('table').boundingBox();
        assert.equal(shortTable.width, (await page.locator('.prose').boundingBox()).width);
        const table = tables.first();
        assert.ok(await table.evaluate(el => {
          el.scrollLeft = el.scrollWidth;
          return el.scrollLeft > 0 && document.documentElement.scrollWidth === innerWidth;
        }));
        const nav = page.getByRole('navigation', { name: '全部已发布文章' });
        assert.deepEqual(await nav.locator('a').allTextContents(), ['pictured', 'text-only', ...older]);
        assert.equal(await nav.locator('[aria-current]').innerText(), 'pictured');
        await nav.getByRole('link', { name: 'text-only' }).click();
        assert.equal(await page.locator('h1').innerText(), 'text-only');
        await page.setViewportSize({ width: 1440, height: 700 });
        await nav.waitFor();
        await page.evaluate(() => document.fonts.ready);
        const previous = await nav.evaluate(el => {
          el.scrollTop = el.scrollHeight;
          return el.scrollTop;
        });
        assert.ok(previous > 0);
        await nav.getByRole('link', { name: older.at(-1) }).click();
        await page.waitForFunction(top => document.querySelector('#library').scrollTop === top, previous);
        assert.equal(await nav.locator('[aria-current]').innerText(), older.at(-1));
        assert.equal((await page.goto(new URL('/posts/secret-draft/', page.url()).href)).status(), 404);
        await t.test('deep closing headings keep distinct destinations at the bottom of the page', async () => {
          await page.goto(new URL('/posts/pictured/', page.url()).href);
          await choose(mini);
          for (const id of ['afterword', 'imprint', 'credits', 'afterword']) {
            await page.locator(`[data-heading="${id}"]`).click();
            await page.waitForFunction(slug => document.querySelector('.contents [aria-current]')?.dataset.heading === slug, id);
          }
          await page.evaluate(() => scrollTo(0, 200));
          await page.waitForFunction(() => Math.abs(document.querySelector('.library').getBoundingClientRect().top - document.querySelector('.contents').getBoundingClientRect().top) < 1);
        });
        await t.test('a saved mini outline previews then follows a chapter on touch', async () => {
          const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
          await phone.goto(new URL('/posts/text-only/', page.url()).href);
          assert.equal(await phone.locator('.contents').count(), 0);
          await phone.getByRole('button', { name: '阅读设置' }).tap();
          await phone.getByRole('button', { name: '迷你', exact: true }).tap();
          await phone.goto(new URL('/posts/pictured/', phone.url()).href);
          const target = phone.locator('[data-heading="notes-1"]');
          const hint = phone.locator('.chapter-hint');
          const resting = await phone.evaluate(markWidths);
          assert.equal(new Set(resting).size, 1);
          await target.tap();
          assert.equal(new URL(phone.url()).hash, '');
          assert.equal(await hint.innerText(), 'Notes');
          assert.ok(await hint.isVisible());
          assert.deepEqual(await phone.evaluate(markWidths), [20, 17, 14, 11, 8]);
          await target.tap();
          await phone.waitForURL('**/#notes-1');
          await phone.waitForFunction(() => document.querySelector('[data-heading="notes-1"]').hasAttribute('aria-current'));
          assert.equal(await hint.isVisible(), false);
          assert.deepEqual(await phone.evaluate(markWidths), resting);
          await phone.close();
        });
      } finally {
        await browser.close();
      }
    } finally {
      await server.stop();
    }
  });
});

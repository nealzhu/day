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
  const chapters = Array.from({ length: 30 }, (_, i) => `## Chapter ${i + 1}\n\nChapter text.`).join('\n\n');
  for (const id of older) {
    await article(posts, id, { category: undefined, publishedAt: '2025-01-01' }, id === older[0] ? chapters : undefined);
  }
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
        const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'no-preference' });
        await page.route(cdn + '/**', route => route.fulfill({
          contentType: 'image/webp',
          body: route.request().url() === placeholderUrl ? placeholder : bytes,
        }));
        await page.goto(`http://127.0.0.1:${server.server.address().port}/`);
        const settings = page.getByRole('button', { name: '阅读设置' });
        const panel = page.locator('#reading-settings:popover-open');
        const list = page.locator('button[data-mode="list"]');
        const cards = page.locator('button[data-mode="cards"]');
        async function choose(button) {
          if (!await panel.count()) await settings.hover();
          await button.click();
          assert.equal(await panel.count(), 1);
          await page.keyboard.press('Escape');
        }
        await settings.waitFor();
        const choices = await page.locator('#reading-settings button[aria-pressed="true"]').allTextContents();
        assert.deepEqual(choices.map(label => label.trim()), ['图文卡片', '随系统', '完整']);
        const views = await page.locator('button[data-mode]').allTextContents();
        assert.deepEqual(views.map(label => label.trim()), ['图文卡片', '列表']);
        assert.equal(await page.locator('img:visible').count(), older.length + 2);
        await t.test('hover and keyboard allow consecutive changes in the reading settings', async () => {
          await settings.hover();
          await panel.waitFor();
          assert.ok(await settings.evaluate(b => {
            const box = b.getBoundingClientRect();
            return document.elementFromPoint(box.x + box.width / 2, box.bottom + 2) === b;
          }));
          await settings.click();
          await list.click();
          await page.getByRole('button', { name: '深色', exact: true }).click();
          assert.equal(await list.getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
          assert.equal(await panel.count(), 1);
          await page.mouse.move(5, 450);
          await panel.waitFor({ state: 'detached' });

          await settings.focus();
          await page.keyboard.press('Enter');
          await page.keyboard.press('Tab');
          assert.equal(await cards.evaluate(b => b === document.activeElement), true);
          await page.keyboard.press('Space');
          assert.equal(await cards.getAttribute('aria-pressed'), 'true');
          assert.equal(await panel.count(), 1);
          await page.keyboard.press('Escape');
          assert.equal(await panel.count(), 0);
          assert.equal(await settings.evaluate(b => b === document.activeElement), true);
        });
        await choose(list);
        await choose(cards);
        assert.equal(await page.locator('img:visible').count(), older.length + 2);
        const imageFor = title => page.getByRole('listitem')
          .filter({ has: page.getByRole('link', { name: title, exact: true }) })
          .locator('img');
        const fallback = imageFor('text-only');
        assert.notEqual(await fallback.evaluate(img => getComputedStyle(img).animationName), 'none');
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
        assert.equal(await imageFor('pictured').evaluate(img => getComputedStyle(img).animationName), 'none');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await choose(list);
        assert.equal(await page.locator('img:visible').count(), 0);
        await page.reload();
        assert.equal(await list.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('img:visible').count(), 0);
        assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('.webp'))), false);
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
        assert.equal(await page.locator('html').getAttribute('data-view'), 'cards');
        await page.getByRole('link', { name: 'pictured' }).click();
        await choose(page.getByRole('button', { name: '随系统' }));
        assert.equal(await scheme(), 'light');
        const section = page.locator('[data-heading="notes-1"]');
        await section.click();
        await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('href') === '#notes-1');
        const mini = page.getByRole('button', { name: '迷你', exact: true });
        const full = page.getByRole('button', { name: '完整', exact: true });
        function marksAtWidths(expected) {
          const links = [...document.querySelectorAll('.contents a')];
          return links.length === expected.length && links.every((a, i) => parseFloat(getComputedStyle(a, '::before').width) === expected[i]);
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
        await page.waitForFunction(marksAtWidths, [20, 17, 14, 11, 8]);
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
        await t.test('the full outline can be scrolled to its last link without scrolling the article', async t => {
          const reader = await browser.newPage();
          t.after(() => reader.close());
          await reader.goto(new URL(`/posts/${older[0]}/`, page.url()).href);
          await reader.evaluate(() => document.fonts.ready);
          const outline = reader.getByRole('navigation', { name: '本文目录' });
          const last = outline.getByRole('link').last();
          for (const { width, height, y } of [
            { width: 1440, height: 900, y: 0 },
            { width: 1440, height: 900, y: 70 },
            { width: 1440, height: 900, y: 600 },
            { width: 1024, height: 600, y: 600 },
            { width: 1024, height: 600, y: 0 },
          ]) {
            await reader.setViewportSize({ width, height });
            await reader.evaluate(y => scrollTo(0, y), y);
            await reader.waitForFunction(() => Math.abs(document.querySelector('.contents nav').getBoundingClientRect().bottom - innerHeight) <= 1);
            const box = await outline.boundingBox();
            await reader.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await reader.mouse.wheel(0, 3000);
            await reader.waitForFunction(() => {
              const nav = document.querySelector('.contents nav');
              return nav.scrollTop > 0 && nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 1;
            });
            assert.equal(await reader.evaluate(() => scrollY), y);
            assert.ok(await last.evaluate(a => {
              const box = a.getBoundingClientRect();
              return box.bottom <= innerHeight && a.contains(document.elementFromPoint(box.x + box.width / 2, box.bottom - 1));
            }));
          }
          await last.click();
          await reader.waitForURL('**/#chapter-30');
          await reader.waitForFunction(() => document.querySelector('.contents [aria-current]')?.hash === '#chapter-30');
        });
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
          await phone.emulateMedia({ reducedMotion: 'reduce' });
          await phone.goto(new URL('/posts/text-only/', page.url()).href);
          assert.equal(await phone.locator('.contents').count(), 0);
          await phone.getByRole('button', { name: '阅读设置' }).tap();
          await phone.getByRole('button', { name: '迷你', exact: true }).tap();
          await phone.getByRole('button', { name: '列表', exact: true }).tap();
          assert.equal(await phone.locator('#reading-settings:popover-open').count(), 1);
          await phone.touchscreen.tap(6, 6);
          assert.equal(await phone.locator('#reading-settings:popover-open').count(), 0);
          await phone.goto(new URL('/posts/pictured/', phone.url()).href);
          const target = phone.locator('[data-heading="notes-1"]');
          const hint = phone.locator('.chapter-hint');
          const resting = [12, 12, 12, 12, 12];
          assert.ok(await phone.evaluate(marksAtWidths, resting));
          assert.equal(await target.evaluate(a => getComputedStyle(a, '::before').transitionDuration), '0s');
          await target.tap();
          assert.equal(new URL(phone.url()).hash, '');
          assert.equal(await hint.innerText(), 'Notes');
          assert.ok(await hint.isVisible());
          assert.ok(await phone.evaluate(marksAtWidths, [20, 17, 14, 11, 8]));
          await target.tap();
          await phone.waitForURL('**/#notes-1');
          await phone.waitForFunction(() => document.querySelector('[data-heading="notes-1"]').hasAttribute('aria-current'));
          assert.equal(await hint.isVisible(), false);
          assert.ok(await phone.evaluate(marksAtWidths, resting));
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

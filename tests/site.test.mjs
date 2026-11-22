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
    `![second](./assets/${second})`, '### Notes', `[ref]: ./assets/${file} "图注"`,
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

  await t.test('list, cards, restored preference and mobile navigation', async () => {
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
        const list = page.getByRole('button', { name: '列表' });
        const cards = page.getByRole('button', { name: '图文卡片' });
        assert.equal(await list.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('img').count(), 0);
        await cards.click();
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
        await list.click();
        assert.equal(await page.locator('img:visible').count(), 0);
        await page.reload();
        assert.equal(await list.getAttribute('aria-pressed'), 'true');
        await page.getByRole('link', { name: '工程' }).click();
        await page.getByRole('link', { name: 'pictured' }).click();
        const table = page.locator('.prose table');
        assert.ok(await table.evaluate(el => {
          el.scrollLeft = el.scrollWidth;
          return el.scrollLeft > 0 && document.documentElement.scrollWidth === innerWidth;
        }));
        await page.locator('.library summary').click();
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
      } finally {
        await browser.close();
      }
    } finally {
      await server.stop();
    }
  });
});

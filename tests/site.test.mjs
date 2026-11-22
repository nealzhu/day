import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { preview } from 'astro';
import { chromium } from 'playwright-core';
import { article, temporaryDirectory } from './fixtures.mjs';

test('production build and browser behaviour', async t => {
  const project = await temporaryDirectory(t);
  for (const path of ['src', 'scripts', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
    await cp(path, join(project, path), { recursive: true });
  }
  // Link packages individually so Astro and Vite write caches only inside the fixture.
  const modules = join(project, 'node_modules');
  await mkdir(modules);
  for (const name of await readdir('node_modules')) {
    if (!name.startsWith('.')) await symlink(resolve('node_modules', name), join(modules, name), 'dir');
  }

  const posts = join(project, 'src/content/posts');
  await rm(posts, { recursive: true });
  const bytes = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const file = `first-${digest}.webp`;
  const second = `second-${digest}.webp`;
  const directory = await article(posts, 'pictured', {}, [
    '`![example](./assets/ignored.webp)`', '## Notes', '![first][ref]',
    `![second](./assets/${second})`, '### Notes', `[ref]: ./assets/${file}`,
  ].join('\n\n'));
  await mkdir(join(directory, 'assets'));
  for (const name of [file, second]) await writeFile(join(directory, 'assets', name), bytes);
  await article(posts, 'text-only');
  await article(posts, 'secret-draft', { status: 'draft' });
  await article(posts, 'implicit-draft', { status: undefined });

  const cdn = 'https://fixture.invalid';
  execFileSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build', '--force'], {
    cwd: project, env: { ...process.env, MEDIA_BASE_URL: cdn }, stdio: 'pipe',
  });
  const dist = join(project, 'dist');
  const cover = `${cdn}/posts/pictured/${file}`;
  const html = path => readFile(join(dist, path), 'utf8');

  await t.test('drafts and WebPs are absent from the entire output', async () => {
    const files = await readdir(dist, { recursive: true, withFileTypes: true });
    for (const entry of files.filter(entry => entry.isFile())) {
      const path = join(entry.parentPath, entry.name);
      assert.doesNotMatch(path, /\.webp$|secret-draft|implicit-draft/i);
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
    assert.match(await html('categories/index.html'), /2 篇/);
    assert.match(await html('categories/engineering/index.html'), /href="\/posts\/text-only\/"/);
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
        await page.route(cdn + '/**', route => route.fulfill({ contentType: 'image/webp', body: bytes }));
        await page.goto(`http://127.0.0.1:${server.server.address().port}/`);
        const list = page.getByRole('button', { name: '列表' });
        const cards = page.getByRole('button', { name: '图文卡片' });
        assert.equal(await list.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('img').count(), 0);
        await cards.click();
        assert.equal(await page.locator('img:visible').count(), 1);
        await page.reload();
        assert.equal(await cards.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('img').getAttribute('src'), cover);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await list.click();
        assert.equal(await page.locator('img:visible').count(), 0);
        await page.reload();
        assert.equal(await list.getAttribute('aria-pressed'), 'true');
        await page.getByRole('link', { name: '工程' }).click();
        await page.getByRole('link', { name: 'text-only' }).click();
        assert.equal(await page.locator('h1').innerText(), 'text-only');
        assert.equal((await page.goto(new URL('/posts/secret-draft/', page.url()).href)).status(), 404);
      } finally {
        await browser.close();
      }
    } finally {
      await server.stop();
    }
  });
});

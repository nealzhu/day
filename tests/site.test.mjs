import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { preview } from 'astro';
import { chromium } from 'playwright-core';
import { cardPlaceholderFile, cardPlaceholderKey } from '../scripts/card-placeholder.mjs';
import { article, copySiteFixture, giscusClientFixture, giscusWidgetFixture, temporaryDirectory } from './fixtures.mjs';

test('production build and browser behaviour', async t => {
  const project = await temporaryDirectory(t);
  await copySiteFixture(project);

  const posts = join(project, 'src/content/posts');
  await rm(posts, { recursive: true });
  const bytes = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAYAAAAdQmkrUqv+BiOh/AAA=', 'base64');
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
  await article(posts, 'text-only', { category: undefined, description: '北极星摘要。' },
    '我用 Cloudflare 存档星图，翻到一张罕见的地图。 pictured');
  await writeFile(join(project, 'src/pages/typography-check.astro'), `---
import Site from '../layouts/Site.astro';
---
<Site title="排版实验" description="排版实验" noindex>
  <article data-pagefind-body>排版实验独有内容</article>
</Site>`);
  const older = Array.from({ length: 30 }, (_, i) => `archive-${String(i).padStart(2, '0')}`);
  const grouped = older.slice(3, 16);
  const chapters = Array.from({ length: 30 }, (_, i) => `## Chapter ${i + 1}\n\nChapter text.`).join('\n\n');
  const viewerPost = older[1];
  const landscape = await readFile('labs/typography/public/photos/coffee.webp');
  const landscapeFile = `landscape-${createHash('sha256').update(landscape).digest('hex').slice(0, 12)}.webp`;
  const portraitFile = `portrait-${digest}.webp`;
  const failedFile = `unavailable-${digest}.webp`;
  for (const id of older.filter(id => id !== viewerPost)) {
    await article(posts, id, { category: grouped.includes(id) ? 'engineering' : undefined, publishedAt: '2025-01-01' }, id === older[0] ? chapters : 'Searchpagination.');
  }
  const quoted = '中文、Cloudflare & 阅读分享';
  const contextA = '小院的青苔和风吹过玻璃窗，也记录了';
  const contextB = '深秋的竹影在石墙边慢慢挪动，想起了';
  const viewerDirectory = await article(posts, viewerPost, { category: undefined, publishedAt: '2025-01-01' }, [
    'Searchpagination.', '## 说明', '图片在以下段落按文章顺序展示。'.repeat(25),
    `${contextA}「${quoted}」，这段话来自第一篇读书笔记的扉页。`,
    `${contextB}「${quoted}」，这是第二篇笔记的折角所记。`,
    '```txt\n不应该显示段落分享的代码。\n```',
    `![横向照片](./assets/${landscapeFile} "咖啡照片")`,
    `[![竖向图片](./assets/${portraitFile})](#说明)`,
    `![网络错误例图](./assets/${failedFile})`,
  ].join('\n\n'));
  await mkdir(join(viewerDirectory, 'assets'));
  for (const [name, data] of [[landscapeFile, landscape], [portraitFile, bytes], [failedFile, bytes]]) {
    await writeFile(join(viewerDirectory, 'assets', name), data);
  }
  await article(posts, 'secret-draft', { status: 'draft' }, '草稿独有内容');
  await article(posts, 'implicit-draft', { status: undefined });

  const cdn = 'https://fixture.invalid';
  const dist = join(project, 'dist');
  await t.test('production pages reference CDN fonts without bundling a second copy', async () => {
    execFileSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build', '--force'], {
      cwd: project, env: { ...process.env, MEDIA_BASE_URL: cdn }, stdio: 'pipe',
    });
    const files = await readdir(dist, { recursive: true });
    const pagefind = JSON.parse(await readFile(join(dist, 'pagefind/pagefind-entry.json'), 'utf8'));
    assert.equal(pagefind.version, '1.6.0');
    assert.equal(pagefind.languages['zh-cn'].page_count, older.length + 2);
    assert.ok(!files.some(path => /^pagefind[\/\\]pagefind-(.*ui|highlight)\./.test(path)));
    assert.ok(!files.some(path => /\.woff2$|faces\.css$|^fonts[\/\\]/.test(path)));
    for (const path of files.filter(path => path.endsWith('.html'))) {
      assert.ok((await readFile(join(dist, path), 'utf8')).includes(
        'href="https://site-cdn.qians.day/fonts/lxgw-wenkai/v1.530/faces.css"'), path);
    }
  });

  await t.test('comments are lazy, isolated by Article ID, recoverable and theme-aware', async t => {
    const server = await preview({ root: project, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(async () => { await browser.close(); await server.stop(); });
    const reader = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    const site = 'https://qians.day';
    const provider = 'https://giscus.app';
    const local = `http://127.0.0.1:${server.server.address().port}`;
    const requests = [];
    const themeRequests = [];
    let breakScript = true;
    let breakWidget = true;
    await reader.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === site) {
        if (url.pathname === '/comments/theme.css') {
          themeRequests.push(url);
          return route.fulfill({ contentType: 'text/css', headers: { 'access-control-allow-origin': provider },
            body: await readFile(join(dist, 'comments/theme.css'), 'utf8') });
        }
        return route.fulfill({ response: await route.fetch({ url: new URL(url.pathname, local).href }) });
      }
      if (url.origin !== provider) return route.abort();
      requests.push(url);
      if (url.pathname === '/client.js') {
        if (breakScript) return route.abort();
        return route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': site }, body: giscusClientFixture });
      }
      assert.equal(url.pathname, '/zh-CN/widget');
      const discussion = url.searchParams.get('term') === 'article-pictured';
      const signedIn = new URL(url.searchParams.get('origin')).searchParams.has('preview-auth');
      return route.fulfill({ contentType: 'text/html', body: breakWidget
        ? giscusWidgetFixture({ error: 'API rate limit exceeded' })
        : giscusWidgetFixture({ discussion, signedIn }) });
    });

    await reader.goto(`${site}/posts/pictured/`);
    const comments = reader.getByRole('region', { name: '欢迎留下你的想法' });
    const frame = comments.locator('iframe');
    await comments.getByRole('button', { name: '加载评论' }).waitFor({ state: 'attached' });
    assert.equal(requests.length, 0);
    assert.equal(themeRequests.length, 0);
    await reader.keyboard.press('i');
    await reader.keyboard.press('End');
    assert.ok(await comments.isHidden());
    assert.equal(requests.length, 0);
    await reader.keyboard.press('i');
    await comments.evaluate(section => section.scrollIntoView());
    const retry = comments.getByRole('button', { name: '重试' });
    await retry.waitFor();
    assert.deepEqual(requests.map(url => url.pathname), ['/client.js']);
    assert.equal(await frame.count(), 0);

    breakScript = false;
    await retry.click();
    await frame.waitFor({ state: 'attached' });
    await retry.waitFor();
    const originalFrame = await frame.elementHandle();
    breakWidget = false;
    await retry.click();
    await frame.waitFor();
    assert.equal(await comments.getByRole('link', { name: /查看讨论/ }).count(), 0);
    assert.ok(await originalFrame.evaluate(element => element === document.querySelector('.giscus-frame')));
    assert.deepEqual(requests.map(url => url.pathname), ['/client.js', '/client.js', '/zh-CN/widget', '/zh-CN/widget']);
    const query = requests.at(-1).searchParams;
    for (const [key, value] of Object.entries({
      mapping: 'specific', strict: '1', term: 'article-pictured', repo: 'nealzhu/day', repoId: 'R_kgDOV2z4ZA',
      category: 'Article Comments', categoryId: 'DIC_kwDOV2z4ZM4DMC8T', backLink: `${site}/posts/pictured/`,
      lang: 'zh-CN', reactionsEnabled: '1', inputPosition: 'top', loading: 'lazy',
      theme: `${site}/comments/theme.css#light`,
    })) assert.equal(query.get(key), value, key);

    const widget = frame.contentFrame();
    const reaction = widget.locator('.gsc-reactions-menu summary[aria-label="添加回应"]').first();
    await reaction.waitFor();
    await widget.locator('.gsc-reactions-count').waitFor({ state: 'hidden' });
    assert.equal(await widget.locator('.gsc-comments-count').isVisible(), false);
    assert.equal(await widget.locator('.gsc-comment-box-tabs').isVisible(), false);
    const chips = widget.locator('.gsc-reactions .gsc-direct-reaction-buttons button');
    const chipPositions = () => chips.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().toJSON()));
    const positions = await chipPositions();
    await reaction.click();
    const menu = widget.locator('.gsc-reactions .gsc-reactions-popover');
    await menu.getByText('后可添加回应。').waitFor();
    assert.deepEqual(await chipPositions(), positions);
    assert.equal(await menu.locator('button:disabled').count(), 8);
    await reaction.click();
    assert.ok(await widget.locator('.gsc-comment-author-avatar img').first().isVisible());
    assert.ok(await widget.locator('.gsc-reply-author-avatar img').isVisible());
    assert.equal(await widget.locator('.gsc-reply-author').evaluate(author => getComputedStyle(author, '::after').content), '"作者"');
    assert.equal(await widget.locator('.gsc-reply').evaluate(reply => getComputedStyle(reply).borderInlineStartWidth), '0px');
    assert.ok(await widget.locator('.gsc-upvote-button').first().isDisabled());
    const order = await widget.locator('main').evaluate(main => ['.gsc-reactions', '.gsc-comment-box', '.gsc-timeline']
      .map(selector => main.querySelector(selector).getBoundingClientRect().top));
    assert.ok(order[0] < order[1] && order[1] < order[2]);
    await reader.emulateMedia({ colorScheme: 'dark' });
    await widget.locator('#giscus-theme[href$="#dark"]').waitFor({ state: 'attached' });
    assert.equal(await widget.locator('html').evaluate(html => getComputedStyle(html).colorScheme), 'dark');
    await reader.locator('#settings-trigger').hover();
    await reader.locator('[data-theme-choice="light"]').click();
    await widget.locator('#giscus-theme[href$="#light"]').waitFor({ state: 'attached' });
    assert.equal(await widget.locator('html').evaluate(html => getComputedStyle(html).colorScheme), 'light');
    await reader.keyboard.press('Escape');
    await reader.keyboard.press('i');
    assert.ok(await comments.isHidden());
    await reader.keyboard.press('i');
    assert.ok(await originalFrame.evaluate(element => element === document.querySelector('.giscus-frame')));
    assert.equal(requests.length, 4);
    assert.ok(themeRequests.length > 0);

    const iframeHeight = await frame.evaluate(element => element.style.height);
    await reader.evaluate(origin => {
      const source = document.querySelector('.giscus-frame').contentWindow;
      const data = { giscus: { resizeHeight: 999, error: 'API rate limit exceeded' } };
      window.dispatchEvent(new MessageEvent('message', { origin, source: window, data }));
      window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source, data }));
    }, provider);
    assert.equal(await frame.evaluate(element => element.style.height), iframeHeight);
    assert.equal(await comments.getAttribute('data-state'), 'ready');

    await reader.setViewportSize({ width: 390, height: 844 });
    await reader.goto(`${site}/posts/text-only/`);
    await comments.getByRole('button', { name: '加载评论' }).click();
    await frame.waitFor();
    assert.equal(await comments.getAttribute('data-state'), 'ready');
    assert.equal(requests.at(-1).searchParams.get('term'), 'article-text-only');
    assert.ok(!await reader.evaluate(() => document.documentElement.scrollWidth > innerWidth));

    await reader.goto(`${site}/posts/pictured/?preview-auth=1`);
    await comments.evaluate(section => section.scrollIntoView());
    await frame.waitFor();
    await reaction.click();
    assert.equal(await menu.locator('p').isVisible(), false);
    await menu.getByRole('button', { name: '👍' }).click();
    assert.equal(await chips.first().locator('span').textContent(), '4');
    const firstComment = widget.locator('.gsc-comment').first();
    await firstComment.getByRole('button', { name: '回复', exact: true }).click();
    await firstComment.getByPlaceholder('写下回复').fill('这是隔离预览中的回复。');
    await firstComment.getByRole('button', { name: '发送回复' }).click();
    await firstComment.getByText('这是隔离预览中的回复。').waitFor();

    await reader.unrouteAll();
    await reader.route(`${provider}/**`, route => { requests.push(new URL(route.request().url())); return route.abort(); });
    const count = requests.length;
    await reader.goto(`${local}/posts/text-only/`);
    assert.match(await comments.innerText(), /此环境未启用评论/);
    await reader.keyboard.press('End');
    assert.equal(requests.length, count);
  });

  await article(posts, 'text-only', { category: undefined, title: '已更名的文章', slug: 'renamed-article' });
  await t.test('an edited title and slug keep the discussion term and update the backlink', async () => {
    execFileSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build', '--force'], {
      cwd: project, env: { ...process.env, MEDIA_BASE_URL: cdn }, stdio: 'pipe',
    });
    const renamed = await readFile(join(dist, 'posts/renamed-article/index.html'), 'utf8');
    assert.match(renamed, /data-comment-term="article-text-only"/);
    assert.match(renamed, /name="giscus:backlink" content="https:\/\/qians\.day\/posts\/renamed-article\/"/);
  });
  await article(posts, 'text-only', { category: undefined, description: '北极星摘要。' },
    '我用 Cloudflare 存档星图，翻到一张罕见的地图。 pictured');

  execFileSync(process.execPath, [join(project, 'scripts/build-preview.mjs')], {
    cwd: project, env: { ...process.env, MEDIA_BASE_URL: cdn }, stdio: 'pipe',
  });
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
    assert.ok(home.includes('href="/fonts/lxgw-wenkai/v1.530/faces.css"'));
    assert.equal((await readdir(join(dist, 'fonts/lxgw-wenkai/v1.530'))).filter(name => name.endsWith('.woff2')).length, 321);
    assert.ok(home.includes(cover));
    assert.ok(!home.includes(second));
    const detail = await html('posts/pictured/index.html');
    assert.doesNotMatch(detail, /data-comment-term=/);
    assert.ok(detail.includes(cover) && detail.includes(second));
    assert.match(detail, /href="#notes-1"/);
    assert.match(detail, /id="notes-1"/);
    assert.match(detail, /rel="canonical" href="https:\/\/qians.day\/posts\/pictured\/"/);
    assert.doesNotMatch(await html('posts/text-only/index.html'), /<img\b/);
    assert.doesNotMatch(await html('posts/text-only/index.html'), /categories\/undefined|未分类/);
    assert.match(detail, /<figcaption>图注<\/figcaption>/);
    assert.equal(detail.split(`<img src="${cover}"`).length - 1, 1);
    assert.match(detail, /data-gallery-open="0"/);
    assert.doesNotMatch(await html('posts/text-only/index.html'), /ImageGallery|data-image-gallery|image-viewer\./);
    assert.doesNotMatch(home, /share-paragraph|qians\.day:reading-mode/);
    assert.doesNotMatch(detail, /qiansArchivePosition/);
    assert.doesNotMatch(detail, /<(?:link|script)[^>]+(?:href|src)="[^"]*image-viewer\./);
    assert.match(home, /href="\/posts\/text-only\/"/);
    assert.match(await html('categories/index.html'), new RegExp(`${grouped.length + 1} 篇`));
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
        const homeUrl = `http://127.0.0.1:${server.server.address().port}/`;
        await t.test('archive cards keep the same column widths across years and categories', async t => {
          const reader = await browser.newPage({ viewport: { width: 1440, height: 900 } });
          t.after(() => reader.close());
          await reader.route(cdn + '/**', route => route.fulfill({ contentType: 'image/webp', body: bytes }));
          const sizes = () => reader.locator('.posts .year').evaluateAll(groups => groups.map(group => {
            const grid = group.querySelector('ul');
            return {
              count: grid.children.length,
              columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
              widths: [...grid.children].map(card => card.getBoundingClientRect().width),
              yearAbove: group.querySelector('header').getBoundingClientRect().bottom <= grid.getBoundingClientRect().top + 1,
            };
          }));
          for (const [width, columns, yearAbove] of [
            [1440, 3, false], [768, 2, false], [680, 2, false], [640, 1, false],
            [600, 1, false], [500, 1, false], [440, 1, false], [410, 1, true], [390, 1, true],
          ]) {
            await reader.setViewportSize({ width, height: 900 });
            await reader.goto(homeUrl);
            const home = await sizes();
            await reader.goto(new URL('categories/engineering/', homeUrl).href);
            const category = await sizes();
            assert.deepEqual(home.map(group => group.count), [2, older.length]);
            assert.deepEqual(category.map(group => group.count), [1, grouped.length]);
            const cardWidth = home[1].widths[0];
            for (const group of [...home, ...category]) {
              assert.equal(group.columns, columns);
              assert.equal(group.yearAbove, yearAbove);
              for (const width of group.widths) assert.ok(Math.abs(width - cardWidth) < 1);
            }
          }
          await reader.evaluate(() => { document.documentElement.dataset.view = 'list'; });
          for (const [width, yearAbove] of [[640, false], [600, true], [500, true]]) {
            await reader.setViewportSize({ width, height: 900 });
            assert.ok((await sizes()).every(group => group.yearAbove === yearAbove));
          }
        });
        await t.test('static search scopes and ranks results, loads on demand and supports keyboard and IME', async t => {
          const reader = await browser.newPage();
          t.after(() => reader.close());
          reader.setDefaultTimeout(5000);
          const requests = [];
          reader.on('request', request => {
            if (new URL(request.url()).pathname.startsWith('/pagefind/')) requests.push(request.url());
          });
          const trigger = reader.getByRole('button', { name: '搜索文章' });
          const input = reader.getByRole('searchbox', { name: '搜索关键词' });
          const modal = reader.getByRole('dialog', { name: '搜索文章' });
          const status = modal.getByRole('status');
          const titles = modal.locator('.search-result-title');
          const resultLinks = modal.locator('#search-results a');
          async function waitForStatus(text) {
            await status.getByText(text, { exact: true }).waitFor();
          }
          async function find(query, message = '找到 1 篇文章') {
            await input.fill(query);
            await waitForStatus(message);
          }

          await reader.goto(homeUrl);
          await trigger.waitFor();
          assert.deepEqual(requests, []);
          const archiveLink = reader.getByRole('link', { name: '全部', exact: true });
          await archiveLink.focus();
          await reader.keyboard.press('/');
          await waitForStatus('按标题、摘要或正文搜索。');
          assert.equal(await input.evaluate(el => el === document.activeElement), true);

          await find('Cloudflare 星图');
          assert.deepEqual(await titles.allTextContents(), ['text-only']);
          assert.match(await modal.locator('.search-result-meta').innerText(), /^2026-11-22$/);
          const highlights = await modal.locator('.search-result-excerpt mark').allTextContents();
          assert.match(highlights.join(''), /Cloudflare.*星图/i);
          await find('北极星');
          assert.deepEqual(await titles.allTextContents(), ['text-only']);

          await find('pictured', '找到 2 篇文章');
          assert.deepEqual(await titles.allTextContents(), ['pictured', 'text-only']);
          assert.match(await modal.locator('.search-result-meta').first().innerText(), /2026-11-22 · 工程/);
          await input.press('ArrowDown');
          assert.equal(await resultLinks.first().evaluate(el => el === document.activeElement), true);
          await reader.keyboard.press('ArrowDown');
          assert.equal(await resultLinks.last().evaluate(el => el === document.activeElement), true);
          await reader.keyboard.press('ArrowUp');
          assert.equal(await resultLinks.first().evaluate(el => el === document.activeElement), true);
          await reader.keyboard.press('Escape');
          await modal.waitFor({ state: 'hidden' });
          await reader.waitForFunction(() => document.activeElement?.textContent === '全部');

          await trigger.click();
          for (const query of ['草稿独有内容', '排版实验独有内容', '骞言碎语', '"全部文章"']) {
            await find(query, '没有找到匹配的文章。');
            assert.equal(await resultLinks.count(), 0);
          }

          await reader.keyboard.press('Escape');
          await modal.waitFor({ state: 'hidden' });
          await reader.waitForFunction(() => document.activeElement?.id === 'search-trigger');
          await trigger.click();

          await find('Searchpagination', '已显示 10 篇，共 29 篇');
          await modal.getByRole('button', { name: '查看更多结果' }).click();
          await waitForStatus('已显示 20 篇，共 29 篇');
          assert.equal(await resultLinks.nth(10).evaluate(el => el === document.activeElement), true);
          assert.equal(new Set(await resultLinks.evaluateAll(links => links.map(link => link.href))).size, 20);

          await input.focus();
          await input.dispatchEvent('compositionstart');
          await input.fill('星图');
          await reader.keyboard.press('Enter');
          await reader.keyboard.press('Escape');
          assert.equal(await modal.isVisible(), true);
          assert.equal(await resultLinks.count(), 0);
          await input.dispatchEvent('compositionend');
          await waitForStatus('找到 1 篇文章');
          assert.deepEqual(await titles.allTextContents(), ['text-only']);
          await input.press('Enter');
          await reader.waitForURL('**/posts/text-only/');
          assert.equal(requests.filter(url => url.endsWith('/pagefind.js')).length, 1);
        });
        await t.test('search drops late fragments and displays a failed load', async t => {
          const reader = await browser.newPage();
          t.after(() => reader.close());
          reader.setDefaultTimeout(5000);
          const input = reader.getByRole('searchbox', { name: '搜索关键词' });
          const trigger = reader.getByRole('button', { name: '搜索文章' });
          let release;
          const held = new Promise(resolve => { release = resolve; });
          t.after(release);
          await reader.route('**/pagefind/fragment/**', async route => {
            await held;
            await route.continue();
          });
          await reader.goto(homeUrl);
          await trigger.click();
          const requested = reader.waitForRequest('**/pagefind/fragment/**');
          await input.fill('星图');
          await requested;

          await reader.evaluate(() => {
            const list = document.querySelector('#search-results');
            window.renderedLinks = [];
            new MutationObserver(records => {
              for (const record of records) window.renderedLinks.push(...record.addedNodes);
            }).observe(list, { childList: true });
          });
          await input.fill('xyzzynothingfound');
          release();
          const noResults = reader.getByRole('status').getByText('没有找到匹配的文章。', { exact: true });
          await noResults.waitFor();
          assert.deepEqual(await reader.evaluate(() => window.renderedLinks.map(node => node.textContent)), []);

          await reader.route('**/pagefind/pagefind.js', route => route.abort());
          await reader.reload();
          await trigger.click();
          await reader.getByText('搜索暂时无法加载，请刷新页面后重试。', { exact: true }).waitFor();
          await reader.getByRole('button', { name: '关闭搜索' }).click();
          await reader.waitForFunction(() => document.activeElement?.id === 'search-trigger');
        });

        await t.test('article image gallery is lazy, preserves links, and restores focus and scroll', async t => {
          const reader = await browser.newPage({ viewport: { width: 1000, height: 700 }, reducedMotion: 'reduce' });
          t.after(() => reader.close());
          reader.setDefaultTimeout(5000);
          const imagesUrl = new URL(`posts/${viewerPost}/`, homeUrl).href;
          const requests = [];
          reader.on('request', request => {
            if (request.url().includes('/_astro/')) requests.push(request.url());
          });
          await reader.route(cdn + '/**', route => {
            const url = route.request().url();
            return url.endsWith(failedFile)
              ? route.fulfill({ status: 404 })
              : route.fulfill({ contentType: 'image/webp', body: url.endsWith(landscapeFile) ? landscape : bytes });
          });
          await reader.goto(new URL('posts/text-only/', homeUrl).href);
          assert.ok(!requests.some(url => /ImageGallery|image-viewer\./.test(url)));
          requests.length = 0;
          await reader.goto(imagesUrl);
          assert.ok(requests.some(url => url.includes('ImageGallery')));
          assert.ok(!requests.some(url => url.includes('image-viewer.')));

          const linked = reader.locator('.prose a').filter({ has: reader.getByAltText('竖向图片', { exact: true }) });
          assert.equal(await linked.getAttribute('href'), '#%E8%AF%B4%E6%98%8E');
          assert.equal(await linked.locator('a').count(), 0);
          await linked.click();
          assert.equal(decodeURIComponent(new URL(reader.url()).hash), '#说明');
          assert.equal(await reader.locator('.image-viewer').count(), 0);

          const opener = reader.getByRole('link', { name: '查看大图：横向照片' });
          await opener.evaluate(el => el.scrollIntoView({ block: 'center' }));
          const scroll = await reader.evaluate(() => scrollY);
          await opener.focus();
          await reader.keyboard.press('Enter');
          const modal = reader.getByRole('dialog', { name: '文章图片' });
          const counter = modal.locator('.pswp__counter');
          const current = modal.locator('.pswp__item[aria-hidden="false"] img.pswp__img:not(.pswp__img--placeholder)');
          await modal.locator('.pswp--ui-visible').waitFor();
          assert.equal(await counter.innerText(), '1 / 3');
          assert.equal(await modal.locator('.pswp__caption').innerText(), '咖啡照片');
          assert.equal(await current.getAttribute('alt'), '横向照片');
          assert.equal(await current.evaluate(img => img.naturalWidth), 600);
          await reader.keyboard.press('/');
          assert.equal(await reader.getByRole('dialog', { name: '搜索文章' }).count(), 0);

          await current.dblclick();
          await modal.locator('.pswp--zoomed-in').waitFor();
          await current.dblclick();
          await modal.locator('.pswp--zoomed-in').waitFor({ state: 'detached' });
          await reader.keyboard.press('ArrowRight');
          assert.equal(await counter.innerText(), '2 / 3');
          await reader.getByRole('button', { name: '下一张' }).click();
          await modal.getByText('图片无法加载。请检查网络后重新打开。').waitFor();
          assert.equal(await counter.innerText(), '3 / 3');
          await reader.keyboard.press('Escape');
          await modal.waitFor({ state: 'detached' });
          assert.equal(await reader.evaluate(() => scrollY), scroll);
          assert.equal(await opener.evaluate(link => link === document.activeElement), true);

          await reader.keyboard.press('/');
          const search = reader.getByRole('dialog', { name: '搜索文章' });
          await search.waitFor();
          await reader.keyboard.press('Escape');
          await search.waitFor({ state: 'hidden' });
          await reader.getByRole('link', { name: '查看大图：竖向图片' }).click();
          await modal.locator('.pswp--ui-visible').waitFor();
          assert.equal(await counter.innerText(), '2 / 3');
          assert.equal(requests.filter(url => url.includes('image-viewer.')).length, 1);
          await reader.keyboard.press('Escape');
          await modal.waitFor({ state: 'detached' });

          await reader.emulateMedia({ reducedMotion: 'no-preference' });
          const origin = await opener.evaluate(link => {
            link.scrollIntoView({ block: 'center' });
            const thumbnail = link.querySelector('img').getBoundingClientRect();
            window.photoTransitions = [];
            document.addEventListener('transitionrun', event => {
              if (event.propertyName !== 'transform' || !event.target.matches('.pswp__zoom-wrap')) return;
              const transition = event.target.getAnimations().find(a => a.transitionProperty === 'transform');
              if (!transition) return;
              window.photoTransitions.push(transition.effect.getKeyframes().map(frame => {
                const point = new DOMMatrixReadOnly(frame.transform);
                return [point.e, point.f];
              }));
            });
            return [thumbnail.left, thumbnail.top];
          });
          await opener.click();
          await reader.waitForFunction(() => window.photoTransitions.length === 1 &&
            document.querySelector('.pswp__item:first-child')?.style.display === 'block');
          await reader.keyboard.press('Escape');
          await modal.waitFor({ state: 'detached' });
          const [open, close] = await reader.evaluate(() => window.photoTransitions);
          for (const point of [open[0], close.at(-1)]) {
            assert.ok(Math.abs(point[0] - origin[0]) <= 2 && Math.abs(point[1] - origin[1]) <= 2,
              JSON.stringify({ origin, point, open, close }));
          }
        });

        await t.test('gallery images link directly to their source with JavaScript disabled', async t => {
          const reader = await browser.newPage({ javaScriptEnabled: false });
          t.after(() => reader.close());
          await reader.route(cdn + '/**', route => route.fulfill({ contentType: 'image/webp', body: landscape }));
          await reader.goto(new URL(`posts/${viewerPost}/`, homeUrl).href);
          await reader.getByRole('link', { name: '查看大图：横向照片' }).click();
          await reader.waitForURL(`${cdn}/posts/${viewerPost}/${landscapeFile}`);
        });

        await t.test('paragraph links preserve selection and refuse ambiguous or missing destinations', async t => {
          const reader = await browser.newPage({ viewport: { width: 1200, height: 800 } });
          t.after(() => reader.close());
          reader.setDefaultTimeout(6000);
          await reader.context().grantPermissions(['clipboard-read', 'clipboard-write']);
          const url = new URL(`posts/${viewerPost}/`, homeUrl);
          const paragraphs = reader.locator('.prose p');
          const original = paragraphs.filter({ hasText: contextA });
          const share = reader.getByRole('button', { name: '复制段落链接' });
          await reader.goto(url.href);
          await original.evaluate(p => p.scrollIntoView({ block: 'center' }));
          await reader.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await original.evaluate((p, string) => {
            const text = p.firstChild;
            const at = text.textContent.indexOf(string);
            const r = new Range();
            r.setStart(text, at);
            r.setEnd(text, at + string.length);
            getSelection().removeAllRanges();
            getSelection().addRange(r);
          }, quoted);
          await share.click();
          const copied = await reader.evaluate(async () => ({
            url: await navigator.clipboard.readText(), selection: getSelection().toString(),
          }));
          assert.equal(copied.selection, quoted);
          assert.equal(new URL(copied.url).pathname, url.pathname);
          const payload = new URLSearchParams(new URL(copied.url).hash.slice(1));
          assert.equal(payload.get('q'), quoted);
          assert.ok(payload.get('b').includes(contextA));

          const highlighted = reader.locator('.prose .shared-paragraph');
          for (const navigate of [() => reader.goto(copied.url), () => reader.reload()]) {
            await navigate();
            await highlighted.waitFor();
            assert.match(await highlighted.innerText(), new RegExp(contextA));
            assert.ok(await reader.evaluate(() => scrollY > 0));
          }

          // Simulate a new paragraph before the original, leaving its source text intact.
          payload.set('p', '0');
          await reader.evaluate(hash => { location.hash = hash; }, payload.toString());
          await reader.waitForFunction(() => location.hash.startsWith('#quote=1&p=0') &&
            document.querySelector('.shared-paragraph')?.textContent.includes('小院'));
          await original.evaluate(p => {
            const duplicate = p.cloneNode(true);
            duplicate.classList.remove('shared-paragraph');
            p.after(duplicate);
          });
          await reader.evaluate(() => {
            history.replaceState(history.state, '', location.pathname);
            scrollTo(0, 0);
          });
          await reader.evaluate(hash => { location.hash = hash; }, payload.toString());
          await reader.getByText('原文已变更，无法定位此段').waitFor();
          assert.equal(await highlighted.count(), 0);
          assert.equal(await reader.evaluate(() => scrollY), 0);

          payload.set('q', '完全不存在的引用文本');
          await reader.goto(url.href + '#' + payload.toString());
          await reader.getByText('原文已变更，无法定位此段').waitFor();
          assert.equal(await highlighted.count(), 0);
          assert.equal(await reader.evaluate(() => scrollY), 0);
          await reader.locator('.prose pre').evaluate(pre => {
            pre.scrollIntoView({ block: 'center' });
            const r = new Range();
            r.selectNodeContents(pre);
            getSelection().removeAllRanges();
            getSelection().addRange(r);
          });
          await reader.waitForFunction(() => document.querySelector('#share-paragraph').hidden);
          assert.equal(await share.count(), 0);
        });

        await t.test('history returns to the article card or title and direct archive visits start at the top', async t => {
          const reader = await browser.newPage({ viewport: { width: 850, height: 700 } });
          t.after(() => reader.close());
          await reader.route(cdn + '/**', route => route.fulfill({ contentType: 'image/webp', body: placeholder }));
          reader.setDefaultTimeout(6000);
          for (const [path, view] of [['/', 'cards'], ['/categories/engineering/', 'list']]) {
            const url = new URL(path, homeUrl).href;
            await reader.goto(url);
            await reader.evaluate(view => localStorage.setItem('qians.day:post-view', view), view);
            await reader.reload();
            assert.equal(await reader.locator('html').getAttribute('data-view'), view);
            const link = reader.getByRole('link', { name: grouped.at(-2), exact: true });
            const id = await link.evaluate(a => {
              a.scrollIntoView({ block: 'center' });
              return a.closest('li').dataset.archiveEntry;
            });
            const top = await link.evaluate(a => a.closest('li').getBoundingClientRect().top);
            assert.ok(await reader.evaluate(() => scrollY > 0));
            await link.click();
            await reader.waitForURL(`**/posts/${id}/`);
            await reader.goBack();
            await reader.waitForFunction(({ id, top }) => Math.abs(
              document.querySelector(`[data-archive-entry="${id}"]`).getBoundingClientRect().top - top,
            ) <= 12, { id, top });
            await reader.goForward();
            await reader.waitForURL(`**/posts/${id}/`);
            await reader.getByRole('navigation', { name: '文章分类' }).getByRole('link', { name: path === '/' ? '全部' : '工程', exact: true }).click();
            await reader.waitForURL(url);
            assert.equal(await reader.evaluate(() => scrollY), 0);
          }
        });

        await t.test('the immersive reading shortcut respects page visits, screen size and dialogs', async t => {
          const reader = await browser.newPage({ viewport: { width: 1440, height: 900 } });
          t.after(() => reader.close());
          await reader.route(cdn + '/**', route => route.fulfill({ contentType: 'image/webp', body: landscape }));
          await reader.addInitScript(() => localStorage.setItem('qians.day:reading-mode', 'true'));
          reader.setDefaultTimeout(6000);
          const article = new URL(`posts/${viewerPost}/`, homeUrl).href;
          await reader.goto(article);
          const button = reader.getByRole('button', { name: '沉浸阅读', exact: true });
          assert.equal(await button.getAttribute('aria-pressed'), 'false');
          assert.equal(await button.getAttribute('title'), '进入沉浸阅读（I）');
          assert.equal(await button.getAttribute('aria-keyshortcuts'), 'I');
          assert.equal(await button.innerText(), '');
          const title = reader.locator('.intro h1');
          const titleBox = await title.boundingBox();
          const metaBox = await reader.locator('.intro .meta').boundingBox();
          const buttonBox = await button.boundingBox();
          assert.equal(buttonBox.y - metaBox.y, 8);
          assert.ok(buttonBox.y + buttonBox.height <= titleBox.y);
          const waitForOpacity = opacity => reader.waitForFunction(
            opacity => getComputedStyle(document.querySelector('#reading-mode')).opacity === opacity, opacity,
          );
          await waitForOpacity('0');
          await reader.locator('.intro time').hover();
          await waitForOpacity('1');
          assert.deepEqual(await title.boundingBox(), titleBox);
          await reader.mouse.move(0, 0);
          await waitForOpacity('0');
          await button.press('Tab');
          await reader.keyboard.press('Shift+Tab');
          assert.ok(await button.evaluate(el => el.matches(':focus-visible')));
          await waitForOpacity('1');
          assert.ok(await button.locator('.reading-enter svg').isVisible());
          await button.press('Enter');
          assert.equal(await button.getAttribute('aria-pressed'), 'true');
          assert.equal(await button.getAttribute('title'), '退出沉浸阅读（I）');
          assert.ok(await button.locator('.reading-enter').isHidden() && await button.locator('.reading-exit svg').isVisible());
          assert.ok(await reader.locator('.library').isHidden() && await reader.locator('.contents').isHidden());
          assert.ok((await reader.locator('.prose').boundingBox()).width <= 700);
          await reader.reload();
          assert.equal(await button.getAttribute('aria-pressed'), 'false');
          await reader.keyboard.press('i');
          assert.equal(await button.getAttribute('aria-pressed'), 'true');

          await reader.setViewportSize({ width: 959, height: 900 });
          await reader.waitForFunction(() => document.querySelector('#reading-mode').hidden &&
            !document.documentElement.hasAttribute('data-reading'));
          await reader.getByRole('button', { name: '本文目录' }).waitFor();
          await reader.reload();
          await reader.keyboard.press('i');
          assert.equal(await reader.locator('html[data-reading]').count(), 0);
          assert.ok(await reader.locator('#reading-mode').isHidden());
          await reader.setViewportSize({ width: 960, height: 900 });
          assert.equal(await button.getAttribute('aria-pressed'), 'false');
          await reader.setViewportSize({ width: 1440, height: 900 });
          await reader.keyboard.press('i');
          assert.equal(await button.getAttribute('aria-pressed'), 'true');

          await reader.keyboard.press('/');
          const search = reader.getByRole('dialog', { name: '搜索文章' });
          await search.waitFor();
          await reader.keyboard.press('i');
          assert.equal(await search.locator('input').inputValue(), 'i');
          assert.equal(await reader.locator('#reading-mode').getAttribute('aria-pressed'), 'true');
          await reader.keyboard.press('Escape');
          await search.waitFor({ state: 'hidden' });
          await reader.waitForFunction(() => document.activeElement?.id === 'reading-mode');
          await reader.getByRole('link', { name: '查看大图：横向照片' }).click();
          const viewer = reader.getByRole('dialog', { name: '文章图片' });
          await viewer.locator('.pswp--ui-visible').waitFor();
          await reader.keyboard.press('/');
          await reader.keyboard.press('i');
          assert.equal(await reader.locator('#reading-mode').getAttribute('aria-pressed'), 'true');
          assert.ok(await search.isHidden());
          assert.ok(await viewer.isVisible());
          await reader.getByRole('button', { name: '关闭图片浏览' }).click();
          await viewer.waitFor({ state: 'hidden' });

          await reader.goto(new URL('posts/text-only/', homeUrl).href);
          assert.equal(await button.getAttribute('aria-pressed'), 'false');
          await reader.goto(homeUrl);
          assert.equal(await reader.locator('html[data-reading], #reading-mode').count(), 0);
          await reader.goto(article);
          await reader.keyboard.press('i');
          assert.equal(await button.getAttribute('aria-pressed'), 'true');
          const paragraph = reader.locator('.prose p').filter({ hasText: contextA });
          await paragraph.evaluate(p => p.scrollIntoView({ block: 'start' }));
          const top = (await paragraph.boundingBox()).y;
          await reader.keyboard.press('i');
          assert.equal(await button.getAttribute('aria-pressed'), 'false');
          assert.ok(Math.abs((await paragraph.boundingBox()).y - top) < 3);
          assert.equal(await reader.evaluate(() => localStorage.getItem('qians.day:reading-mode')), 'true');
          await reader.reload();
          assert.equal(await button.getAttribute('aria-pressed'), 'false');
        });

        const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'no-preference' });
        await page.route(cdn + '/**', route => route.fulfill({
          contentType: 'image/webp',
          body: route.request().url() === placeholderUrl ? placeholder : bytes,
        }));
        await page.goto(homeUrl);
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
        assert.equal((await settings.innerText()).trim(), '');
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
        await page.setViewportSize({ width: 1440, height: 900 });
        const section = page.locator('[data-heading="notes-1"]');
        await section.click();
        await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('href') === '#notes-1');
        await t.test('the tablet outline opens from the top of the title area and closes on a keyboard jump', async () => {
          await page.setViewportSize({ width: 768, height: 1024 });
          await page.evaluate(() => scrollTo(0, 0));
          const trigger = page.getByRole('button', { name: '本文目录' });
          const outline = page.locator('#article-contents');
          await trigger.waitFor();
          const [title, button, row] = await Promise.all([
            page.locator('.intro h1').boundingBox(), trigger.boundingBox(), page.locator('.intro .meta').boundingBox(),
          ]);
          assert.equal(button.y - row.y, 8);
          assert.ok(button.y + button.height <= title.y);
          assert.ok(Math.abs(button.x + button.width - row.x - row.width) < 1);
          assert.ok(await page.locator('#reading-mode').isHidden());
          assert.ok(await outline.isHidden());
          await trigger.press('Enter');
          await outline.waitFor();
          await page.keyboard.press('Tab');
          const first = outline.getByRole('link', { name: 'Notes', exact: true }).first();
          assert.ok(await first.evaluate(link => link === document.activeElement));
          await page.keyboard.press('Escape');
          await outline.waitFor({ state: 'hidden' });
          assert.ok(await trigger.evaluate(button => button === document.activeElement));

          await trigger.press('Enter');
          await first.press('Enter');
          await page.waitForURL('**/#notes');
          await outline.waitFor({ state: 'hidden' });
          await page.evaluate(() => scrollTo(0, 0));
          await trigger.press('Enter');
          await section.press('Enter');
          await page.waitForURL('**/#notes-1');
          await outline.waitFor({ state: 'hidden' });
          const heading = await page.locator('#notes-1').boundingBox();
          assert.ok(heading.y >= 0 && heading.y + heading.height <= 1024);
          await page.setViewportSize({ width: 1440, height: 900 });
          await outline.waitFor();
          assert.ok(await trigger.isHidden());
        });
        await t.test('Markdown and reference images reserve their intrinsic size', async () => {
          const sizes = await page.locator('.prose img').evaluateAll(images =>
            images.map(img => [img.getAttribute('width'), img.getAttribute('height')]));
          assert.deepEqual(sizes, [['2', '3'], ['2', '3']]);
        });
        const mini = page.getByRole('button', { name: '迷你', exact: true });
        const full = page.getByRole('button', { name: '完整', exact: true });
        function marksAtWidths(expected) {
          const links = [...document.querySelectorAll('.contents a')];
          return links.length === expected.length && links.every((a, i) => parseFloat(getComputedStyle(a, '::before').width) === expected[i]);
        }
        await page.setViewportSize({ width: 1440, height: 900 });
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
        await page.waitForFunction(marksAtWidths, [32, 27, 22, 17, 12]);
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
        await t.test('the last archive entry is clickable while the article stays at its start', async () => {
          const last = nav.getByRole('link').last();
          assert.ok(await last.evaluate(a => {
            const box = a.getBoundingClientRect();
            return scrollY === 0 && box.bottom <= innerHeight &&
              a.contains(document.elementFromPoint(box.x + box.width / 2, box.bottom - 1));
          }));
        });
        await nav.getByRole('link', { name: older.at(-1) }).click();
        await page.waitForFunction(top => document.querySelector('#library').scrollTop === top, previous);
        assert.equal(await nav.locator('[aria-current]').innerText(), older.at(-1));
        assert.equal((await page.goto(new URL('/posts/secret-draft/', page.url()).href)).status(), 404);
        await t.test('pagination is before comments without the archive rail and preserves its scroll position', async t => {
          const reader = await browser.newPage({ viewport: { width: 1180, height: 700 } });
          t.after(() => reader.close());
          const article = id => new URL(`/posts/${id}/`, homeUrl).href;
          const library = reader.locator('#library');
          const pagination = reader.getByRole('navigation', { name: '文章翻页' });
          const comments = reader.getByRole('region', { name: '欢迎留下你的想法' });
          const links = () => pagination.locator('a').evaluateAll(anchors => anchors.map(a => [a.textContent, a.pathname]));
          const beforeComments = () => pagination.evaluate(nav => {
            const comments = nav.nextElementSibling;
            return comments?.matches('.comments') && nav.getBoundingClientRect().bottom <= comments.getBoundingClientRect().top;
          });
          await reader.goto(article('text-only'));
          await reader.evaluate(() => document.fonts.ready);
          assert.ok(await library.isVisible() && await pagination.isHidden());
          await reader.keyboard.press('i');
          assert.ok(await pagination.isHidden() && await comments.isHidden());
          await reader.keyboard.press('i');
          assert.ok(await comments.isVisible() && await pagination.isHidden());
          const top = await library.evaluate(async el => {
            el.scrollTop = el.scrollHeight;
            await new Promise(resolve => requestAnimationFrame(resolve));
            return el.scrollTop;
          });
          assert.ok(top > 0);
          await reader.setViewportSize({ width: 1179, height: 700 });
          assert.ok(await library.isHidden());
          assert.ok(await beforeComments());
          assert.deepEqual(await links(), [['上一篇', '/posts/pictured/'], ['下一篇', `/posts/${older[0]}/`], ['去首页', '/']]);
          await pagination.getByRole('link', { name: '下一篇' }).click();
          await reader.waitForURL(article(older[0]));
          assert.ok(await reader.getByRole('navigation', { name: '本文目录' }).isVisible());
          await reader.setViewportSize({ width: 1180, height: 700 });
          await library.waitFor();
          await reader.waitForFunction(top => Math.abs(document.querySelector('#library').scrollTop - top) <= 1, top);

          await reader.setViewportSize({ width: 390, height: 844 });
          await reader.goto(article('pictured'));
          assert.ok(await beforeComments());
          assert.deepEqual(await links(), [['下一篇', '/posts/text-only/'], ['去首页', '/']]);
          await reader.goto(article(older.at(-1)));
          assert.deepEqual(await links(), [['上一篇', `/posts/${older.at(-2)}/`], ['去首页', '/']]);
          await pagination.getByRole('link', { name: '去首页' }).click();
          await reader.waitForURL(homeUrl);
        });
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
        await t.test('the touch outline scrolls within a panel and retains accessible section targets', async t => {
          const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
          t.after(() => phone.close());
          await phone.addInitScript(() => {
            localStorage.setItem('qians.day:mini-toc', 'true');
            localStorage.setItem('qians.day:reading-mode', 'true');
          });
          await phone.emulateMedia({ reducedMotion: 'reduce' });
          await phone.goto(new URL('/posts/text-only/', page.url()).href);
          assert.ok(await phone.locator('#reading-mode').isHidden());
          assert.equal(await phone.locator('html[data-reading]').count(), 0);
          assert.equal(await phone.locator('.contents').count(), 0);
          assert.equal(await phone.getByRole('button', { name: '本文目录' }).count(), 0);
          await phone.getByRole('button', { name: '阅读设置' }).tap();
          assert.ok(await phone.getByRole('button', { name: '迷你', exact: true }).isDisabled());
          assert.equal(await phone.getByRole('button', { name: '完整', exact: true }).getAttribute('aria-pressed'), 'true');
          await phone.getByRole('button', { name: '列表', exact: true }).tap();
          assert.equal(await phone.locator('#reading-settings:popover-open').count(), 1);
          await phone.touchscreen.tap(6, 6);
          assert.equal(await phone.locator('#reading-settings:popover-open').count(), 0);
          await phone.goto(new URL('/posts/pictured/', phone.url()).href);
          assert.equal(await phone.locator('html[data-mini-toc]').count(), 0);
          await phone.setViewportSize({ width: 1200, height: 844 });
          assert.ok(await phone.evaluate(() => matchMedia('(pointer: coarse)').matches));
          assert.ok(await phone.locator('#reading-mode').isHidden());
          assert.equal(await phone.locator('html[data-reading]').count(), 0);
          await phone.setViewportSize({ width: 390, height: 844 });
          const trigger = phone.getByRole('button', { name: '本文目录' });
          const panel = phone.locator('#article-contents');
          assert.ok(await panel.isHidden());
          await trigger.tap();
          await panel.waitFor();
          const panelSize = await panel.boundingBox();
          const target = phone.locator('[data-heading="notes-1"]');
          const box = await target.boundingBox();
          assert.ok(box.width >= 44 && box.height >= 44);
          await phone.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2 + 6);
          await phone.waitForURL('**/#notes-1');
          await panel.waitFor({ state: 'hidden' });
          await phone.waitForFunction(() => document.querySelector('[data-heading="notes-1"]').hasAttribute('aria-current'));
          assert.equal(await phone.evaluate(() => localStorage.getItem('qians.day:mini-toc')), 'true');

          await phone.goto(new URL(`/posts/${older[0]}/`, phone.url()).href);
          await trigger.tap();
          assert.equal((await panel.boundingBox()).height, panelSize.height);
          const nav = panel.getByRole('navigation');
          const pageTop = await phone.evaluate(() => scrollY);
          assert.ok(await nav.evaluate(el => {
            el.scrollTop = el.scrollHeight;
            return el.scrollTop > 0;
          }));
          assert.equal(await phone.evaluate(() => scrollY), pageTop);
          const last = nav.getByRole('link').last();
          await last.focus();
          await phone.keyboard.press('/');
          const search = phone.getByRole('dialog', { name: '搜索文章' });
          await search.waitFor();
          assert.ok(await panel.isHidden());
          await phone.keyboard.press('Escape');
          await search.waitFor({ state: 'hidden' });
          await phone.waitForFunction(() => document.activeElement.id === 'contents-trigger');
          await trigger.tap();
          await last.tap();
          await phone.waitForURL('**/#chapter-30');
          await panel.waitFor({ state: 'hidden' });
        });
      } finally {
        await browser.close();
      }
    } finally {
      await server.stop();
    }
  });
});

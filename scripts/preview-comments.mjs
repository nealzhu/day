import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preview } from 'astro';
import { chromium } from 'playwright-core';
import { comments } from '../src/lib/comments.ts';

const { siteOrigin, providerOrigin, themePath } = comments;
const entry = new URL(process.argv[2] ?? '/', siteOrigin);
if (entry.origin !== siteOrigin) throw new Error('Use a qians.day article path.');

const outDir = await mkdtemp(join(tmpdir(), 'qians-comments-'));
let server;
let browser;

try {
  await build({ mode: 'production', force: true, outDir });
  server = await preview({ outDir, server: { host: '127.0.0.1', port: 0 } });
  const localOrigin = `http://127.0.0.1:${server.server.address().port}`;

  browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: null, serviceWorkers: 'block' });
  // Only this browser context serves the local build under the allowlisted site origin.
  await context.route(`${siteOrigin}/**`, async route => {
    const original = new URL(route.request().url());
    const local = new URL(localOrigin);
    local.pathname = original.pathname;
    local.search = original.search;
    const response = await context.request.get(local.href, { maxRedirects: 0 });
    const headers = response.headers();
    if (original.pathname === themePath) {
      headers['access-control-allow-origin'] = providerOrigin;
      headers['x-content-type-options'] = 'nosniff';
    }
    try {
      await route.fulfill({ response, headers });
    } finally {
      await response.dispose();
    }
  });

  await context.route(`${providerOrigin}/**`, route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() !== 'GET' || pathname.startsWith('/api/oauth/')) return route.abort('blockedbyclient');
    return route.continue();
  });

  const page = await context.newPage();
  await page.goto(entry.href, { waitUntil: 'domcontentloaded' });
  console.log('本地静态产物已在独立 Chrome 窗口打开，评论来自真实 Giscus（访客只读）。关闭窗口可结束预览。');
  await new Promise(resolve => {
    browser.once('disconnected', resolve);
    page.once('close', resolve);
  });
} finally {
  await browser?.close();
  await server?.stop();
  await rm(outDir, { recursive: true, force: true });
}

import { cp, mkdir, readdir, symlink, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fontDirectory } from '../scripts/font-assets.mjs';

export async function temporaryDirectory(t) {
  const path = await mkdtemp(join(tmpdir(), 'qians-m3-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

export async function article(root, id, overrides = {}, body = 'Text only.') {
  const directory = join(root, id);
  await mkdir(directory, { recursive: true });
  const data = {
    articleId: id, title: id, slug: id, description: 'Test & verify',
    publishedAt: '2026-11-22', category: 'engineering', status: 'published', ...overrides,
  };
  const yaml = Object.entries(data).filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
  await writeFile(join(directory, 'index.md'), `---\n${yaml}\n---\n\n${body}\n`);
  return directory;
}

export async function copySiteFixture(project) {
  for (const path of ['src', 'scripts', 'media', 'public', fontDirectory, 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
    await cp(path, join(project, path), { recursive: true, dereference: true });
  }
  // Link packages individually so Astro and Vite write caches only inside the fixture.
  const modules = join(project, 'node_modules');
  await mkdir(modules);
  for (const name of await readdir('node_modules')) {
    if (!name.startsWith('.')) await symlink(resolve('node_modules', name), join(modules, name), 'dir');
  }
}

// The test origin plays the role of giscus.app without reaching GitHub or writing discussions.
export const giscusClientFixture = `
  const config = document.currentScript.dataset;
  const provider = new URL(document.currentScript.src).origin;
  const url = new URL('/' + config.lang + '/widget', provider);
  Object.entries(config).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('backLink', document.querySelector('meta[name="giscus:backlink"]').content);
  url.searchParams.set('origin', location.href);
  const frame = document.createElement('iframe');
  frame.className = 'giscus-frame';
  frame.src = url.href;
  document.querySelector('.giscus').append(frame);
  window.addEventListener('message', event => {
    if (event.origin === provider && event.data?.giscus?.resizeHeight) {
      frame.style.height = event.data.giscus.resizeHeight + 'px';
    }
  });`;

export function giscusWidgetFixture({ error, discussion } = {}) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      html { color-scheme: light; }
      html[data-theme="transparent_dark"] { color-scheme: dark; }
      body { margin: 0; font: 15px/1.5 system-ui; color: light-dark(#292923,#e8e3d7); }
      p { margin: 0 0 12px; }
      section { border: 1px solid light-dark(#cfc9b9,#5e5e52); border-radius: 3px; padding: 14px; }
      textarea { box-sizing: border-box; width: 100%; font: inherit; min-height: 64px; }
    </style>
    <p>${discussion ? '1 条评论' : '0 条评论'} · 0 个回应</p>
    <section aria-label="隔离测试评论"><label for="comment">发表评论</label>
      <textarea id="comment" placeholder="撰写评论" disabled></textarea>
      <button disabled>使用 GitHub 登录</button>
    </section>
    <script>
      const query = new URLSearchParams(location.search);
      const parentOrigin = new URL(query.get('origin')).origin;
      const showTheme = theme => { document.documentElement.dataset.theme = theme; };
      showTheme(query.get('theme'));
      addEventListener('message', event => {
        if (event.origin === parentOrigin && event.source === parent) showTheme(event.data.giscus.setConfig.theme);
      });
      parent.postMessage({giscus: {resizeHeight: document.body.scrollHeight}}, parentOrigin);
      parent.postMessage({giscus: ${JSON.stringify(discussion ? { discussion: { url: discussion } } : { error: error ?? 'Discussion not found' })}}, parentOrigin);
    </script></html>`;
}

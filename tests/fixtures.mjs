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
  const reactions = `<details class="gsc-reactions-menu"><summary class="gsc-reactions-button gsc-social-reaction-summary-item" aria-label="添加回应">☺</summary>
    <div class="gsc-reactions-popover">登录后可添加回应</div></details>`;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 15px/1.5 system-ui; }
      p { margin: 0; }
      .gsc-main, .gsc-comments { display: flex; flex-direction: column; }
      .gsc-reactions > div, .gsc-header, .gsc-comment-footer { display: flex; gap: 8px; }
      .gsc-social-reaction-summary-item { display: inline-flex; justify-content: center; align-items: center; border: 1px solid; border-radius: 999px; }
      .gsc-comment-box textarea { display: block; width: 100%; font: inherit; }
      .gsc-comment-box-buttons { text-align: right; }
      .btn-primary { display: inline-flex; align-items: center; background: var(--color-btn-primary-bg); color: var(--color-btn-primary-text); text-decoration: none; }
    </style>
    <main><div class="gsc-main">
      <div class="gsc-reactions"><h4 class="gsc-reactions-count">0 个回应</h4><div>${reactions}
        ${discussion ? '<button class="gsc-social-reaction-summary-item" disabled>👍 3</button><button class="gsc-social-reaction-summary-item" disabled>❤️ 2</button>' : ''}</div></div>
      <div class="gsc-comments"><div class="gsc-header"><div class="gsc-left-header"><h4 class="gsc-comments-count">${discussion ? '2 条评论' : '0 条评论'}</h4></div></div>
      <form class="gsc-comment-box">
        <div class="gsc-comment-box-tabs">撰写 · 预览</div>
        <div class="gsc-comment-box-main"><textarea class="gsc-comment-box-textarea" placeholder="登录后可发表评论" disabled></textarea><div class="gsc-comment-box-textarea-extras">Markdown</div></div>
        <div class="gsc-comment-box-bottom"><div class="gsc-comment-box-buttons"><a class="btn-primary" href="#" target="_top" onclick="event.preventDefault()">使用 GitHub 登录</a></div></div>
      </form>
      ${discussion ? `<div class="gsc-timeline">
        <div class="gsc-comment"><div><header class="gsc-comment-header"><strong>山风</strong> <time>2 天前</time></header><p class="gsc-comment-content">把读到的句子抄在书签上，下一次翻开还会想起那天下午。</p><div class="gsc-comment-footer">${reactions}</div></div></div>
        <div class="gsc-comment"><div><header class="gsc-comment-header"><strong>书页之间</strong> <time>1 天前</time></header><p class="gsc-comment-content">也喜欢慢慢读完一篇长文，留一点时间想想。</p><div class="gsc-comment-footer">${reactions}</div><div class="gsc-replies"><div class="gsc-reply"><header class="gsc-reply-header"><strong>骞言碎语</strong> <time>今天</time></header><p class="gsc-reply-content">谢谢你留下这句话。</p></div></div></div></div>
      </div>` : ''}</div>
    </div></main>
    <script>
      const query = new URLSearchParams(location.search);
      const parentOrigin = new URL(query.get('origin')).origin;
      const link = document.createElement('link');
      link.id = 'giscus-theme';
      link.rel = 'stylesheet';
      link.crossOrigin = 'anonymous';
      document.head.append(link);
      const showTheme = theme => { link.href = theme; };
      showTheme(query.get('theme'));
      addEventListener('message', event => {
        if (event.origin === parentOrigin && event.source === parent) showTheme(event.data.giscus.setConfig.theme);
      });
      new ResizeObserver(() => parent.postMessage({giscus: {resizeHeight: document.body.scrollHeight}}, parentOrigin)).observe(document.body);
      parent.postMessage({giscus: ${JSON.stringify(discussion ? { discussion: { id: 'fixture-discussion' } } : { error: error ?? 'Discussion not found' })}}, parentOrigin);
    </script></html>`;
}

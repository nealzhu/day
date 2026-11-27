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

export function giscusWidgetFixture({ error, discussion, signedIn = false, readyDelay = 0 } = {}) {
  const emojis = ['👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀'];
  const disabled = signedIn ? '' : 'disabled';
  const login = '?preview-auth=1#comments';
  const action = '<button class="btn btn-primary" type="submit" disabled>';
  const composer = (nested = false) => `<form class="gsc-comment-box${nested ? ' gsc-comment-box-is-reply' : ''}" ${nested ? 'hidden' : ''}>
    <div class="gsc-comment-box-tabs">撰写 · 预览</div>
    <div class="gsc-comment-box-main"><div class="gsc-comment-box-write">
      <textarea class="form-control gsc-comment-box-textarea" placeholder="${nested ? '回复' : signedIn ? '撰写评论' : '登录后可发表评论'}" ${disabled}></textarea>
      <div class="gsc-comment-box-textarea-extras">Markdown</div>
    </div></div>
    <div class="gsc-comment-box-bottom"><div class="gsc-comment-box-buttons">${nested
      ? `<button type="button" class="btn" data-cancel-reply>取消</button>${action}回复</button>`
      : signedIn ? `${action}评论</button>` : `<a class="btn-primary" href="${login}" target="_top">使用 GitHub 登录</a>`}</div></div>
    </form>`;
  const reactions = (position, groups = []) => `<details class="gsc-reactions-menu">
    <summary class="gsc-reactions-button gsc-social-reaction-summary-item" aria-label="添加回应"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor"/><path d="M5 9a3 3 0 0 0 6 0M6 6h1m2 0h1" fill="none" stroke="currentColor"/></svg></summary>
    <div class="gsc-reactions-popover ${position} left">
      <p>${signedIn ? '选择您的回应' : `<a href="${login}" target="_top">登录</a>后可添加回应。`}</p><div></div>
      <div>${emojis.map(emoji => `<button class="gsc-emoji-button" type="button" data-emoji="${emoji}" ${disabled}>${emoji}</button>`).join('')}</div>
    </div></details><div class="gsc-direct-reaction-buttons">${groups.map(([emoji, count]) =>
      `<button class="gsc-direct-reaction-button gsc-social-reaction-summary-item" type="button" data-emoji="${emoji}" ${disabled}><span class="gsc-direct-reaction-button-emoji">${emoji}</span><span class="gsc-social-reaction-summary-item-count">${count}</span></button>`).join('')}</div>`;
  const avatar = (initial, background) => `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><rect width="30" height="30" fill="${background}"/><text x="15" y="20" text-anchor="middle" fill="white" font-size="13" font-family="sans-serif">${initial}</text></svg>`)}`;
  const profile = (account, name, initial, color, age) => {
    const url = `https://github.com/${account}`;
    return `<header class="gsc-comment-header"><div class="gsc-comment-author">
      <a class="gsc-comment-author-avatar" href="${url}"><img src="${avatar(initial,color)}" alt="">${name}</a>
      <a href="#"><time>${age}</time></a></div></header>`;
  };
  const reply = (text, age) => `<div class="gsc-reply"><div class="fixture-reply-layout">
    <div class="gsc-reply-author-avatar"><img src="${avatar('骞','#82503c')}" alt=""></div>
    <div><header class="gsc-reply-header"><div class="gsc-reply-author"><a href="https://github.com/nealzhu">骞言碎语</a><a href="#"><time>${age}</time></a></div></header>
    <p class="gsc-reply-content">${text}</p><div class="gsc-reply-footer"><div class="gsc-reply-reactions">${reactions('top')}</div></div></div>
    </div></div>`;
  const replyBox = signedIn ? `<div class="gsc-reply-box"><button type="button">回复</button></div>${composer(true)}` : '';
  const comment = (header, text, existingReplies = '') => `<div class="gsc-comment"><div>${header}<p class="gsc-comment-content">${text}</p>
    <div class="gsc-comment-footer"><div class="gsc-comment-reactions">
      <button class="gsc-upvote-button gsc-social-reaction-summary-item" aria-label="赞同" disabled><svg class="gsc-direct-reaction-button-emoji" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14V2m-4 4 4-4 4 4" fill="none" stroke="currentColor"/></svg></button>${reactions('top')}</div></div>
    <div class="gsc-replies">${existingReplies}</div>${replyBox}</div></div>`;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 15px/1.5 system-ui; }
      p { margin: 0; }
      .gsc-main, .gsc-comments { display: flex; flex-direction: column; }
      .gsc-reactions > div, .gsc-header, .gsc-comment-reactions, .gsc-reply-reactions, .gsc-direct-reaction-buttons { display: flex; align-items: center; gap: 8px; }
      .gsc-comment-author, .gsc-reply-author, .gsc-comment-author-avatar, .fixture-reply-layout { display: flex; align-items: center; gap: 8px; }
      .fixture-reply-layout { align-items: start; }
      .fixture-reply-layout time, .gsc-comment-author time { color: var(--muted); font-size: 12px; }
      .gsc-comment-author a, .gsc-reply-author a { color: inherit; text-decoration: none; }
      button { font: inherit; color: inherit; border: 0; background: none; }
      [hidden] { display: none !important; }
      .gsc-social-reaction-summary-item { display: inline-flex; justify-content: center; align-items: center; border: 1px solid; border-radius: 999px; }
      .gsc-upvote-button { border: 0; }
      .gsc-comment-box textarea { display: block; width: 100%; font-family: inherit; }
      .btn-primary { display: inline-flex; align-items: center; background: var(--color-btn-primary-bg); color: var(--color-btn-primary-text); text-decoration: none; }
      .btn-primary:disabled { background: var(--color-btn-primary-disabled-bg); color: var(--color-btn-primary-disabled-text); }
    </style>
    <main><div class="gsc-main">
      <div class="gsc-reactions"><h4 class="gsc-reactions-count">0 个回应</h4><div>${reactions('bottom', discussion ? [['👍', 3], ['❤️', 2]] : [])}</div></div>
      <div class="gsc-comments"><div class="gsc-header"><div class="gsc-left-header"><h4 class="gsc-comments-count">${discussion ? '2 条评论' : '0 条评论'}</h4></div></div>
      ${composer()}
      <div class="gsc-timeline" ${discussion ? '' : 'hidden'}>
        ${discussion ? `${comment(profile('mountain-reader', '山风', '山', '#577166', '2 天前'), '把读到的句子抄在书签上，下一次翻开还会想起那天下午。')}
        ${comment(profile('page-reader', '书页之间', '书', '#6d5976', '1 天前'), '也喜欢慢慢读完一篇长文，留一点时间想想。', reply('谢谢你留下这句话。', '今天'))}
        ` : ''}</div></div>
    </div></main>
    <template id="comment-template">${comment(profile('nealzhu', '骞言碎语', '骞', '#82503c', '刚刚'), '')}</template>
    <template id="reply-template">${reply('', '刚刚')}</template>
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
      const login = new URL(query.get('origin'));
      login.searchParams.set('preview-auth', '1');
      login.hash = 'comments';
      for (const link of document.querySelectorAll('a[target="_top"]')) link.href = login.href;
      function closeReply(form) {
        form.hidden = true;
        const opener = form.previousElementSibling;
        opener.hidden = false;
        opener.querySelector('button').focus();
      }
      document.addEventListener('input', event => {
        const textarea = event.target;
        if (textarea.matches('.gsc-comment-box-textarea')) textarea.form.querySelector('[type=submit]').disabled = !textarea.value.trim();
      });
      function closeReactionMenus(target) {
        for (const menu of document.querySelectorAll('.gsc-reactions-menu[open]')) {
          if (!menu.contains(target)) menu.open = false;
        }
      }
      addEventListener('blur', () => closeReactionMenus(null));
      document.addEventListener('click', event => {
        closeReactionMenus(event.target);
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        const replyBox = button.closest('.gsc-reply-box');
        if (replyBox) {
          replyBox.hidden = true;
          replyBox.nextElementSibling.hidden = false;
          replyBox.nextElementSibling.querySelector('textarea').focus();
        }
        if (button.hasAttribute('data-cancel-reply')) closeReply(button.form);
        if (!button.dataset.emoji) return;
        const menu = button.closest('details');
        const groups = menu?.nextElementSibling ?? button.parentElement;
        let chip = [...groups.children].find(chip => chip.dataset.emoji === button.dataset.emoji);
        if (!chip) {
          chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'gsc-direct-reaction-button gsc-social-reaction-summary-item';
          chip.dataset.emoji = button.dataset.emoji;
          const emoji = document.createElement('span');
          emoji.className = 'gsc-direct-reaction-button-emoji';
          emoji.textContent = button.dataset.emoji;
          const count = document.createElement('span');
          count.className = 'gsc-social-reaction-summary-item-count';
          count.textContent = '0';
          chip.append(emoji, count);
          groups.append(chip);
        }
        const selected = chip.classList.toggle('has-reacted');
        const count = Number(chip.lastElementChild.textContent) + (selected ? 1 : -1);
        chip.lastElementChild.textContent = count;
        if (!count) chip.remove();
        if (menu) menu.open = false;
      });
      document.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.target;
        const textarea = form.querySelector('textarea');
        const body = textarea.value.trim();
        if (textarea.disabled || !body) return;
        const parentComment = form.closest('.gsc-comment');
        const entry = document.querySelector(parentComment ? '#reply-template' : '#comment-template').content.cloneNode(true);
        entry.querySelector(parentComment ? '.gsc-reply-content' : '.gsc-comment-content').textContent = body;
        const entries = parentComment ? parentComment.querySelector('.gsc-replies') : document.querySelector('.gsc-timeline');
        entries.hidden = false;
        entries.append(entry);
        form.reset();
        form.querySelector('[type=submit]').disabled = true;
        if (parentComment) closeReply(form);
      });
      addEventListener('message', event => {
        if (event.origin === parentOrigin && event.source === parent) showTheme(event.data.giscus.setConfig.theme);
      });
      new ResizeObserver(() => parent.postMessage({giscus: {resizeHeight: document.body.scrollHeight}}, parentOrigin)).observe(document.body);
      setTimeout(() => parent.postMessage({giscus: ${JSON.stringify(discussion ? { discussion: { id: 'fixture-discussion' } } : { error: error ?? 'Discussion not found' })}}, parentOrigin), ${readyDelay});
    </script></html>`;
}

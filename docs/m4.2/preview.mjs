// Run from the repository root. All fixture posts and media live in the temp project.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { preview } from 'astro';
import { article, copySiteFixture } from '../../tests/fixtures.mjs';

const project = await mkdtemp(join(tmpdir(), 'qians-m42-'));
const posts = join(project, 'src/content/posts');
const samples = 'labs/typography/src/samples';

try {
  await copySiteFixture(project);
  await article(posts, 'lab-essay', {
    title: '街角的钟表店', category: undefined, publishedAt: '2026-11-18',
    description: '一条街的清晨，从卷帘门下的两声轻响开始。',
  }, await readFile(join(samples, 'essay.md'), 'utf8'));
  await article(posts, 'lab-tech', {
    title: '从一张照片说起：静态文章里的资源、地址与缓存', publishedAt: '2026-11-23',
    description: '从草稿里的相对路径，到读者再次打开一张照片。',
  }, await readFile(join(samples, 'tech.md'), 'utf8'));

  let life = await readFile(join(samples, 'life.astro'), 'utf8');
  const assets = join(posts, 'lab-life/assets');
  await mkdir(assets, { recursive: true });
  for (const match of life.matchAll(/<figure><img src="\/photos\/([^"]+)"[^>]+alt="([^"]+)" \/><figcaption>([^<]+)<\/figcaption><\/figure>/g)) {
    const [, name, alt, caption] = match;
    const photo = join('labs/typography/public/photos', name);
    const hash = createHash('sha256').update(await readFile(photo)).digest('hex').slice(0, 12);
    const file = name.replace('.webp', `-${hash}.webp`);
    await copyFile(photo, join(assets, file));
    life = life.replace(match[0], `\n![${alt}](./assets/${file} "${caption}")\n`);
  }
  await article(posts, 'lab-life', {
    title: '杯沿与猫眼里的光', category: undefined, publishedAt: '2026-11-23',
    description: '午后的两张照片，记下杯沿的白光与猫眼里的倒影。',
  }, life.replaceAll('<p>', '\n').replaceAll('</p>', '\n'));

  execFileSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build', '--force'], {
    cwd: project, env: { ...process.env, MEDIA_BASE_URL: '/' }, stdio: 'inherit',
  });
  for (const id of await readdir(posts)) {
    const files = await readdir(join(posts, id));
    if (files.includes('assets')) await cp(join(posts, id, 'assets'), join(project, 'dist/posts', id), { recursive: true });
  }
  const server = await preview({ root: project, server: { host: '127.0.0.1', port: 4632 } });
  await new Promise(resolve => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await server.stop();
} finally {
  await rm(project, { recursive: true, force: true });
}

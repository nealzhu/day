// Build a production-mode long article for the isolated comment fixture.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { preview } from 'astro';
import { article, copySiteFixture } from '../../../../tests/fixtures.mjs';

const project = await mkdtemp(join(tmpdir(), 'qians-m6-comments-'));
try {
  await copySiteFixture(project);
  await article(join(project, 'src/content/posts'), 'lab-tech', {
    title: '从一张照片说起：静态文章里的资源、地址与缓存',
    publishedAt: '2026-11-23',
    description: '从草稿里的相对路径，到读者再次打开一张照片。',
  }, await readFile('labs/typography/src/samples/tech.md', 'utf8'));
  execFileSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build', '--force'], {
    cwd: project, env: { ...process.env, MEDIA_BASE_URL: '/' }, stdio: 'inherit',
  });
  const server = await preview({ root: project, server: { host: '127.0.0.1', port: 4633 } });
  await new Promise(resolve => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await server.stop();
} finally {
  await rm(project, { recursive: true, force: true });
}

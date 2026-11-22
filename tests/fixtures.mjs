import { cp, mkdir, readdir, symlink, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  for (const path of ['src', 'scripts', 'media', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
    await cp(path, join(project, path), { recursive: true, dereference: true });
  }
  // Link packages individually so Astro and Vite write caches only inside the fixture.
  const modules = join(project, 'node_modules');
  await mkdir(modules);
  for (const name of await readdir('node_modules')) {
    if (!name.startsWith('.')) await symlink(resolve('node_modules', name), join(modules, name), 'dir');
  }
}

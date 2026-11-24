import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { articleSchema } from '../src/lib/content-model.ts';
import { rewriteImages } from './remark-cdn-media.mjs';

const parser = unified().use(remarkParse).use(remarkGfm);

async function assetFiles(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function verifyArticles(root = resolve('src/content/posts')) {
  const articles = [];
  const ids = new Set();
  const slugs = new Set();
  for (const dir of await readdir(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const directory = join(root, dir.name);
    const source = join(directory, 'index.md');
    const raw = await readFile(source, 'utf8');
    let parsed;
    try {
      parsed = parseFrontmatter(raw);
    } catch (error) {
      throw new Error(`${source}: ${error.message}`, { cause: error });
    }
    const result = articleSchema.safeParse(parsed.frontmatter);
    if (!result.success) throw new Error(`${source}: ${result.error.message}`);
    const data = result.data;
    if (ids.has(data.articleId)) throw new Error(`${source}: duplicate articleId "${data.articleId}"`);
    if (slugs.has(data.slug)) throw new Error(`${source}: duplicate slug "${data.slug}"`);
    ids.add(data.articleId);
    slugs.add(data.slug);

    const { images } = rewriteImages(parser.parse(parsed.content), data.articleId, source);
    const assets = await assetFiles(join(directory, 'assets'));
    const names = new Set(assets.map(file => file.name));
    for (const { filename } of images) {
      if (!names.has(filename)) throw new Error(`${source}: missing image ./assets/${filename}`);
    }
    for (const file of assets) {
      const path = join(directory, 'assets', file.name);
      if (!file.isFile() || !file.name.endsWith('.webp')) throw new Error(`${path}: expected WebP file`);
      const hash = createHash('sha256').update(await readFile(path)).digest('hex').slice(0, 12);
      if (!file.name.endsWith(`-${hash}.webp`)) throw new Error(`${path}: filename must end in -${hash}.webp`);
    }
    articles.push({ data, directory, assets: [...names] });
  }
  // Check this after uniqueness so an ID copied into a second folder is diagnosed as a duplicate.
  for (const { data, directory } of articles) {
    if (join(root, data.articleId) !== directory) throw new Error(`${directory}/index.md: articleId must match folder name`);
  }
  return articles;
}

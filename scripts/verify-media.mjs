import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

const root = resolve('src/content/posts');
const dirs = (await readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isDirectory());
const slugs = new Set();
let checked = 0;

for (const dir of dirs) {
  const id = dir.name;
  const mdPath = join(root, id, 'index.md');
  const raw = await readFile(mdPath, 'utf8');
  const { data, content } = matter(raw);
  if (data.articleId !== id) throw new Error(`${mdPath}: articleId must match folder name (${id})`);
  if (!data.slug || slugs.has(data.slug)) throw new Error(`${mdPath}: slug missing or duplicated`);
  slugs.add(data.slug);
  const tree = unified().use(remarkParse).parse(content);
  const refs = [];
  visit(tree, 'image', node => {
    if (node.url.startsWith('./assets/')) refs.push(node.url.slice('./assets/'.length));
    else throw new Error(`${mdPath}: images must use relative ./assets/ paths`);
  });
  for (const filename of refs) {
    if (filename.includes('/') || filename.includes('..') || !filename.endsWith('.webp')) {
      throw new Error(`${mdPath}: invalid WebP asset: ${filename}`);
    }
    const fullPath = join(root, id, 'assets', filename);
    if (!(await stat(fullPath)).isFile()) throw new Error(`${fullPath}: not a file`);
    const bytes = await readFile(fullPath);
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    if (!filename.endsWith(`-${digest}.webp`)) {
      throw new Error(`${fullPath}: filename must end in -${digest}.webp`);
    }
    checked++;
  }
}
console.log(`Verified ${dirs.length} article(s), ${checked} image reference(s).`);

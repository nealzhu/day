import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { imageMetadata } from 'astro/assets/utils';
import { visit } from 'unist-util-visit';

export const mediaBase = (process.env.MEDIA_BASE_URL ?? 'https://site-cdn.qians.day').replace(/\/$/, '');

export function mediaKey(articleId, filename) {
  return `posts/${articleId}/${filename}`;
}

// Resolve only image references. An ordinary link may share the same definition.
export function rewriteImages(tree, articleId, source, base = mediaBase) {
  const definitions = new Map();
  visit(tree, 'definition', node => {
    if (!definitions.has(node.identifier)) definitions.set(node.identifier, node);
  });

  const images = [];
  let cover = null;
  visit(tree, ['image', 'imageReference'], (node, index, parent) => {
    const image = node.type === 'image' ? node : definitions.get(node.identifier);
    if (!image) return;
    const filename = image.url.match(/^\.\/assets\/([^/\\?#%]+\.webp)$/)?.[1];
    if (!filename || filename.includes('..')) {
      throw new Error(`${source}:${node.position?.start.line}: invalid image "${image.url}", expected ./assets/<name>-<hash>.webp`);
    }
    const url = `${base}/${mediaKey(articleId, encodeURIComponent(filename))}`;
    cover ??= { src: url, alt: node.alt ?? '' };
    const rewritten = { type: 'image', url, alt: node.alt, title: image.title, position: node.position };
    parent.children[index] = rewritten;
    images.push({ filename, node: rewritten });
  });
  return { cover, images };
}

export function remarkCdnMedia({ base = mediaBase } = {}) {
  return async (tree, file) => {
    const source = (file.path ?? '').replaceAll('\\', '/');
    const id = source.match(/(?:^|\/)src\/content\/posts\/([^/]+)\/index\.md$/)?.[1];
    if (!id) return;
    const { cover, images } = rewriteImages(tree, id, source, base);
    for (const [index, { filename, node }] of images.entries()) {
      const path = join(dirname(source), 'assets', filename);
      const { width, height } = await imageMetadata(await readFile(path), path);
      node.data = { hProperties: { width, height, dataGalleryImage: '', loading: index > 0 ? 'lazy' : undefined } };
    }
    file.data.astro.frontmatter.firstImage = cover;
  };
}

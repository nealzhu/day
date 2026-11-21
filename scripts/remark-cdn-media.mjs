import { visit } from 'unist-util-visit';

// In dev, keep Markdown's local image paths so Astro can preview them.
// In production, replace them with CDN URLs *before* asset rendering.
// M2 acceptance includes verifying that no post WebP ends up in dist/_astro.
export function remarkCdnMedia() {
  return (tree, file) => {
    if (process.env.NODE_ENV !== 'production') return;

    const source = (file.path ?? '').replaceAll('\\', '/');
    const match = source.match(/\/posts\/([^/]+)\/index\.md$/);
    if (!match) return;
    const articleId = match[1];
    const base = (process.env.MEDIA_BASE_URL ?? 'https://site-cdn.qians.day').replace(/\/$/, '');

    visit(tree, 'image', (node) => {
      if (!node.url.startsWith('./assets/')) return;
      const name = node.url.slice('./assets/'.length);
      if (!name || name.includes('/') || name.includes('..')) {
        file.fail(`Invalid local image path: ${node.url}`, node);
      }
      node.url = `${base}/posts/${articleId}/${encodeURIComponent(name)}`;
    });
  };
}

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { mediaBase, remarkCdnMedia } from './scripts/remark-cdn-media.mjs';
import { rehypeFigureCaptions } from './scripts/rehype-figure-captions.mjs';
import { rehypeImageGallery } from './scripts/rehype-image-gallery.mjs';
import { rehypeScrollTables } from './scripts/rehype-scroll-tables.mjs';
import { serveLocalMedia } from './scripts/local-media.mjs';
import { verifyArticles } from './scripts/article-files.mjs';
import { searchIndex } from './scripts/search-index.mjs';

export default defineConfig({
  site: 'https://qians.day',
  output: 'static',
  markdown: {
    remarkRehype: { footnoteLabel: '脚注', footnoteBackLabel: '返回正文中的引用', footnoteLabelProperties: {} },
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false },
    rehypePlugins: [rehypeFigureCaptions, rehypeImageGallery, rehypeScrollTables],
    remarkPlugins: [[remarkCdnMedia, { base: mediaBase }]],
  },
  integrations: [{
    name: 'article-content',
    hooks: {
      'astro:config:setup': async ({ command, config }) => {
        if (command === 'build') await verifyArticles(fileURLToPath(new URL('content/posts', config.srcDir)));
      },
      'astro:server:setup': ({ server }) => {
        if (mediaBase === '') serveLocalMedia(server);
      },
    },
  }, searchIndex],
});

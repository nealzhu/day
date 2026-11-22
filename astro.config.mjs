import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { mediaBase, remarkCdnMedia } from './scripts/remark-cdn-media.mjs';
import { serveLocalMedia } from './scripts/local-media.mjs';
import { verifyArticles } from './scripts/article-files.mjs';

export default defineConfig({
  site: 'https://qians.day',
  output: 'static',
  markdown: {
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
  }],
});

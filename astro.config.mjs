import { defineConfig } from 'astro/config';
import { remarkCdnMedia } from './scripts/remark-cdn-media.mjs';

export default defineConfig({
  site: 'https://qians.day',
  output: 'static',
  markdown: {
    remarkPlugins: [remarkCdnMedia],
  },
});

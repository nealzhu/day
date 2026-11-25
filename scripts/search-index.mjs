import { copyFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { close, createIndex } from 'pagefind';

export const searchIndex = {
  name: 'pagefind',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      try {
        const { index, errors } = await createIndex();
        if (!index || errors.length) throw new Error(errors.join('\n'));

        const site = fileURLToPath(dir);
        const added = await index.addDirectory({ path: site, glob: 'posts/*/index.html' });
        if (added.errors.length) throw new Error(added.errors.join('\n'));

        const outputPath = join(site, 'pagefind');
        const written = await index.writeFiles({ outputPath });
        if (written.errors.length) throw new Error(written.errors.join('\n'));
        // The search dialog only uses the API runtime and its index.
        const files = await readdir(outputPath);
        const unused = files.filter(name => /^pagefind-(?:(?:component-|modular-)?ui\.(?:js|css)|highlight\.js)$/.test(name));
        await Promise.all(unused.map(name => unlink(join(outputPath, name))));
        await copyFile(new URL('../LICENSE/LICENSE', import.meta.resolve('pagefind')), join(outputPath, 'LICENSE.txt'));
        logger.info(`Built search index from ${added.page_count} article pages.`);
      } finally {
        await close();
      }
    },
  },
};

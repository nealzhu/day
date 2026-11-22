import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema } from './lib/content-model';

export const collections = {
  posts: defineCollection({
    loader: glob({
      base: './src/content/posts',
      pattern: '*/index.md',
      generateId: ({ entry, data }) => {
        const [id] = entry.split('/');
        if (data.articleId !== id) throw new Error(`${entry}: articleId must match folder ${id}`);
        return id;
      },
    }),
    schema: articleSchema,
  }),
};

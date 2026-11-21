import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './src/content/posts' }),
  schema: z.object({
    articleId: z.string().min(8),
    title: z.string().min(1),
    slug: z.string().min(1),
    category: z.string().min(1),
    tags: z.array(z.string()).default([]),
    description: z.string().default(''),
    publishedAt: z.coerce.date(),
  }),
});

export const collections = { posts };

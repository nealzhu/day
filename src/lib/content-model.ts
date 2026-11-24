import { z } from 'astro/zod';
import categories from './categories.json' with { type: 'json' };

export { categories };
export type Category = keyof typeof categories;

export const categoryKeys = Object.keys(categories) as [Category, ...Category[]];

const text = z.string().trim().min(1);

export const articleSchema = z.object({
  articleId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/, 'Invalid articleId'),
  title: text,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase, hyphen-separated slug'),
  description: text,
  publishedAt: z.union([z.string().date(), z.date().transform(date => date.toISOString().slice(0, 10))]),
  category: z.enum(categoryKeys).optional(),
  tags: z.array(text).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
}).strict();

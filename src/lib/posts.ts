import { getCollection, type CollectionEntry } from 'astro:content';
import type { Category } from './content-model';

export type Post = CollectionEntry<'posts'>;
export const postPath = (slug: string) => `/posts/${slug}/`;
export const categoryPath = (category: Category) => `/categories/${category}/`;

export async function publishedPosts() {
  const posts = await getCollection('posts', ({ data }) => data.status === 'published');
  return posts.sort((a, b) => b.data.publishedAt.localeCompare(a.data.publishedAt) || a.id.localeCompare(b.id));
}

export function firstImage(post: Post): { src: string; alt: string } | null {
  const metadata = post.rendered?.metadata?.frontmatter as { firstImage?: { src: string; alt: string } } | undefined;
  return metadata?.firstImage ?? null;
}

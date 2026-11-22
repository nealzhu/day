import type { APIRoute } from 'astro';
import { categoryKeys } from '../lib/content-model';
import { categoryPath, publishedPosts, postPath } from '../lib/posts';
import { xmlResponse } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const paths = [
    '/', '/categories/',
    ...categoryKeys.map(categoryPath),
    ...(await publishedPosts()).map(({ data }) => postPath(data.slug)),
  ];
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${paths.map(path => `<url><loc>${new URL(path, site).href}</loc></url>`).join('\n')}
  </urlset>`);
};

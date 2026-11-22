import type { APIRoute } from 'astro';
import { publishedPosts, postPath } from '../lib/posts';
import { categories } from '../lib/content-model';
import { escapeXml, xmlResponse } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const posts = await publishedPosts();
  const items = posts.map(({ data }) => `<item>
    <title>${escapeXml(data.title)}</title>
    <link>${new URL(postPath(data.slug), site).href}</link>
    <guid isPermaLink="false">qians.day/posts/${data.articleId}</guid>
    <description>${escapeXml(data.description)}</description>
    ${data.category ? `<category>${escapeXml(categories[data.category])}</category>` : ''}
    <pubDate>${new Date(data.publishedAt).toUTCString()}</pubDate>
  </item>`);
  return xmlResponse(`<rss version="2.0"><channel>
    <title>骞言碎语</title><link>${site}</link><description>骞言碎语的最新文章</description>
    <language>zh-CN</language>${items.join('\n')}
  </channel></rss>`, 'application/rss+xml');
};

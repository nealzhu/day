import type { APIRoute } from 'astro';
import { publishedPosts, postPath } from '../lib/posts';
import { escapeXml, xmlResponse } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const posts = await publishedPosts();
  const items = posts.map(({ data }) => `<item>
    <title>${escapeXml(data.title)}</title>
    <link>${new URL(postPath(data.slug), site).href}</link>
    <guid isPermaLink="false">qians.day/posts/${data.articleId}</guid>
    <description>${escapeXml(data.description)}</description>
    <pubDate>${new Date(data.publishedAt).toUTCString()}</pubDate>
  </item>`);
  return xmlResponse(`<rss version="2.0"><channel>
    <title>qians.day</title><link>${site}</link><description>qians.day 的最新文章</description>
    <language>zh-CN</language>${items.join('\n')}
  </channel></rss>`, 'application/rss+xml');
};

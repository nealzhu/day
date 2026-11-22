import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyArticles } from '../scripts/article-files.mjs';
import { article, temporaryDirectory } from './fixtures.mjs';

for (const [name, overrides, error] of [
  ['duplicate ID', { articleId: 'article-a' }, /duplicate articleId "article-a"/],
  ['duplicate slug', { slug: 'article-a' }, /duplicate slug "article-a"/],
  ['ID differs from folder', { articleId: 'changed-id' }, /articleId must match folder/],
  ['unknown category', { category: 'missing' }, /category/],
  ['invalid publication state', { status: 'publshed' }, /status/],
  ['invalid date', { publishedAt: '2026-02-30' }, /publishedAt/],
  ['empty description', { description: ' ' }, /description/],
]) {
  test(name, async t => {
    const root = await temporaryDirectory(t);
    await article(root, 'article-a');
    await article(root, 'article-b', overrides);
    await assert.rejects(verifyArticles(root), error);
  });
}

test('missing referenced WebP identifies the article and filename', async t => {
  const root = await temporaryDirectory(t);
  await article(root, 'article-a', {}, '![photo][f]\n\n[f]: ./assets/missing.webp');
  await assert.rejects(verifyArticles(root), /article-a\/index.md: missing image .\/assets\/missing.webp/);
});

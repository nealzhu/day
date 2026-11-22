import { verifyArticles } from './article-files.mjs';

const articles = await verifyArticles();
console.log(`Verified ${articles.length} articles and ${articles.reduce((n, a) => n + a.assets.length, 0)} media files.`);

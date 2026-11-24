import { verifyArticles } from './article-files.mjs';
import { fontManifest } from './font-assets.mjs';

const articles = await verifyArticles();
const fonts = await fontManifest();
console.log(`Verified ${articles.length} articles and ${articles.reduce((n, a) => n + a.assets.length, 0)} media files.`);
console.log(`Verified ${fonts.length} versioned font assets (321 WOFF2, faces.css, OFL.txt).`);

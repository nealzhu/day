import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { cardPlaceholderFile, cardPlaceholderKey } from './card-placeholder.mjs';
import { verifyArticles } from './article-files.mjs';
import { fontManifest, immutableCache } from './font-assets.mjs';
import { mediaKey } from './remark-cdn-media.mjs';

const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (![CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET].every(Boolean)) {
  throw new Error('Missing one of CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function exists(key) {
  try { await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
  catch (err) { if (err?.$metadata?.httpStatusCode === 404) return false; throw err; }
}

async function upload(localPath, key, contentType, cacheControl = immutableCache) {
  if (await exists(key)) { console.log(`SKIP ${key}`); return; }
  const bytes = await readFile(localPath);
  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: cacheControl,
      IfNoneMatch: '*',
    }));
  } catch (error) {
    // Another writer may have created the object after our HEAD.
    if (error?.$metadata?.httpStatusCode !== 412) throw error;
    console.log(`SKIP ${key} (already created)`);
    return;
  }
  console.log(`PUT ${key} (${bytes.length} bytes)`);
}

const fonts = await fontManifest();
for (const { data, directory, assets } of await verifyArticles()) {
  if (data.status !== 'published') continue;
  for (const filename of assets) {
    await upload(join(directory, 'assets', filename), mediaKey(data.articleId, filename), 'image/webp');
  }
}

await upload(cardPlaceholderFile, cardPlaceholderKey, 'image/webp');

// Retain support for the original flat media/fonts/*.woff2 convention.
const fontsDir = resolve('media/fonts');
try {
  for (const file of await readdir(fontsDir)) {
    if (!file.endsWith('.woff2')) throw new Error(`Unexpected font: ${file}`);
    await upload(join(fontsDir, file), `fonts/${file}`, 'font/woff2');
  }
} catch (err) {
  if (err?.code !== 'ENOENT') throw err;
}

// The manifest ends with faces.css, so its subsets exist before it is published.
for (const { path, key, contentType, cacheControl } of fonts) {
  await upload(path, key, contentType, cacheControl);
}

console.log('R2 media synchronization completed.');

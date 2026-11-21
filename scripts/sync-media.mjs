import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

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

async function upload(localPath, key, contentType) {
  if (await exists(key)) { console.log(`SKIP ${key}`); return; }
  const bytes = await readFile(localPath);
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`PUT ${key} (${bytes.length} bytes)`);
}

const root = resolve('src/content/posts');
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const assetsDir = join(root, entry.name, 'assets');
  let files;
  try {
    files = await readdir(assetsDir);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      // 纯文字文章允许没有 assets 目录
      continue;
    }
    throw err;
  }

  for (const file of files) {
    if (!file.endsWith('.webp')) {
      throw new Error(`Unexpected media file: ${assetsDir}/${file}`);
    }
    await upload(
      join(assetsDir, file),
      `posts/${entry.name}/${file}`,
      'image/webp'
    );
  }
}

// Optional future font assets: media/fonts/*.woff2
const fontsDir = resolve('media/fonts');
try {
  for (const file of await readdir(fontsDir)) {
    if (!file.endsWith('.woff2')) throw new Error(`Unexpected font: ${file}`);
    await upload(join(fontsDir, file), `fonts/${file}`, 'font/woff2');
  }
} catch (err) {
  if (err?.code !== 'ENOENT') throw err;
}

console.log('R2 media synchronization completed.');

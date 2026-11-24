import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { cardPlaceholderFile, cardPlaceholderKey } from './card-placeholder.mjs';
import { verifyArticles } from './article-files.mjs';
import { fontCdn, fontManifest, fontPrefix, immutableCache } from './font-assets.mjs';
import { fontSmokeAssets, fontVerificationPolicy, productionOrigin, verifyFontDelivery } from './verify-font-delivery.mjs';
import { mediaKey } from './remark-cdn-media.mjs';

async function phase(label, run) {
  const started = performance.now();
  try {
    return await run();
  } finally {
    console.log(`${label}: ${(performance.now() - started).toFixed(0)} ms`);
  }
}

async function localMedia() {
  const assets = [];
  const articles = await verifyArticles();
  for (const { data, directory, assets: filenames } of articles) {
    if (data.status !== 'published') continue;
    for (const filename of filenames) {
      assets.push({ path: join(directory, 'assets', filename), key: mediaKey(data.articleId, filename), contentType: 'image/webp' });
    }
  }
  assets.push({ path: cardPlaceholderFile, key: cardPlaceholderKey, contentType: 'image/webp' });

  // Retain support for the original flat media/fonts/*.woff2 convention.
  const directory = 'media/fonts';
  const files = await readdir(directory).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return [];
  });
  for (const file of files) {
    if (!file.endsWith('.woff2')) throw new Error(`Unexpected font: ${file}`);
    assets.push({ path: join(directory, file), key: `fonts/${file}`, contentType: 'font/woff2' });
  }
  return assets;
}

async function listObjects(client, bucket, prefix, delimiter) {
  const objects = new Map();
  const tokens = new Set();
  let token;
  let requests = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, Delimiter: delimiter, ContinuationToken: token,
    }));
    requests += page.$metadata?.attempts ?? 1;
    for (const object of page.Contents ?? []) objects.set(object.Key, object);
    if (!page.IsTruncated) break;
    token = page.NextContinuationToken;
    if (!token || tokens.has(token)) throw new Error(`Invalid R2 continuation token for ${prefix}`);
    tokens.add(token);
  } while (token);
  console.log(`R2 ${prefix}: ${objects.size} listed objects, ${requests} ListObjectsV2 attempts`);
  return objects;
}

async function uploadMissing(client, bucket, assets, objects) {
  const missing = assets.filter(({ key }) => !objects.has(key));
  for (const { path, key, contentType, cacheControl = immutableCache } of missing) {
    const bytes = await readFile(path);
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: cacheControl, IfNoneMatch: '*',
      }));
      console.log(`PUT ${key} (${bytes.length} bytes)`);
    } catch (error) {
      // Another writer may have created the object after the listing.
      if (error?.$metadata?.httpStatusCode !== 412) throw error;
      console.log(`SKIP ${key} (already created)`);
    }
  }
  console.log(`R2 asset sync: ${missing.length} conditional PUTs, ${assets.length - missing.length} existing objects`);
  return missing.length;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function inventoryHash(assets, objects) {
  const entries = [];
  for (const { key, size } of assets) {
    const object = objects.get(key);
    if (!object || object.Size !== size || !object.ETag || !object.LastModified) return;
    entries.push([key, size, object.ETag, object.LastModified.toISOString()]);
  }
  return digest(entries);
}

export async function syncMedia({
  client, bucket, media, fonts, versionPrefix = fontPrefix, verifyFonts = false, forceFull = false,
  cdn = fontCdn, origin = productionOrigin,
}) {
  const prefix = `${versionPrefix}/`;
  const mediaPrefixes = [...new Set(media.map(({ key }) => key.split('/')[0] + '/'))];
  const listFonts = () => listObjects(client, bucket, prefix);
  const [initialFonts, ...mediaLists] = await phase('R2 inventory', () => Promise.all([
    listFonts(),
    ...mediaPrefixes.map(p => listObjects(client, bucket, p, p === 'fonts/' ? '/' : undefined)),
  ]));
  const remoteMedia = new Map(mediaLists.flatMap(objects => [...objects]));
  await phase('R2 media sync', () => uploadMissing(client, bucket, media, remoteMedia));

  if (!verifyFonts) {
    await phase('R2 font sync', () => uploadMissing(client, bucket, fonts, initialFonts));
    return;
  }

  // Include the request target and all fields checked by CDN acceptance. Local paths are irrelevant.
  const manifestHash = digest([cdn, origin, fonts.map(({ key, sha256, size, contentType, cacheControl }) =>
    [key, sha256, size, contentType, cacheControl])]);
  const markerPrefix = `${prefix}_cdn-acceptance/v${fontVerificationPolicy}/${manifestHash}/`;
  const markerKey = hash => `${markerPrefix}${hash}`;
  let inventory = initialFonts;
  const initialHash = inventoryHash(fonts, inventory);
  let refreshFonts = false;

  if (!forceFull && initialHash && inventory.get(markerKey(initialHash))?.Size === 0) {
    try {
      await verifyFontDelivery(fontSmokeAssets(fonts), cdn, origin, 'smoke');
      return;
    } catch (error) {
      console.warn(`CDN font smoke failed; running full sync and verification: ${error.message}`);
      refreshFonts = true;
    }
  } else {
    console.log(`Running full CDN font verification: ${forceFull ? 'requested' : initialHash ? 'no matching acceptance marker' : 'incomplete R2 font inventory'}`);
  }

  // Invalidate this manifest's old acceptance before repair or revalidation so failures also fail closed on rerun.
  await phase('R2 font acceptance invalidation', async () => {
    for (const key of inventory.keys()) {
      if (!key.startsWith(markerPrefix)) continue;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log(`Invalidated ${key}`);
    }
  });
  if (refreshFonts) inventory = await phase('R2 font inventory refresh', listFonts);
  const uploaded = await phase('R2 font sync', () => uploadMissing(client, bucket, fonts, inventory));
  if (uploaded) inventory = await phase('R2 font inventory after sync', listFonts);
  const verifiedHash = inventoryHash(fonts, inventory);
  if (!verifiedHash) throw new Error('R2 font objects are missing or have unexpected size or metadata after sync');

  await verifyFontDelivery(fonts, cdn, origin);
  await phase('R2 font acceptance', async () => {
    if (inventoryHash(fonts, await listFonts()) !== verifiedHash) {
      throw new Error('R2 font inventory changed during CDN verification');
    }
    const key = markerKey(verifiedHash);
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: Buffer.alloc(0), CacheControl: 'no-store', IfNoneMatch: '*',
      }));
    } catch (error) {
      if (error?.$metadata?.httpStatusCode !== 412) throw error;
    }
    console.log(`Accepted CDN font manifest at ${key}`);
  });
}

if (import.meta.main) {
  const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (![CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET].every(Boolean)) {
    throw new Error('Missing one of CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    retryMode: 'standard',
    maxAttempts: 3,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 30000, throwOnRequestTimeout: true },
  });

  const [fonts, media] = await phase('Local media and font manifest integrity', () => Promise.all([fontManifest(), localMedia()]));
  await syncMedia({
    client, bucket: R2_BUCKET, fonts, media,
    verifyFonts: process.argv.includes('--verify-fonts'),
    forceFull: process.env.FORCE_FULL_CDN_FONT_CHECK === 'true',
  });
  console.log('R2 media synchronization completed.');
}

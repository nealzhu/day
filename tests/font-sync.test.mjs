import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { fontManifest } from '../scripts/font-assets.mjs';

test('R2 sync publishes the stylesheet last and reuses existing objects on retry', async t => {
  const manifest = await fontManifest();
  const objects = new Map();
  let attempts = 0;
  let heads = 0;
  const httpError = status => Object.assign(new Error(String(status)), { $metadata: { httpStatusCode: status } });
  // This test file runs in its own process. Every SDK request is handled in memory.
  Object.assign(process.env, {
    CLOUDFLARE_ACCOUNT_ID: 'fixture', R2_ACCESS_KEY_ID: 'fixture', R2_SECRET_ACCESS_KEY: 'fixture', R2_BUCKET: 'website',
  });
  t.mock.method(console, 'log', () => {});
  t.mock.method(S3Client.prototype, 'send', async command => {
    const { Key, Bucket, IfNoneMatch, ContentType, CacheControl, Body } = command.input;
    assert.equal(Bucket, 'website');
    if (command instanceof HeadObjectCommand) {
      heads++;
      if (!objects.has(Key)) throw httpError(404);
      return {};
    }
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(IfNoneMatch, '*');
    attempts++;
    objects.set(Key, { sha256: createHash('sha256').update(Body).digest('hex'), ContentType, CacheControl });
    // Simulate a concurrent uploader winning this write with the same immutable asset.
    if (Key === manifest[0].key) throw httpError(412);
    return {};
  });

  await import('../scripts/sync-media.mjs?first');
  for (const asset of manifest) {
    assert.deepEqual(objects.get(asset.key), {
      sha256: asset.sha256, ContentType: asset.contentType, CacheControl: asset.cacheControl,
    });
  }
  assert.equal([...objects.keys()].at(-1), manifest.at(-1).key);
  assert.ok(manifest.at(-1).key.endsWith('/faces.css'));
  assert.equal(attempts, objects.size);
  const firstHeads = heads;

  await import('../scripts/sync-media.mjs?retry');
  assert.equal(heads, firstHeads * 2);
  assert.equal(attempts, objects.size);
});

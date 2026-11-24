import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { cardPlaceholderFile, cardPlaceholderKey } from '../scripts/card-placeholder.mjs';
import { fontCdn, fontManifest, fontPrefix } from '../scripts/font-assets.mjs';
import { syncMedia } from '../scripts/sync-media.mjs';
import { fontSmokeAssets, productionOrigin } from '../scripts/verify-font-delivery.mjs';

const fonts = await fontManifest();
const image = { path: cardPlaceholderFile, key: cardPlaceholderKey, contentType: 'image/webp' };
const postImage = { ...image, key: 'posts/new-post/image-contenthash.webp' };
const smokeKeys = fontSmokeAssets(fonts).map(asset => asset.key);
const nonSample = fonts.find(asset => !smokeKeys.includes(asset.key));
const isMarker = key => key.includes('/_cdn-acceptance/');
const httpError = status => Object.assign(new Error(String(status)), { $metadata: { httpStatusCode: status } });

function fixture(t, { pageSize = 1000, concurrentKey, failedPut } = {}) {
  const objects = new Map();
  const calls = { list: [], put: [], delete: [], get: [] };
  let timestamp = 0;
  let fault = () => {};
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});

  function store(Key, Body, ContentType, CacheControl) {
    objects.set(Key, {
      Key, Body, ContentType, CacheControl, Size: Body.length,
      ETag: createHash('sha256').update(Body).digest('hex'),
      LastModified: new Date(++timestamp * 1000),
    });
  }

  const client = {
    async send(command) {
      const { Key, Bucket, IfNoneMatch, ContentType, CacheControl, Body, Prefix, ContinuationToken, Delimiter } = command.input;
      assert.equal(Bucket, 'website');
      if (command instanceof ListObjectsV2Command) {
        calls.list.push({ Prefix, ContinuationToken });
        const offset = Number(ContinuationToken ?? 0);
        const entries = [...objects.values()].filter(({ Key }) =>
          Key.startsWith(Prefix) && (!Delimiter || !Key.slice(Prefix.length).includes(Delimiter)));
        const next = offset + pageSize;
        return {
          Contents: entries.slice(offset, next),
          IsTruncated: next < entries.length,
          NextContinuationToken: next < entries.length ? String(next) : undefined,
        };
      }
      if (command instanceof DeleteObjectCommand) {
        assert.ok(isMarker(Key));
        calls.delete.push(Key);
        objects.delete(Key);
        return {};
      }
      assert.ok(command instanceof PutObjectCommand);
      assert.equal(IfNoneMatch, '*');
      assert.equal(objects.has(Key), false, `Unexpected overwrite of ${Key}`);
      calls.put.push(Key);
      if (Key === failedPut) {
        failedPut = undefined;
        throw httpError(503);
      }
      if (isMarker(Key)) assert.equal(calls.get.length >= fonts.length, true);
      store(Key, Body, ContentType, CacheControl);
      if (Key === concurrentKey) throw httpError(412);
      return {};
    },
  };

  t.mock.method(globalThis, 'fetch', async (url, { headers }) => {
    assert.ok(url.startsWith(fontCdn + '/'));
    assert.equal(headers.Origin, productionOrigin);
    const key = new URL(url).pathname.slice(1);
    const object = objects.get(key);
    calls.get.push(key);
    const status = fault(key, calls.get.length) ?? (object ? 200 : 404);
    if (status !== 200) return new Response(null, { status });
    return new Response(object.Body, { headers: {
      'Content-Type': object.ContentType,
      'Cache-Control': object.CacheControl,
      'Access-Control-Allow-Origin': headers.Origin,
    } });
  });

  return {
    objects, calls,
    markKeys: () => [...objects.keys()].filter(isMarker),
    resetCalls: () => Object.values(calls).forEach(list => { list.length = 0; }),
    failCdn: callback => { fault = callback; },
    deploy: (options = {}) => syncMedia({ client, bucket: 'website', fonts, media: [image, postImage], verifyFonts: true, ...options }),
  };
}

test('first deployment uses paginated R2 inventory, publishes CSS last and records successful full verification', async t => {
  const f = fixture(t, { pageSize: 150, concurrentKey: fonts[0].key });
  await f.deploy();
  assert.equal(f.markKeys().length, 1);
  assert.deepEqual(f.calls.put, [image.key, postImage.key, ...fonts.map(asset => asset.key), ...f.markKeys()]);
  assert.deepEqual(f.calls.get, fonts.map(asset => asset.key));
  assert.ok(f.calls.list.some(call => call.ContinuationToken === '150'));
  for (const { key, sha256, contentType, cacheControl } of fonts) {
    const object = f.objects.get(key);
    assert.equal(createHash('sha256').update(object.Body).digest('hex'), sha256);
    assert.equal(object.ContentType, contentType);
    assert.equal(object.CacheControl, cacheControl);
  }

  f.resetCalls();
  await f.deploy();
  assert.deepEqual(f.calls.put, []);
  assert.deepEqual(f.calls.get, smokeKeys);
});

test('an ordinary post creates its media and checks only CSS and three WOFF2 subsets', async t => {
  const f = fixture(t);
  await f.deploy({ media: [image] });
  f.resetCalls();
  await f.deploy();
  assert.deepEqual(f.calls.put, [postImage.key]);
  assert.deepEqual(f.calls.get, smokeKeys);
  assert.equal(f.calls.list.length, 3);
  assert.deepEqual(f.calls.delete, []);
});

test('a font upgrade gets independent acceptance and preserves historical objects', async t => {
  const f = fixture(t);
  await f.deploy();
  const historical = new Map(f.objects);
  const versionPrefix = 'fonts/lxgw-wenkai/v2.0';
  const upgrade = fonts.map(asset => ({ ...asset, key: asset.key.replace(fontPrefix, versionPrefix) }));
  f.resetCalls();
  await f.deploy({ fonts: upgrade, versionPrefix });
  assert.deepEqual(f.calls.get, upgrade.map(asset => asset.key));
  assert.equal(f.markKeys().length, 2);
  for (const [key, object] of historical) assert.equal(f.objects.get(key), object);
});

test('a failed upload or full CDN check can be retried without overwriting content or trusting a partial check', async t => {
  const f = fixture(t, { failedPut: fonts[1].key });
  await assert.rejects(f.deploy(), /503/);
  assert.ok(f.objects.has(fonts[0].key));
  assert.deepEqual(f.markKeys(), []);
  assert.deepEqual(f.calls.get, []);

  f.resetCalls();
  f.failCdn(key => key === fonts[1].key ? 404 : undefined);
  await assert.rejects(f.deploy(), /HTTP 404/);
  assert.equal(f.calls.put.includes(fonts[0].key), false);
  assert.deepEqual(f.markKeys(), []);
  assert.ok(f.objects.has(fonts.at(-1).key));

  f.resetCalls();
  f.failCdn(() => {});
  await f.deploy();
  assert.deepEqual(f.calls.get, fonts.map(asset => asset.key));
  assert.deepEqual(f.calls.put, f.markKeys());
  assert.equal(f.markKeys().length, 1);
});

test('a missing unsampled R2 font is restored and all CDN assets are verified again', async t => {
  const f = fixture(t);
  await f.deploy();
  const [oldMarker] = f.markKeys();
  f.objects.delete(nonSample.key);
  f.resetCalls();
  await f.deploy();
  assert.deepEqual(f.calls.delete, [oldMarker]);
  assert.deepEqual(f.calls.get, fonts.map(asset => asset.key));
  assert.deepEqual(f.calls.put, [nonSample.key, ...f.markKeys()]);
  assert.notEqual(f.markKeys()[0], oldMarker);
});

test('failed smoke falls back to full verification and invalidates prior acceptance even if full verification fails', async t => {
  const f = fixture(t);
  await f.deploy();
  f.resetCalls();
  f.failCdn((key, count) => (count === 1 || key === nonSample.key) ? 404 : undefined);
  await assert.rejects(f.deploy(), /HTTP 404/);
  assert.deepEqual(f.calls.get.slice(0, smokeKeys.length), smokeKeys);
  assert.equal(f.calls.get.length > smokeKeys.length, true);
  assert.deepEqual(f.markKeys(), []);

  f.resetCalls();
  f.failCdn(() => {});
  await f.deploy();
  assert.deepEqual(f.calls.get, fonts.map(asset => asset.key));
  assert.equal(f.markKeys().length, 1);
});

test('manual full verification and manifest identity changes bypass accepted smoke mode', async t => {
  const f = fixture(t);
  await f.deploy();
  f.resetCalls();
  await f.deploy({ forceFull: true });
  assert.deepEqual(f.calls.get, fonts.map(asset => asset.key));
  assert.equal(f.calls.delete.length, 1);

  f.resetCalls();
  const current = f.markKeys()[0];
  const obsolete = current.replace(/\/_cdn-acceptance\/v\d+\//, '/_cdn-acceptance/v0/');
  f.objects.set(obsolete, { ...f.objects.get(current), Key: obsolete });
  f.objects.delete(current);
  await f.deploy();
  assert.deepEqual(f.calls.get, fonts.map(asset => asset.key));

  f.resetCalls();
  // Change the manifest while keeping the same remote paths, sizes and digests.
  const changed = fonts.map(asset => ({ ...asset, cacheControl: asset.cacheControl.split(', ').reverse().join(', ') }));
  await f.deploy({ fonts: changed });
  assert.deepEqual(f.calls.get, fonts.map(asset => asset.key));
  assert.equal(f.calls.put.length, 1);
  assert.equal(f.markKeys().length, 3);
});

test('a changed R2 object fails full integrity validation without overwriting the existing font', async t => {
  const f = fixture(t);
  await f.deploy();
  f.resetCalls();
  const object = f.objects.get(nonSample.key);
  object.ETag = 'unexpected-etag';
  object.Body = Buffer.alloc(object.Size);
  await assert.rejects(f.deploy(), /content digest mismatch/);
  assert.ok(f.calls.get.includes(nonSample.key));
  assert.deepEqual(f.calls.put, []);
  assert.deepEqual(f.markKeys(), []);
});

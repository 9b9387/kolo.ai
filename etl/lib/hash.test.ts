import test from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, stableStringify } from './hash';

test('stableStringify sorts object keys recursively', () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(
    stableStringify({ z: { y: 2, x: 1 }, a: [{ n: 1, m: 0 }] }),
    '{"a":[{"m":0,"n":1}],"z":{"x":1,"y":2}}',
  );
});

test('stableStringify skips undefined object values, keeps null', () => {
  assert.equal(stableStringify({ a: 1, b: undefined }), '{"a":1}');
  assert.equal(stableStringify({ a: 1, b: null }), '{"a":1,"b":null}');
});

test('stableStringify serializes undefined array items as null', () => {
  assert.equal(stableStringify([1, undefined, 2]), '[1,null,2]');
});

test('stableStringify handles primitives, bigint and non-finite numbers', () => {
  assert.equal(stableStringify('a"b'), '"a\\"b"');
  assert.equal(stableStringify(1.5), '1.5');
  assert.equal(stableStringify(true), 'true');
  assert.equal(stableStringify(null), 'null');
  assert.equal(stableStringify(undefined), 'null');
  assert.equal(stableStringify(BigInt('9007199254740993')), '"9007199254740993"');
  assert.equal(stableStringify(Number.NaN), 'null');
});

test('contentHash is insensitive to key insertion order', () => {
  const a = contentHash({ name: 'rice', nutrients: { proteinG: 2.6, energyKcal: 130 } });
  const b = contentHash({ nutrients: { energyKcal: 130, proteinG: 2.6 }, name: 'rice' });
  assert.equal(a, b);
});

test('contentHash treats undefined and missing keys the same', () => {
  assert.equal(contentHash({ a: 1, b: undefined }), contentHash({ a: 1 }));
});

test('contentHash changes when content changes', () => {
  assert.notEqual(contentHash({ a: 1 }), contentHash({ a: 2 }));
  assert.notEqual(contentHash([1, 2]), contentHash([2, 1])); // array order matters
  assert.notEqual(contentHash({ a: null }), contentHash({})); // null !== missing
});

test('contentHash returns 40 lowercase hex chars (sha1)', () => {
  const hash = contentHash({ any: 'payload' });
  assert.match(hash, /^[0-9a-f]{40}$/);
  // Known vector: sha1 of '{"a":1}'
  assert.equal(contentHash({ a: 1 }), '9f89c740ceb46d7418c924a78ac57941d5e96520');
});

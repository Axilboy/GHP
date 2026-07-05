import test from 'node:test';
import assert from 'node:assert/strict';
import { aliasDictionaryPreview, aliasWordPool, normalizeAliasSettings } from './index.js';

test('alias catalog includes free and paid expansion dictionaries', () => {
  const freeIds = aliasDictionaryPreview.filter((dictionary) => dictionary.free).map((dictionary) => dictionary.id);
  const paidIds = aliasDictionaryPreview.filter((dictionary) => !dictionary.free).map((dictionary) => dictionary.id);

  assert.deepEqual(freeIds, ['everyday', 'party']);
  assert.ok(paidIds.includes('movies'));
  assert.ok(paidIds.includes('memes'));
  assert.ok(paidIds.includes('after_dark'));
  assert.ok(paidIds.includes('family'));
});

test('alias paid dictionaries add words to the pool', () => {
  const basePool = aliasWordPool(['everyday']);
  const expandedPool = aliasWordPool(['everyday', 'movies', 'memes', 'after_dark', 'family']);

  assert.ok(expandedPool.length > basePool.length);
  assert.ok(expandedPool.includes('режиссёр'));
  assert.ok(expandedPool.includes('мем'));
});

test('alias settings reject unknown dictionaries', () => {
  assert.deepEqual(normalizeAliasSettings({ dictionaryIds: ['unknown'], roundSeconds: 90, targetScore: 25 }), {
    roundSeconds: 90,
    targetScore: 25,
    dictionaryIds: ['everyday'],
  });
});

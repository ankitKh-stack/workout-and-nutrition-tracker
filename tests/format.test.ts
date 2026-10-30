// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeight, fromDisplayWeight, toDisplayWeight } from '../src/lib/format.ts';

test('kg is stored and shown unchanged', () => {
  assert.equal(fromDisplayWeight(62.5, 'kg'), 62.5);
  assert.equal(toDisplayWeight(62.5, 'kg'), 62.5);
});

test('a pound value round-trips through kg storage', () => {
  for (const lb of [0, 5, 45, 135, 225.5, 9999]) {
    assert.equal(toDisplayWeight(fromDisplayWeight(lb, 'lb'), 'lb'), lb);
  }
});

test('kg values shown in pounds', () => {
  assert.equal(toDisplayWeight(60, 'lb'), 132.28);
  assert.equal(formatWeight(100, 'lb'), '220.46');
  assert.equal(formatWeight(null, 'lb'), '—');
});

// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/domain/csv.ts';

test('CSV quotes fields with commas, quotes or line breaks and leaves the rest alone', () => {
  assert.equal(
    toCsv([
      ['date', 'exercise', 'reps', 'note'],
      ['2026-11-11', 'Press, incline', 8, null],
      ['2026-11-11', '6" grip', 10, 'seat 2\nnotch 3'],
    ]),
    'date,exercise,reps,note\r\n2026-11-11,"Press, incline",8,\r\n2026-11-11,"6"" grip",10,"seat 2\nnotch 3"',
  );
});

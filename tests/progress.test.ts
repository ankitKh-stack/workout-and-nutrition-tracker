// Run with: npm test  (uses Node's built-in test runner and type stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProgress,
  darkerLevel,
  percentChange,
  shadeLevel,
  workoutVolume,
} from '../src/domain/progress.ts';

test('volume of the SPEC 4.3 workout is 1,860', () => {
  const sets = [
    { reps: 10, weight: 60, isPartial: false, parentWeight: null },
    { reps: 8, weight: 60, isPartial: false, parentWeight: null },
    { reps: 6, weight: 40, isPartial: false, parentWeight: null }, // drop
    { reps: 4, weight: null, isPartial: true, parentWeight: 60 }, // partials
    { reps: 12, weight: 25, isPartial: false, parentWeight: null }, // superset partner
  ];
  assert.equal(workoutVolume(sets), 1860);
});

test('empty fields count as zero', () => {
  assert.equal(workoutVolume([{ reps: null, weight: 50, isPartial: false, parentWeight: null }]), 0);
  assert.equal(workoutVolume([{ reps: 5, weight: null, isPartial: true, parentWeight: null }]), 0);
  assert.equal(workoutVolume([]), 0);
});

test('percentage change cases', () => {
  assert.deepEqual(percentChange(0, null), { kind: 'zero' });
  assert.deepEqual(percentChange(0, { volume: 500, date: 'd' }), { kind: 'zero' });
  assert.deepEqual(percentChange(1000, null), { kind: 'first', percent: 100 });
  assert.equal(percentChange(10, { volume: 0, date: 'd' }).kind, 'previousZero');
  const r = percentChange(1200, { volume: 1000, date: 'd' });
  assert.equal(r.kind, 'change');
  assert.ok(r.kind === 'change' && Math.abs(r.percent - 20) < 1e-9);
});

test('band edges are exact', () => {
  const lvl = (p: number) => shadeLevel({ kind: 'change', percent: p, previousDate: 'd' });
  assert.equal(lvl(-40), 1);
  assert.equal(lvl(24.9), 1);
  assert.equal(lvl(25), 2);
  assert.equal(lvl(49.9), 2);
  assert.equal(lvl(50), 3);
  assert.equal(lvl(99.9), 3);
  assert.equal(lvl(100), 4);
  assert.equal(shadeLevel({ kind: 'first', percent: 100 }), 4);
  assert.equal(shadeLevel({ kind: 'zero' }), 'zero');
});

test('darkerLevel picks the darker shade', () => {
  assert.equal(darkerLevel('zero', 1), 1);
  assert.equal(darkerLevel(4, 2), 4);
  assert.equal(darkerLevel('none', 'zero'), 'zero');
});

test('SPEC 4.7 calendar example, compared per day basket', () => {
  const w = (id: string, dayId: string, date: string, volume: number) => ({
    id, dayId, date, startedAt: `${date}T10:00:00.000Z`, volume,
  });
  const progress = computeProgress([
    w('a', 'push', '2026-10-14', 1000),
    w('b', 'push', '2026-10-21', 1200),
    w('c', 'push', '2026-10-28', 2500),
    w('d', 'push', '2026-10-30', 0),
    w('e', 'legs', '2026-10-22', 300), // other day: must not affect push comparisons
  ]);
  assert.equal(progress.get('a')!.level, 4);
  assert.equal(progress.get('b')!.level, 1);
  assert.equal(progress.get('c')!.level, 4);
  assert.equal(progress.get('d')!.level, 'zero');
  assert.equal(progress.get('e')!.result.kind, 'first');
  const c = progress.get('c')!.result;
  assert.ok(c.kind === 'change' && Math.round(c.percent) === 108 && c.previousDate === '2026-10-21');
});

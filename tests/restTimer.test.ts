// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustCountdown,
  formatClock,
  newlyDone,
  offersRest,
  remainingSeconds,
  startCountdown,
  stepRest,
} from '../src/domain/restTimer.ts';

test('a countdown counts down from the start time', () => {
  const c = startCountdown(1_000, 120);
  assert.equal(remainingSeconds(c, 1_000), 120);
  assert.equal(remainingSeconds(c, 1_000 + 500), 120); // rounds up
  assert.equal(remainingSeconds(c, 1_000 + 61_000), 59);
});

test('time left is never negative, even after a long sleep', () => {
  assert.equal(remainingSeconds(startCountdown(0, 30), 10 * 60_000), 0);
});

test('±15s changes the time left but never below zero', () => {
  const c = startCountdown(0, 120);
  assert.equal(remainingSeconds(adjustCountdown(c, 15, 0), 0), 135);
  assert.equal(remainingSeconds(adjustCountdown(startCountdown(0, 10), -15, 0), 0), 0);
});

test('clock format', () => {
  assert.equal(formatClock(120), '2:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(5), '0:05');
});

test('the rest stepper stays between 0:30 and 5:00 in 15 s steps', () => {
  assert.equal(stepRest(120, 1), 135);
  assert.equal(stepRest(30, -1), 30);
  assert.equal(stepRest(300, 1), 300);
});

test('a row counts as newly done once, and only with both values', () => {
  assert.equal(newlyDone(false, 'normal', 10, 60), true);
  assert.equal(newlyDone(true, 'normal', 10, 60), false); // already done when loaded, or edited
  assert.equal(newlyDone(false, 'normal', 10, null), false); // weight cleared or invalid
  assert.equal(newlyDone(false, 'drop', null, 40), false);
  assert.equal(newlyDone(false, 'superset', 12, 20), true);
});

test('a partial reps row is done with reps alone, since it has no weight', () => {
  assert.equal(newlyDone(false, 'partial', 4, null), true);
  assert.equal(newlyDone(false, 'partial', null, null), false);
});

test('rest is offered after the last row of a set: the set itself, or its last drop, partial or superset row', () => {
  // Row 0 is the set; rows 1..n are its intensifier rows, in order.
  assert.equal(offersRest(0, 1), true); // a plain set
  assert.equal(offersRest(0, 2), false); // waits for its drop / partial / superset row
  assert.equal(offersRest(1, 2), true);
  assert.equal(offersRest(1, 3), false); // a drop with a partial after it
  assert.equal(offersRest(2, 3), true);
});

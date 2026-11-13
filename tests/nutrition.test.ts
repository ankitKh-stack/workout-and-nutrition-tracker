import { test } from 'node:test';
import assert from 'node:assert/strict';

import { entryNumbers, sumNumbers } from '../src/domain/nutrition.ts';

const yogurt = { kcal: 150, protein: 10, carbs: 12, fat: 5 };

test('an Entry in Servings multiplies the per-Serving numbers', () => {
  assert.deepEqual(entryNumbers(yogurt, 1.5, 'serving', null), { kcal: 225, protein: 15, carbs: 18, fat: 7.5 });
});

test('an Entry in grams is divided by the Serving weight first', () => {
  // 150 g of a 200 g Serving is three quarters of a Serving.
  assert.deepEqual(entryNumbers(yogurt, 150, 'gram', 200), { kcal: 112.5, protein: 7.5, carbs: 9, fat: 3.75 });
});

test('totals add up every Entry, and nothing is zero', () => {
  assert.deepEqual(sumNumbers([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  assert.deepEqual(sumNumbers([yogurt, { kcal: 50, protein: 1, carbs: 2, fat: 0.5 }]), {
    kcal: 200,
    protein: 11,
    carbs: 14,
    fat: 5.5,
  });
});

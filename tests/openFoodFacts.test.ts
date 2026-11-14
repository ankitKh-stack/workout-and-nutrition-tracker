// The Open Food Facts mapper, against saved product JSON (trimmed from real search results).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { toDraftFood } from '../src/domain/openFoodFacts.ts';

const sample = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/open-food-facts-${name}.json`, import.meta.url), 'utf8'));

test('a product with a serving size in grams gets per-Serving numbers for that serving', () => {
  assert.deepEqual(toDraftFood(sample('with-serving')), {
    name: 'Greek Style Yogurt',
    brand: 'Milbona',
    barcode: '20416690',
    kcal: 116,
    protein: 18,
    carbs: 8,
    fat: 4,
    servingGrams: 200,
    missing: [],
  });
});

test('a product without a serving size in grams keeps its per-100 g numbers on a 100 g Serving', () => {
  assert.deepEqual(toDraftFood(sample('without-serving')), {
    name: 'Rolled Oats',
    brand: 'Store Brand',
    barcode: '5000112637922',
    kcal: 375,
    protein: 11,
    carbs: 60,
    fat: 8,
    servingGrams: 100,
    missing: [],
  });
});

test('missing Macros stay blank and are listed; a serving in ml is not a gram Serving', () => {
  const draft = toDraftFood(sample('missing-macros'));
  assert.deepEqual([draft.kcal, draft.protein, draft.carbs, draft.fat, draft.servingGrams], [45, 0.7, null, null, 100]);
  assert.equal(draft.brand, '');
  assert.deepEqual(draft.missing, ['carbs', 'fat']);
});

test('a product with nothing but a barcode lists every field as missing', () => {
  assert.deepEqual(toDraftFood(sample('missing-everything')), {
    name: '',
    brand: '',
    barcode: '0000000000017',
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
    servingGrams: 100,
    missing: ['name', 'kcal', 'protein', 'carbs', 'fat'],
  });
});

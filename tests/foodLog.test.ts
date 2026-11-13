// Foods, Entries and the Food log against a real in-memory SQLite database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addEntry, createFood, getFoodLog, listFoods, ValidationError } from '../src/data/repository.ts';
import { initializeDatabase, SCHEMA_VERSION } from '../src/data/schema.ts';
import { openTestDb, tick } from './testDb.ts';

const yogurt = { name: 'Greek yogurt', kcal: 150, protein: 10, carbs: 12, fat: 5, servingGrams: 200 };

test('a created Food goes into My foods, A–Z, filtered by name', async () => {
  const db = await openTestDb();
  await createFood(db, yogurt);
  await createFood(db, { name: 'apple', kcal: 80, protein: 0, carbs: 20, fat: 0, servingGrams: null });
  await createFood(db, { name: '  Banana ', kcal: 100, protein: 1, carbs: 25, fat: 0, servingGrams: 120 });
  assert.deepEqual((await listFoods(db, '')).map((f) => f.name), ['apple', 'Banana', 'Greek yogurt']);
  assert.deepEqual((await listFoods(db, 'YOG')).map((f) => f.name), ['Greek yogurt']);
  assert.deepEqual((await listFoods(db, 'an')).map((f) => f.name), ['Banana']);
});

test('a Food needs a name, all four numbers ≥ 0 and a Serving weight above 0 when given', async () => {
  const db = await openTestDb();
  await assert.rejects(createFood(db, { ...yogurt, name: '  ' }), ValidationError);
  await assert.rejects(createFood(db, { ...yogurt, kcal: NaN }), ValidationError);
  await assert.rejects(createFood(db, { ...yogurt, fat: -1 }), ValidationError);
  await assert.rejects(createFood(db, { ...yogurt, servingGrams: 0 }), ValidationError);
  assert.deepEqual(await listFoods(db, ''), []);
});

test('the Food log groups Entries into the four Meals with per-Meal and Date totals', async () => {
  const db = await openTestDb();
  const y = await createFood(db, yogurt);
  const apple = await createFood(db, { name: 'Apple', kcal: 80, protein: 0, carbs: 20, fat: 0, servingGrams: null });
  await addEntry(db, { date: '2026-11-13', meal: 'breakfast', foodId: y, amount: 1.5, unit: 'serving' });
  await tick();
  await addEntry(db, { date: '2026-11-13', meal: 'breakfast', foodId: apple, amount: 1, unit: 'serving' });
  await addEntry(db, { date: '2026-11-13', meal: 'snacks', foodId: y, amount: 100, unit: 'gram' });
  await addEntry(db, { date: '2026-11-12', meal: 'lunch', foodId: apple, amount: 3, unit: 'serving' }); // another Date

  const log = await getFoodLog(db, '2026-11-13');
  assert.deepEqual(log.meals.map((m) => m.meal), ['breakfast', 'lunch', 'dinner', 'snacks']);
  const [breakfast, lunch, , snacks] = log.meals;
  assert.deepEqual(breakfast.entries.map((e) => [e.name, e.amount, e.unit, e.kcal]), [
    ['Greek yogurt', 1.5, 'serving', 225],
    ['Apple', 1, 'serving', 80],
  ]);
  assert.equal(breakfast.totals.kcal, 305);
  assert.deepEqual(lunch.entries, []);
  assert.equal(lunch.totals.kcal, 0);
  assert.equal(snacks.totals.kcal, 75); // 100 g of a 200 g Serving
  assert.deepEqual(log.totals, { kcal: 380, protein: 20, carbs: 44, fat: 10 });
});

test('an Entry needs an amount above 0, and grams only when the Food has a Serving weight', async () => {
  const db = await openTestDb();
  const y = await createFood(db, yogurt);
  const apple = await createFood(db, { name: 'Apple', kcal: 80, protein: 0, carbs: 20, fat: 0, servingGrams: null });
  const entry = { date: '2026-11-13', meal: 'lunch' as const, unit: 'serving' as const };
  await assert.rejects(addEntry(db, { ...entry, foodId: y, amount: 0 }), ValidationError);
  await assert.rejects(addEntry(db, { ...entry, foodId: y, amount: NaN }), ValidationError);
  await assert.rejects(addEntry(db, { ...entry, foodId: apple, amount: 50, unit: 'gram' }), ValidationError);
  assert.equal((await getFoodLog(db, '2026-11-13')).totals.kcal, 0);
});

test('an Entry keeps the name and numbers the Food had when it was logged', async () => {
  const db = await openTestDb();
  const y = await createFood(db, yogurt);
  await addEntry(db, { date: '2026-11-12', meal: 'dinner', foodId: y, amount: 1, unit: 'serving' });
  await db.runAsync("UPDATE food SET name = 'Skyr', kcal = 999"); // the Food changes later
  const dinner = (await getFoodLog(db, '2026-11-12')).meals[2];
  assert.deepEqual(dinner.entries.map((e) => [e.name, e.kcal]), [['Greek yogurt', 150]]);
});

test('migrating a version 5 database adds My foods and keeps the workout data', async () => {
  const db = await openTestDb();
  await db.execAsync("DROP TABLE food_entry; DROP TABLE food; INSERT INTO day_basket VALUES ('d', 'Push', 't', 't', NULL); PRAGMA user_version = 5;");
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version, SCHEMA_VERSION);
  assert.equal((await db.getFirstAsync<{ name: string }>('SELECT name FROM day_basket'))!.name, 'Push');
  await createFood(db, yogurt);
  assert.equal((await listFoods(db, '')).length, 1);
});

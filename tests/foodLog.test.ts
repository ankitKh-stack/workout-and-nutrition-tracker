// Foods, Entries and the Food log against a real in-memory SQLite database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addEntry, createFood, deleteEntry, getEntry, getFoodLog, getTargets, listFoods, saveTargets, updateEntry, ValidationError } from '../src/data/repository.ts';
import { initializeDatabase, SCHEMA_VERSION } from '../src/data/schema.ts';
import { localDateString } from '../src/lib/format.ts';
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

test('an Entry saves to a past Date, but future Dates are view-only', async () => {
  const db = await openTestDb();
  const y = await createFood(db, yogurt);
  const day = (offset: number) => {
    const d = new Date();
    return localDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset));
  };
  await addEntry(db, { date: day(-3), meal: 'dinner', foodId: y, amount: 1, unit: 'serving' });
  assert.equal((await getFoodLog(db, day(-3))).totals.kcal, 150);
  assert.equal((await getFoodLog(db, day(0))).totals.kcal, 0);
  await assert.rejects(addEntry(db, { date: day(1), meal: 'dinner', foodId: y, amount: 1, unit: 'serving' }), ValidationError);
  assert.equal((await getFoodLog(db, day(1))).totals.kcal, 0);
});

test("editing an Entry's amount uses the numbers it was logged with, even after the Food is changed or deleted", async () => {
  const db = await openTestDb();
  const y = await createFood(db, yogurt);
  const id = await addEntry(db, { date: '2026-11-12', meal: 'breakfast', foodId: y, amount: 1, unit: 'serving' });
  await db.runAsync("UPDATE food SET name = 'Skyr', kcal = 999, serving_grams = NULL");
  assert.deepEqual(await getEntry(db, id), { id, name: 'Greek yogurt', kcal: 150, protein: 10, carbs: 12, fat: 5, servingGrams: 200, amount: 1, unit: 'serving' });

  await updateEntry(db, id, 300, 'gram'); // the Entry's own 200 g Serving, not the Food's
  let breakfast = (await getFoodLog(db, '2026-11-12')).meals[0];
  assert.deepEqual(breakfast.entries.map((e) => [e.name, e.amount, e.unit, e.kcal]), [['Greek yogurt', 300, 'gram', 225]]);

  await db.runAsync('DELETE FROM food');
  await updateEntry(db, id, 2, 'serving');
  breakfast = (await getFoodLog(db, '2026-11-12')).meals[0];
  assert.deepEqual(breakfast.entries.map((e) => [e.name, e.kcal]), [['Greek yogurt', 300]]);
  assert.deepEqual(breakfast.totals, { kcal: 300, protein: 20, carbs: 24, fat: 10 });
});

test('an edited amount must be above 0, in grams only with a Serving weight; a deleted Entry leaves the totals', async () => {
  const db = await openTestDb();
  const y = await createFood(db, yogurt);
  const apple = await createFood(db, { name: 'Apple', kcal: 80, protein: 0, carbs: 20, fat: 0, servingGrams: null });
  const ye = await addEntry(db, { date: '2026-11-12', meal: 'lunch', foodId: y, amount: 1, unit: 'serving' });
  const ae = await addEntry(db, { date: '2026-11-12', meal: 'lunch', foodId: apple, amount: 1, unit: 'serving' });
  await assert.rejects(updateEntry(db, ye, 0, 'serving'), ValidationError);
  await assert.rejects(updateEntry(db, ae, 50, 'gram'), ValidationError);
  assert.equal((await getFoodLog(db, '2026-11-12')).totals.kcal, 230);

  await deleteEntry(db, ye);
  assert.equal(await getEntry(db, ye), null);
  const log = await getFoodLog(db, '2026-11-12');
  assert.deepEqual(log.meals[1].entries.map((e) => e.name), ['Apple']);
  assert.equal(log.totals.kcal, 80);
});

test('Targets save and reload, any of them blank, and clearing one removes it', async () => {
  const db = await openTestDb();
  assert.deepEqual(await getTargets(db), { kcal: null, protein: null, carbs: null, fat: null });
  await saveTargets(db, { kcal: 2600, protein: 180, carbs: null, fat: 70.5 });
  assert.deepEqual(await getTargets(db), { kcal: 2600, protein: 180, carbs: null, fat: 70.5 });
  await saveTargets(db, { kcal: 2600, protein: null, carbs: null, fat: 70.5 });
  assert.deepEqual(await getTargets(db), { kcal: 2600, protein: null, carbs: null, fat: 70.5 });
});

test('a Target must be a number above 0', async () => {
  const db = await openTestDb();
  const blank = { kcal: null, protein: null, carbs: null, fat: null };
  await assert.rejects(saveTargets(db, { ...blank, kcal: 0 }), ValidationError);
  await assert.rejects(saveTargets(db, { ...blank, fat: NaN }), ValidationError);
  assert.deepEqual(await getTargets(db), blank);
});

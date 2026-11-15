import type { Href } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import { findFoodByBarcode } from '@/data/repository';
import type { DraftFood } from '@/domain/openFoodFacts';

/** Where an Open Food Facts result goes: the user's own copy, the amount step, or the food form to fill gaps. */
export async function draftRoute(db: SQLiteDatabase, d: DraftFood, date: string, meal: string): Promise<Href> {
  // A product already in My foods is logged from the user's own copy.
  const mine = d.barcode ? await findFoodByBarcode(db, d.barcode).catch(() => null) : null;
  if (mine) return { pathname: '/food-amount', params: { date, meal, foodId: mine.id } };
  if (d.missing.length === 0) return { pathname: '/food-amount', params: { date, meal, draft: JSON.stringify(d) } };
  const text = (v: number | null) => (v === null ? '' : String(v));
  return {
    pathname: '/food-form',
    params: {
      date,
      meal,
      name: d.name,
      kcal: text(d.kcal),
      protein: text(d.protein),
      carbs: text(d.carbs),
      fat: text(d.fat),
      servingGrams: text(d.servingGrams),
      barcode: d.barcode ?? '',
      missing: d.missing.join(','),
    },
  };
}

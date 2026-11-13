// Nutrition maths (spec: docs/superpowers/specs/2026-11-13-nutrition-spec.md).
// Numbers stay unrounded here; screens round to whole values for display.

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEALS: { meal: Meal; label: string }[] = [
  { meal: 'breakfast', label: 'Breakfast' },
  { meal: 'lunch', label: 'Lunch' },
  { meal: 'dinner', label: 'Dinner' },
  { meal: 'snacks', label: 'Snacks' },
];

export type AmountUnit = 'serving' | 'gram';

/** kcal and Macros (grams). */
export type Numbers = { kcal: number; protein: number; carbs: number; fat: number };

/** An Entry's kcal and Macros from its per-Serving numbers; grams are turned into Servings by the Serving weight. */
export function entryNumbers(perServing: Numbers, amount: number, unit: AmountUnit, servingGrams: number | null): Numbers {
  const servings = unit === 'gram' ? amount / servingGrams! : amount;
  return {
    kcal: perServing.kcal * servings,
    protein: perServing.protein * servings,
    carbs: perServing.carbs * servings,
    fat: perServing.fat * servings,
  };
}

export function sumNumbers(list: Numbers[]): Numbers {
  return list.reduce(
    (t, n) => ({ kcal: t.kcal + n.kcal, protein: t.protein + n.protein, carbs: t.carbs + n.carbs, fat: t.fat + n.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Turns an Open Food Facts product into a draft Food (ADR 0001). Pure, so it is
// tested against saved product JSON; the network client is src/lib/openFoodFacts.ts.

/** The product fields asked for in a search (`fields=`). Open Food Facts is crowd-sourced, so any can be missing. */
export type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutriments?: Record<string, number | string | undefined>;
};

export type DraftField = 'name' | 'kcal' | 'protein' | 'carbs' | 'fat';

/** A Food as Open Food Facts gives it, per Serving; a missing number is null and listed in `missing`. */
export type DraftFood = {
  name: string;
  brand: string;
  barcode: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  servingGrams: number | null;
  missing: DraftField[];
};

const PER_100G = { kcal: 'energy-kcal_100g', protein: 'proteins_100g', carbs: 'carbohydrates_100g', fat: 'fat_100g' } as const;

function number(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Nutrition per 100 g becomes per Serving when the product gives a serving size in grams; otherwise the Serving is 100 g. */
export function toDraftFood(p: OpenFoodFactsProduct): DraftFood {
  const quantity = number(p.serving_quantity);
  const servingGrams = p.serving_quantity_unit === 'g' && quantity ? quantity : null;
  const scale = (servingGrams ?? 100) / 100;
  const per = (key: keyof typeof PER_100G) => {
    const v = number(p.nutriments?.[PER_100G[key]]);
    return v === null ? null : Math.round(v * scale * 100) / 100;
  };
  const draft = {
    name: p.product_name?.trim() ?? '',
    brand: p.brands?.split(',')[0].trim() ?? '',
    barcode: p.code?.trim() || null,
    kcal: per('kcal'),
    protein: per('protein'),
    carbs: per('carbs'),
    fat: per('fat'),
    servingGrams: servingGrams ?? 100,
  };
  const missing: DraftField[] = [];
  if (!draft.name) missing.push('name');
  for (const key of ['kcal', 'protein', 'carbs', 'fat'] as const) if (draft[key] === null) missing.push(key);
  return { ...draft, missing };
}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { toDraftFood, type DraftFood } from '@/domain/openFoodFacts';

// The thin Open Food Facts client (ADR 0001). Only the search text leaves the phone.
// Full-text search is only on the legacy /cgi/search.pl endpoint (the v2/v3 APIs have
// none; checked against openfoodfacts.github.io/openfoodfacts-server/api, Nov 2026).
// It allows about 10 searches a minute, so it runs only on a tap.

const USER_AGENT = `WorkoutNutritionTracker/${Constants.expoConfig?.version ?? '1.0.0'} (https://github.com/ankitKh-stack/workout-and-nutrition-tracker)`;
const FIELDS = 'code,product_name,brands,serving_quantity,serving_quantity_unit,nutriments';

export class OpenFoodFactsError extends Error {}
export const NO_CONNECTION = 'No connection. Your own foods still work.';
export const NOT_ANSWERING = "Open Food Facts isn't answering. Try again in a minute.";

export async function searchOpenFoodFacts(query: string): Promise<DraftFood[]> {
  const url =
    'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=20' +
    `&fields=${FIELDS}&search_terms=${encodeURIComponent(query.trim())}`;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  let res: Response;
  try {
    // The phone sends the User-Agent Open Food Facts asks for. Browsers won't set one, and
    // the header alone would trigger a CORS preflight the endpoint doesn't answer.
    const headers = Platform.OS === 'web' ? undefined : { 'User-Agent': USER_AGENT };
    res = await fetch(url, { headers, signal: abort.signal });
  } catch (e) {
    throw new OpenFoodFactsError(abort.signal.aborted ? NOT_ANSWERING : NO_CONNECTION, { cause: e });
  } finally {
    clearTimeout(timer);
  }
  // 429 (rate limit), 503 (global limit) and any other failure all mean "wait and retry".
  if (!res.ok) throw new OpenFoodFactsError(NOT_ANSWERING);
  try {
    const body = (await res.json()) as { products?: unknown[] };
    return (body.products ?? []).map((p) => toDraftFood(p as object));
  } catch (e) {
    throw new OpenFoodFactsError(NOT_ANSWERING, { cause: e });
  }
}

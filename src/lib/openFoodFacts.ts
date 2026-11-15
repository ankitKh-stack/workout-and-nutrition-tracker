import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { toDraftFood, type DraftFood } from '@/domain/openFoodFacts';

// The thin Open Food Facts client (ADR 0001). Only the search text or scanned barcode leaves the phone.
// Full-text search is only on the legacy /cgi/search.pl endpoint (the v2/v3 APIs have
// none; checked against openfoodfacts.github.io/openfoodfacts-server/api, Nov 2026).
// It allows about 10 searches a minute, so it runs only on a tap.

const USER_AGENT = `WorkoutNutritionTracker/${Constants.expoConfig?.version ?? '1.0.0'} (https://github.com/ankitKh-stack/workout-and-nutrition-tracker)`;
const FIELDS = 'code,product_name,brands,serving_quantity,serving_quantity_unit,nutriments';

export class OpenFoodFactsError extends Error {}
export const NO_CONNECTION = 'No connection. Your own foods still work.';
export const NOT_ANSWERING = "Open Food Facts isn't answering. Try again in a minute.";

/** The parsed JSON body, or null for a 404. Any other failure throws an OpenFoodFactsError. */
async function getJson(url: string): Promise<unknown> {
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
  if (res.status === 404) return null;
  // 429 (rate limit), 503 (global limit) and any other failure all mean "wait and retry".
  if (!res.ok) throw new OpenFoodFactsError(NOT_ANSWERING);
  try {
    return await res.json();
  } catch (e) {
    throw new OpenFoodFactsError(NOT_ANSWERING, { cause: e });
  }
}

export async function searchOpenFoodFacts(query: string): Promise<DraftFood[]> {
  const body = (await getJson(
    'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=20' +
      `&fields=${FIELDS}&search_terms=${encodeURIComponent(query.trim())}`,
  )) as { products?: object[] } | null;
  return (body?.products ?? []).map((p) => toDraftFood(p));
}

/** The product with this barcode, or null when Open Food Facts doesn't have it (a 404, or status 0). */
export async function lookupBarcode(barcode: string): Promise<DraftFood | null> {
  const body = (await getJson(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
  )) as { status?: number; product?: object } | null;
  if (body?.status !== 1 || !body.product) return null;
  // Keep the barcode as this phone scans it (Open Food Facts may pad a UPC-A to 13 digits),
  // so the saved Food is found offline by the next scan of the same pack.
  return { ...toDraftFood(body.product), barcode };
}

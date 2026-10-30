import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Loads a screen's data from storage every time the screen gains focus, so a
 * change made on another screen is visible without a manual refresh.
 */
export function useFocusData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    try {
      const result = await load();
      setData(result);
      setError(false);
      return result;
    } catch (e) {
      console.warn(e);
      setError(true);
      return undefined;
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, error, reload };
}

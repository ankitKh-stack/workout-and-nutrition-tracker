import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { getSettings, saveSetting } from '@/data/repository';
import { DEFAULT_REST_SECONDS } from '@/domain/restTimer';
import type { Unit } from '@/lib/format';
import { makeStyles } from '@/theme/styles';
import { palettes, type Palette, type ThemeName } from '@/theme/palette';

type SettingsValue = {
  theme: ThemeName;
  unit: Unit;
  /** Length of the rest countdown, in seconds. */
  restSeconds: number;
  setTheme: (theme: ThemeName) => void;
  setUnit: (unit: Unit) => void;
  setRestSeconds: (seconds: number) => void;
  /** Reads the settings again, e.g. after a backup was restored. */
  reloadSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * Loads the user's theme and weight unit from storage before rendering the
 * app, so the first frame already uses the saved choices. Until the user
 * picks a theme, the phone's system appearance is used.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [loaded, setLoaded] = useState(false);
  const [theme, setThemeState] = useState<ThemeName>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  const [unit, setUnitState] = useState<Unit>('kg');
  const [restSeconds, setRestState] = useState(DEFAULT_REST_SECONDS);

  const reloadSettings = useCallback(async () => {
    const s = await getSettings(db);
    setThemeState(s.theme ?? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'));
    setUnitState(s.unit ?? 'kg');
    setRestState(s.restSeconds ?? DEFAULT_REST_SECONDS);
  }, [db]);

  useEffect(() => {
    reloadSettings()
      .catch((e) => console.warn(e))
      .finally(() => setLoaded(true));
  }, [reloadSettings]);

  const setTheme = useCallback(
    (t: ThemeName) => {
      setThemeState(t);
      saveSetting(db, 'theme', t).catch((e) => console.warn(e));
    },
    [db],
  );
  const setUnit = useCallback(
    (u: Unit) => {
      setUnitState(u);
      saveSetting(db, 'unit', u).catch((e) => console.warn(e));
    },
    [db],
  );

  const setRestSeconds = useCallback(
    (seconds: number) => {
      setRestState(seconds);
      saveSetting(db, 'restSeconds', String(seconds)).catch((e) => console.warn(e));
    },
    [db],
  );

  const value = useMemo(
    () => ({ theme, unit, restSeconds, setTheme, setUnit, setRestSeconds, reloadSettings }),
    [theme, unit, restSeconds, setTheme, setUnit, setRestSeconds, reloadSettings],
  );
  if (!loaded) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

/** The current palette plus a stylesheet built from it. */
export function useTheme(): { colors: Palette; styles: ReturnType<typeof makeStyles>; theme: ThemeName } {
  const { theme } = useSettings();
  return useMemo(() => {
    const colors = palettes[theme];
    return { colors, styles: makeStyles(colors), theme };
  }, [theme]);
}

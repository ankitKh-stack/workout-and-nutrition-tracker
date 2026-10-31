import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { getSettings, saveSetting } from '@/data/repository';
import type { Unit } from '@/lib/format';
import { makeStyles } from '@/theme/styles';
import { palettes, type Palette, type ThemeName } from '@/theme/palette';

type SettingsValue = {
  theme: ThemeName;
  unit: Unit;
  setTheme: (theme: ThemeName) => void;
  setUnit: (unit: Unit) => void;
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

  useEffect(() => {
    getSettings(db)
      .then((s) => {
        if (s.theme) setThemeState(s.theme);
        if (s.unit) setUnitState(s.unit);
      })
      .catch((e) => console.warn(e))
      .finally(() => setLoaded(true));
  }, [db]);

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

  const value = useMemo(() => ({ theme, unit, setTheme, setUnit }), [theme, unit, setTheme, setUnit]);
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

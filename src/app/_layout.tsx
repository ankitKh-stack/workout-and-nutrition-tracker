import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { DATABASE_NAME, initializeDatabase } from '@/data/schema';
import { SettingsProvider, useTheme } from '@/theme/settings';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      <SettingsProvider>
        <ThemedApp />
      </SettingsProvider>
    </SQLiteProvider>
  );
}

/** Applies the active palette to navigation headers and the tab bar. */
function ThemedApp() {
  const { colors, theme } = useTheme();
  const navTheme = useMemo<Theme>(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, theme]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="name-day" options={{ presentation: 'modal', title: 'Name Your Day' }} />
        <Stack.Screen name="add-exercise" options={{ presentation: 'modal', title: 'Add Exercise' }} />
        <Stack.Screen name="intensifier" options={{ presentation: 'modal', title: 'Add intensifier' }} />
        <Stack.Screen name="swap-variation" options={{ presentation: 'modal', title: 'Swap variation' }} />
      </Stack>
    </ThemeProvider>
  );
}

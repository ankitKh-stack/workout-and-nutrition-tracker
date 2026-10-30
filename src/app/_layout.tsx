import Ionicons from '@expo/vector-icons/Ionicons';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { DATABASE_NAME, initializeDatabase } from '@/data/schema';
import { fonts } from '@/theme/palette';
import { SettingsProvider, useTheme } from '@/theme/settings';

export default function RootLayout() {
  // Render nothing until Inter and the icon font are ready, so no screen flashes in the
  // system face or with empty icon boxes.
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, ...Ionicons.font });
  if (!fontsLoaded) return null;

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      <SettingsProvider>
        <ThemedApp />
      </SettingsProvider>
    </SQLiteProvider>
  );
}

/** Applies the active palette and type to navigation headers and the tab bar. */
function ThemedApp() {
  const { colors, theme } = useTheme();
  const navTheme = useMemo<Theme>(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.text,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
        notification: colors.negative,
      },
      fonts: {
        regular: { fontFamily: fonts.regular, fontWeight: '400' },
        medium: { fontFamily: fonts.medium, fontWeight: '500' },
        bold: { fontFamily: fonts.semibold, fontWeight: '600' },
        heavy: { fontFamily: fonts.semibold, fontWeight: '600' },
      },
    };
  }, [colors, theme]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="name-day" options={{ presentation: 'modal', title: 'Name Your Day' }} />
        <Stack.Screen name="add-exercise" options={{ presentation: 'modal', title: 'Add Exercise' }} />
        <Stack.Screen name="intensifier" options={{ presentation: 'modal', title: 'Add intensifier' }} />
        <Stack.Screen name="swap-variation" options={{ presentation: 'modal', title: 'Swap variation' }} />
      </Stack>
    </ThemeProvider>
  );
}

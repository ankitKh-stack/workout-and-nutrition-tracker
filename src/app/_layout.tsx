import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { DATABASE_NAME, initializeDatabase } from '@/data/schema';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="name-day" options={{ presentation: 'modal', title: 'Name Your Day' }} />
        <Stack.Screen name="add-exercise" options={{ presentation: 'modal', title: 'Add Exercise' }} />
        <Stack.Screen name="intensifier" options={{ presentation: 'modal', title: 'Add intensifier' }} />
        <Stack.Screen name="swap-variation" options={{ presentation: 'modal', title: 'Swap variation' }} />
      </Stack>
    </SQLiteProvider>
  );
}

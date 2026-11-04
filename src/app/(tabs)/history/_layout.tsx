import { Stack } from 'expo-router';

export default function HistoryLayout() {
  return (
    <Stack>
      {/* The list draws its own large title. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'History' }} />
      <Stack.Screen name="[workoutId]" options={{ title: '' }} />
    </Stack>
  );
}

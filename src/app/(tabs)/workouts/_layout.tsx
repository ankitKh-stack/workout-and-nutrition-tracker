import { Stack } from 'expo-router';

export default function WorkoutsLayout() {
  return (
    <Stack>
      {/* Home draws its own large title. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Workouts' }} />
      <Stack.Screen name="day/[dayId]" options={{ title: '' }} />
      <Stack.Screen name="log" options={{ title: '' }} />
    </Stack>
  );
}

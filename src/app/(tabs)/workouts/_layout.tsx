import { Stack } from 'expo-router';

export default function WorkoutsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Workouts' }} />
      <Stack.Screen name="day/[dayId]" options={{ title: '' }} />
      <Stack.Screen name="log" options={{ title: '' }} />
    </Stack>
  );
}

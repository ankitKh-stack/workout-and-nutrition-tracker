import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack>
      {/* More draws its own large title. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'More' }} />
      <Stack.Screen name="history/index" options={{ title: 'History' }} />
      <Stack.Screen name="history/[workoutId]" options={{ title: '' }} />
    </Stack>
  );
}

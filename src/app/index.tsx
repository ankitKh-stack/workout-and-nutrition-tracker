import { Redirect } from 'expo-router';

// The app opens on the Workouts tab.
export default function Index() {
  return <Redirect href="/workouts" />;
}

import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { useTheme } from '@/theme/settings';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    // Tab root screens draw their own large title, so the tab header is hidden.
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: icon('◔') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('⋯') }} />
    </Tabs>
  );
}

import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { fonts } from '@/theme/palette';
import { useTheme } from '@/theme/settings';

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Ionicons name={name} size={22} color={color as string} />;
  };

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    // Tab root screens draw their own title, so the tab header is hidden.
    // The active tab is marked by brightness alone, never by a colour.
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, flexShrink: 0 },
        // Tall enough for a 22px icon over a 16px label, plus the phone's home-indicator inset.
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
      }}
    >
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: icon('barbell-outline') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar-clear-outline') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: icon('nutrition-outline') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal') }} />
    </Tabs>
  );
}

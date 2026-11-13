import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { CalendarWorkout } from '@/data/repository';
import { darkerLevel, type ShadeLevel } from '@/domain/progress';
import { formatDateLong, formatDateShort, localDateString, plural } from '@/lib/format';
import { fonts, onShade } from '@/theme/palette';
import { useTheme } from '@/theme/settings';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * This week, Monday to Sunday, in the calendar's own shading: the home
 * screen's answer to "when did I last train, and how did it go?". Tapping it
 * opens the Calendar. Given `onSelect` (the Nutrition tab), each Date is tapped
 * on its own instead and `selected` is filled in.
 */
export function WeekStrip({
  workouts = [],
  selected,
  onSelect,
}: {
  workouts?: CalendarWorkout[];
  selected?: string;
  onSelect?: (date: string) => void;
}) {
  const { styles, colors, theme } = useTheme();
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const days = WEEKDAYS.map((_, i) => localDateString(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  const today = localDateString(now);

  const levelFor = (date: string): ShadeLevel =>
    workouts.filter((w) => w.date === date).reduce<ShadeLevel>((acc, w) => darkerLevel(acc, w.progress.level), 'none');
  const thisWeek = workouts.filter((w) => w.date >= days[0] && w.date <= days[6]).length;
  const latest = workouts.reduce<string | null>((d, w) => (d === null || w.date > d ? w.date : d), null);
  const letterColor = (l: ShadeLevel) => onShade(l, theme) ?? colors.muted;

  const squares = (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((date, i) => {
        const future = date > today;
        const level = future ? 'none' : levelFor(date);
        const isSelected = date === selected;
        const square = {
          flex: 1,
          aspectRatio: 1,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? colors.primary : colors.shades[level],
          opacity: future && !isSelected ? 0.4 : 1,
          borderWidth: date === today ? 1.5 : 0,
          borderColor: colors.text,
        } as const;
        const letter = (
          <Text
            style={{
              fontFamily: date === today || isSelected ? fonts.semibold : fonts.medium,
              fontSize: 12,
              color: isSelected ? colors.onPrimary : letterColor(level),
            }}
          >
            {WEEKDAYS[i]}
          </Text>
        );
        return onSelect ? (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityLabel={formatDateLong(date)}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(date)}
            style={({ pressed }) => [square, pressed && styles.pressed]}
          >
            {letter}
          </Pressable>
        ) : (
          <View key={date} style={square}>
            {letter}
          </View>
        );
      })}
    </View>
  );

  if (onSelect) {
    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={[styles.sectionTitle, { flex: 1, marginTop: 0 }]}>This week</Text>
          {selected ? <Text style={[styles.small, styles.number]}>{formatDateLong(selected)}</Text> : null}
        </View>
        {squares}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`This week: ${plural(thisWeek, 'workout')}. Open the calendar.`}
      onPress={() => router.push('/calendar')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[styles.sectionTitle, { flex: 1, marginTop: 0 }]}>This week</Text>
        <Text style={[styles.small, styles.number]}>
          {plural(thisWeek, 'workout')}
          {latest ? ` · last ${formatDateShort(latest)}` : ''}
        </Text>
      </View>
      {squares}
    </Pressable>
  );
}

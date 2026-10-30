import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ErrorView, PageHeader } from '@/components/ui';
import { getCalendarWorkouts, type CalendarWorkout } from '@/data/repository';
import { darkerLevel, type ShadeLevel } from '@/domain/progress';
import {
  formatDateLong,
  formatDateShort,
  formatPercent,
  formatWeight,
  localDateString,
  monthLong,
  parseLocalDate,
} from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { fonts } from '@/theme/palette';
import { useSettings, useTheme } from '@/theme/settings';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LEGEND: ShadeLevel[] = ['none', 'zero', 1, 2, 3, 4];

const levelName = (l: ShadeLevel) => (l === 'zero' ? 'Zero volume' : l === 'none' ? 'No workout' : `Level ${l}`);

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/** The month's dates laid out Monday-first in weeks; null pads days outside the month. */
function monthWeeks(month: Date): (Date | null)[][] {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7; // blanks before the 1st, Monday = 0
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function changeText(w: CalendarWorkout): string {
  const r = w.progress.result;
  switch (r.kind) {
    case 'zero':
      return 'Zero volume';
    case 'first':
      return 'First workout, counted as +100%';
    case 'previousZero':
      return `+100% vs ${formatDateShort(r.previousDate)} (previous workout had zero volume)`;
    case 'change':
      return `${formatPercent(r.percent)} vs ${formatDateShort(r.previousDate)}`;
  }
}

// Calendar (SPEC.md 3.8): one month at a time, each day shaded GitHub-style
// by its workout's progress level, with buttons to move between months.
export default function CalendarScreen() {
  const db = useSQLiteContext();
  const { styles, colors, theme } = useTheme();
  const { unit } = useSettings();
  const { data: workouts, error, reload } = useFocusData(() => getCalendarWorkouts(db), [db]);
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const { byDate, earliestMonth } = useMemo(() => {
    const map = new Map<string, CalendarWorkout[]>();
    let earliest: string | null = null;
    for (const w of workouts ?? []) {
      map.set(w.date, [...(map.get(w.date) ?? []), w]);
      if (earliest === null || w.date < earliest) earliest = w.date;
    }
    return {
      byDate: map,
      earliestMonth: earliest ? firstOfMonth(parseLocalDate(earliest)) : firstOfMonth(new Date()),
    };
  }, [workouts]);

  if (error) return <ErrorView message="Could not load the calendar." onRetry={reload} />;

  const today = localDateString(new Date());
  const currentMonth = firstOfMonth(new Date());
  // Months can be browsed from the first logged workout up to the current month.
  const canGoBack = month > earliestMonth;
  const canGoForward = month < currentMonth;
  const goTo = (n: number) => {
    setMonth((m) => addMonths(m, n));
    setSelected(null);
  };

  const shade = (l: ShadeLevel) => colors.shades[l];
  const levelFor = (date: string): ShadeLevel =>
    (byDate.get(date) ?? []).reduce<ShadeLevel>((acc, w) => darkerLevel(acc, w.progress.level), 'none');
  // Day numbers need to stay readable on the strongest shades.
  // Day numbers stay readable (4.5:1) on every shade: black on the bright limes in
  // dark mode, white on the darkest green in light mode.
  const numberColor = (l: ShadeLevel) => {
    if (theme === 'dark') return l === 2 || l === 3 || l === 4 ? '#000000' : l === 'none' ? colors.muted : colors.text;
    return l === 4 ? '#ffffff' : l === 'none' ? colors.muted : colors.text;
  };

  const selectedWorkouts = selected
    ? [...(byDate.get(selected) ?? [])].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    : [];
  // The month answers "am I training, and how much?": days trained and the month's total volume.
  const monthKey = localDateString(month).slice(0, 7);
  const workoutsThisMonth = [...byDate.keys()].filter((d) => d.startsWith(monthKey)).length;
  const monthVolume = (workouts ?? []).filter((w) => w.date.startsWith(monthKey)).reduce((sum, w) => sum + w.volume, 0);

  const navButton = (label: string, enabled: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
        !enabled && { opacity: 0.3 },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={label === '‹' ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <PageHeader title="Calendar" subtitle="Each day is shaded by how much its volume grew" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {navButton('‹', canGoBack, () => goTo(-1), 'Previous month')}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.title}>
                {monthLong(month.getMonth())} {month.getFullYear()}
              </Text>
              <Text style={styles.muted}>
                {workoutsThisMonth === 0
                  ? 'No workouts'
                  : `${workoutsThisMonth} workout day${workoutsThisMonth === 1 ? '' : 's'} · ${formatWeight(monthVolume, unit)} ${unit} total`}
              </Text>
            </View>
            {navButton('›', canGoForward, () => goTo(1), 'Next month')}
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[styles.label, { flex: 1, textAlign: 'center' }]}>
                {d}
              </Text>
            ))}
          </View>

          {monthWeeks(month).map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row', gap: 6 }}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={{ flex: 1, aspectRatio: 1 }} />;
                const date = localDateString(day);
                const future = date > today;
                const level = future ? 'none' : levelFor(date);
                return (
                  <Pressable
                    key={di}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDateLong(date)}, ${levelName(level)}`}
                    disabled={future}
                    onPress={() => setSelected(date)}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: shade(level),
                      opacity: future ? 0.35 : 1,
                      borderWidth: 2,
                      borderColor: selected === date ? colors.text : 'transparent',
                    }}
                  >
                    <Text style={[styles.number, { fontSize: 13, color: numberColor(level), fontFamily: date === today ? fonts.semibold : fonts.regular }]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
            <Text style={styles.muted}>Less</Text>
            {LEGEND.map((l) => (
              <View
                key={String(l)}
                accessibilityLabel={levelName(l)}
                style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: shade(l) }}
              />
            ))}
            <Text style={styles.muted}>More</Text>
          </View>
        </View>

        <View style={[styles.card, { gap: 10 }]}>
          {workouts && workouts.length === 0 ? (
            <Text style={styles.muted}>No workouts logged yet. Finish a workout to see it here.</Text>
          ) : selected === null ? (
            <Text style={styles.muted}>Tap a day to see its workouts.</Text>
          ) : (
            <>
              <Text style={styles.sectionTitle}>{formatDateLong(selected)}</Text>
              {selectedWorkouts.length === 0 ? <Text style={styles.muted}>No workout logged</Text> : null}
              {selectedWorkouts.map((w) => {
                const r = w.progress.result;
                // Colour says good or bad: growth in the data hue, a drop or zero in grey.
                const grew = r.kind === 'first' || r.kind === 'previousZero' || (r.kind === 'change' && r.percent > 0);
                return (
                  <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      accessibilityLabel={levelName(w.progress.level)}
                      style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: shade(w.progress.level) }}
                    />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={styles.bodyStrong}>{w.dayName}</Text>
                      <Text style={[styles.small, { color: grew ? colors.accent : colors.faint }]}>{changeText(w)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.title, styles.number]}>
                        {formatWeight(w.volume, unit)}
                        <Text style={styles.small}> {unit}</Text>
                      </Text>
                      <Text style={styles.small}>
                        {w.progress.level === 'zero' ? 'volume' : `volume · ${levelName(w.progress.level)}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

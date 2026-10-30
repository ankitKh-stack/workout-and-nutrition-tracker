import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ErrorView, LargeHeader } from '@/components/ui';
import { getCalendarWorkouts, type CalendarWorkout } from '@/data/repository';
import { darkerLevel, type ShadeLevel } from '@/domain/progress';
import {
  formatDateLong,
  formatDateShort,
  formatPercent,
  formatWeight,
  localDateString,
  monthShort,
  parseLocalDate,
} from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

const VISIBLE_WEEKS = 20;
const CELL = 14;
const GAP = 3;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const LEGEND: ShadeLevel[] = ['none', 'zero', 1, 2, 3, 4];

const levelName = (l: ShadeLevel) => (l === 'zero' ? 'Zero volume' : l === 'none' ? 'No workout' : `Level ${l}`);

function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function changeText(w: CalendarWorkout): string {
  const r = w.progress.result;
  switch (r.kind) {
    case 'zero':
      return 'Zero volume';
    case 'first':
      return 'First workout — counted as +100%';
    case 'previousZero':
      return `+100% vs ${formatDateShort(r.previousDate)} (previous workout had zero volume)`;
    case 'change':
      return `${formatPercent(r.percent)} vs ${formatDateShort(r.previousDate)}`;
  }
}

// Calendar (SPEC.md 3.8): GitHub-style grid, newest week on the right.
export default function CalendarScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
  // One progress colour in five steps plus a neutral "no workout" colour (SPEC.md 7).
  const shade = (l: ShadeLevel) => colors.shades[l];
  const { data: workouts, error, reload } = useFocusData(() => getCalendarWorkouts(db), [db]);
  const [selected, setSelected] = useState<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const { weeks, byDate, today } = useMemo(() => {
    const todayDate = new Date();
    const todayStr = localDateString(todayDate);
    const map = new Map<string, CalendarWorkout[]>();
    let earliest: string | null = null;
    for (const w of workouts ?? []) {
      map.set(w.date, [...(map.get(w.date) ?? []), w]);
      if (earliest === null || w.date < earliest) earliest = w.date;
    }
    const currentMonday = mondayOf(todayDate);
    let start = addDays(currentMonday, -7 * (VISIBLE_WEEKS - 1));
    // Scroll back as far as the week of the first completed workout.
    if (earliest !== null) {
      const firstMonday = mondayOf(parseLocalDate(earliest));
      if (firstMonday < start) start = firstMonday;
    }
    const cols: Date[] = [];
    for (let m = start; m <= currentMonday; m = addDays(m, 7)) cols.push(m);
    return { weeks: cols, byDate: map, today: todayStr };
  }, [workouts]);

  if (error) return <ErrorView message="Could not load the calendar." onRetry={reload} />;

  const levelFor = (date: string): ShadeLevel =>
    (byDate.get(date) ?? []).reduce<ShadeLevel>((acc, w) => darkerLevel(acc, w.progress.level), 'none');

  const selectedWorkouts = selected
    ? [...(byDate.get(selected) ?? [])].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    : [];

  return (
    <View style={styles.screen}>
      <LargeHeader title="Calendar" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginTop: 16, marginRight: 4 }}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={{ height: CELL, marginBottom: GAP, fontSize: 10, lineHeight: CELL, color: colors.muted }}>
                {d}
              </Text>
            ))}
          </View>
          <ScrollView
            horizontal
            ref={scrollRef}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            showsHorizontalScrollIndicator={false}
          >
            {weeks.map((monday, col) => {
              const prev = weeks[col - 1];
              const showMonth = col === 0 || prev.getMonth() !== monday.getMonth();
              return (
                <View key={monday.toISOString()} style={{ width: CELL + GAP }}>
                  <View style={{ height: 16 }}>
                    {showMonth ? (
                      // Absolutely positioned so the label can overflow its narrow week column.
                      <Text style={{ position: 'absolute', left: 0, width: 40, fontSize: 10, color: colors.muted }}>
                        {monthShort(monday.getMonth())}
                      </Text>
                    ) : null}
                  </View>
                  {WEEKDAYS.map((_, row) => {
                    const date = localDateString(addDays(monday, row));
                    // Dates after today are not drawn.
                    if (date > today) return <View key={row} style={{ height: CELL, marginBottom: GAP }} />;
                    const level = levelFor(date);
                    return (
                      <Pressable
                        key={row}
                        accessibilityRole="button"
                        accessibilityLabel={`${formatDateLong(date)}, ${levelName(level)}`}
                        onPress={() => setSelected(date)}
                        style={{
                          width: CELL,
                          height: CELL,
                          marginBottom: GAP,
                          borderRadius: 3,
                          backgroundColor: shade(level),
                          borderWidth: selected === date ? 2 : 0,
                          borderColor: colors.text,
                        }}
                      />
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Text style={styles.muted}>Less</Text>
          {LEGEND.map((l) => (
            <View
              key={String(l)}
              accessibilityLabel={levelName(l)}
              style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: shade(l) }}
            />
          ))}
          <Text style={styles.muted}>More</Text>
        </View>

        <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, marginTop: 8, gap: 10 }}>
          {workouts && workouts.length === 0 ? (
            <Text style={styles.muted}>No workouts logged yet. Finish a workout to see it here.</Text>
          ) : selected === null ? (
            <Text style={styles.muted}>Tap a square to see that day.</Text>
          ) : (
            <>
              <Text style={styles.title}>{formatDateLong(selected)}</Text>
              {selectedWorkouts.length === 0 ? <Text style={styles.body}>No workout logged</Text> : null}
              {selectedWorkouts.map((w) => (
                <View key={w.id} style={{ gap: 2 }}>
                  <Text style={[styles.body, { fontWeight: '700' }]}>{w.dayName}</Text>
                  <Text style={styles.body}>Volume: {formatWeight(w.volume, unit)} {unit}</Text>
                  <Text style={styles.body}>{changeText(w)}</Text>
                  {/* For zero volume the change line already says "Zero volume". */}
                  {w.progress.level !== 'zero' ? <Text style={styles.body}>{levelName(w.progress.level)}</Text> : null}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

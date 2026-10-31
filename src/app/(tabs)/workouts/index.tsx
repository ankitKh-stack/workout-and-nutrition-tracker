import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ReorderableList } from '@/components/ReorderableList';
import { Button, Chevron, ErrorView, ListRow, PageHeader } from '@/components/ui';
import { WeekStrip } from '@/components/WeekStrip';
import { getCalendarWorkouts, listDays, reorderDays, type DaySummary } from '@/data/repository';
import { formatDateLong, formatTime, plural } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

// Home / Day list (SPEC.md 3.1). A day with a workout in progress is listed
// first and marked in the data hue so the user can get back to it in one tap.
// Holding a day and dragging it moves it.
export default function HomeScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { data, error, reload } = useFocusData(
    async () => ({ days: await listDays(db), workouts: await getCalendarWorkouts(db) }),
    [db],
  );
  const days = data?.days;
  const [dragging, setDragging] = useState(false);

  if (error) return <ErrorView message="Could not load your days." onRetry={reload} />;

  return (
    <View style={styles.screen}>
      <PageHeader title="Workouts" />
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!dragging}>
        {/* The week sits above the days so it is the first thing seen. */}
        {data && data.workouts.length > 0 ? <WeekStrip workouts={data.workouts} /> : null}
        {days ? (
          <ReorderableList
            items={days}
            keyOf={(day) => day.id}
            onDragChange={setDragging}
            onReorder={(ids) => reorderDays(db, ids).then(reload, reload)}
            renderItem={(day, drag) => {
              const active = day.inProgressSince !== null;
              return (
                <ListRow
                  {...drag.handlers}
                  lifted={drag.active}
                  title={day.name}
                  status={active ? `In progress · started ${formatTime(day.inProgressSince!)}` : undefined}
                  subtitle={`${plural(day.exerciseCount, 'exercise')} · ${
                    day.lastWorkoutDate ? `last ${formatDateLong(day.lastWorkoutDate)}` : 'no workouts yet'
                  }`}
                  right={<Chevron />}
                  style={active ? { borderWidth: 1.5, borderColor: colors.accent } : undefined}
                  onPress={() => router.push({ pathname: '/workouts/day/[dayId]', params: { dayId: day.id } })}
                />
              );
            }}
          />
        ) : null}
        <Button label="New day" icon="add" variant="primary" onPress={() => router.push('/name-day')} />
        {days ? <GettingStarted days={days} /> : null}
        {days && days.length === 0 ? (
          <Text style={styles.small}>Common splits: Push day, Pull day, Leg day, Upper, Lower, Full body.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * First-run checklist (shown until the first workout is finished). Each step's
 * tick is computed from the real data, so it doubles as the empty state.
 */
function GettingStarted({ days }: { days: DaySummary[] }) {
  const { styles, colors } = useTheme();
  const steps = [
    { label: 'Name a day, like Push day', done: days.length > 0 },
    { label: 'Add the exercises you do that day', done: days.some((d) => d.exerciseCount > 0) },
    { label: 'Start a workout and log your sets', done: days.some((d) => d.inProgressSince !== null || d.lastWorkoutDate !== null) },
    { label: 'Finish it to see it on the calendar', done: days.some((d) => d.lastWorkoutDate !== null) },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  return (
    <View style={[styles.card, { marginTop: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[styles.sectionTitle, { flex: 1, marginTop: 0 }]}>Getting started</Text>
        <Text style={[styles.small, styles.number]}>
          {doneCount} of {steps.length} done
        </Text>
      </View>
      {steps.map((s) => (
        <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 }}>
          <Ionicons
            name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={s.done ? colors.accent : colors.faint}
          />
          <Text style={[styles.body, s.done && { color: colors.muted, textDecorationLine: 'line-through' }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

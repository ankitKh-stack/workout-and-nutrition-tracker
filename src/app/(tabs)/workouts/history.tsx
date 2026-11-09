import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { NoteWindow } from '@/components/NoteWindow';
import { SetLines } from '@/components/SetLines';
import { EmptyText, ErrorView, Segmented } from '@/components/ui';
import { getExerciseHistory, setVariationNote } from '@/data/repository';
import { formatDateLong, formatWeight } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

// Exercise history (read-only). Opened by tapping an exercise when no workout
// is in progress, so the user can look up what they lifted last time without
// starting a workout. The only thing that can be changed here is the
// variation's note; nothing else on this screen writes to storage.
export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { unit } = useSettings();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const [variationId, setVariationId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const { data, error, reload } = useFocusData(
    () => getExerciseHistory(db, exerciseId, variationId),
    [db, exerciseId, variationId],
  );

  if (error) return <ErrorView message="Could not load this exercise." onRetry={reload} />;
  if (data === undefined) return <View style={styles.screen} />;
  if (data === null) {
    return (
      <View style={styles.centered}>
        <EmptyText>This exercise no longer exists.</EmptyText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data.exerciseName }} />

      {/* Switch which variation's history is shown; this never changes the next workout. */}
      {data.variations.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Segmented
            accessibilityLabel="Variation"
            options={data.variations.map((v) => ({ value: v.id, label: v.name }))}
            value={data.selectedVariationId}
            onChange={setVariationId}
          />
        </ScrollView>
      ) : null}

      {data.note !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Note, ${data.note}`}
          accessibilityHint="Opens the note"
          onPress={() => setNoteOpen(true)}
          style={({ pressed }) => [styles.card, { gap: 4 }, pressed && styles.pressed]}
        >
          <Text style={styles.label}>Note</Text>
          <Text style={styles.body} numberOfLines={3}>
            {data.note}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.small}>
        {data.workouts.length === 0
          ? 'No logged workouts for this variation yet.'
          : `Last ${data.workouts.length === 1 ? 'workout' : `${data.workouts.length} workouts`}, newest first`}
      </Text>

      {data.workouts.map((wk) => (
        <View key={wk.workoutId} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 }}>
            <Text style={[styles.sectionTitle, { flex: 1, marginTop: 0 }]}>{formatDateLong(wk.date)}</Text>
            <Text style={[styles.bodyStrong, styles.number]}>
              {formatWeight(wk.volume, unit)}
              <Text style={styles.small}> {unit} volume</Text>
            </Text>
          </View>
          <SetLines sets={wk.sets} />
        </View>
      ))}

      <Text style={styles.small}>To log sets, tap Start workout on the day screen.</Text>
      {noteOpen ? (
        <NoteWindow
          title={data.variations.find((v) => v.id === data.selectedVariationId)?.name ?? data.exerciseName}
          note={data.note}
          startEditing={false}
          onSave={async (text) => {
            await setVariationNote(db, data.selectedVariationId, text);
            await reload();
          }}
          onClose={() => setNoteOpen(false)}
        />
      ) : null}
    </ScrollView>
  );
}

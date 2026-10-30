import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, EmptyText, ErrorView, InlineError, ListRow } from '@/components/ui';
import {
  addIntensifier,
  getIntensifierPickerData,
  ValidationError,
  type IntensifierType,
} from '@/data/repository';
import { useFocusData } from '@/lib/useFocusData';
import { requestFocus } from '@/lib/writeQueue';
import { useTheme } from '@/theme/settings';

// Intensifier picker (SPEC.md 3.6): exactly three choices.
export default function IntensifierScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { workoutId, setId } = useLocalSearchParams<{ workoutId: string; setId: string }>();
  const { data, error, reload } = useFocusData(
    () => getIntensifierPickerData(db, workoutId, setId),
    [db, workoutId, setId],
  );
  const [step, setStep] = useState<'choose' | 'partner'>('choose');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (error) return <ErrorView message="Could not load this set." onRetry={reload} />;
  if (!data) return null;

  async function add(type: IntensifierType, partnerExerciseId: string | null = null) {
    setSaveError(null);
    try {
      const childId = await addIntensifier(db, setId, type, partnerExerciseId);
      // The new row's Reps field gets focus when the logging screen reloads.
      requestFocus(childId);
      router.back();
    } catch (e) {
      setSaveError(e instanceof ValidationError ? e.message : 'Could not add. Try again.');
    }
  }

  const title = step === 'choose' ? `Add intensifier to ${data.setLabel}` : 'Choose the other exercise';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title }} />
      {saveError ? <InlineError>{saveError}</InlineError> : null}
      {step === 'choose' ? (
        <>
          <ListRow title="Drop set" subtitle="Lower the weight and keep going" onPress={() => add('drop')} />
          <ListRow
            title="Partial reps"
            subtitle="Extra short-range reps at the same weight"
            onPress={() => add('partial')}
          />
          <ListRow
            title="Superset"
            subtitle={
              data.hasSuperset ? 'This set already has a superset' : 'Pair this set with a set of another exercise'
            }
            disabled={data.hasSuperset}
            onPress={() => setStep('partner')}
          />
        </>
      ) : data.partners.length === 0 ? (
        <>
          <EmptyText>Add a second exercise to this day to make a superset.</EmptyText>
          <Button
            label="Add exercise"
            onPress={() => router.push({ pathname: '/add-exercise', params: { dayId: data.dayId } })}
          />
        </>
      ) : (
        data.partners.map((p) => (
          <ListRow
            key={p.exerciseId}
            title={p.name}
            subtitle={p.variationName}
            onPress={() => add('superset', p.exerciseId)}
          />
        ))
      )}
      <Button label="Cancel" onPress={() => router.back()} />
    </ScrollView>
  );
}

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { KeyboardAwareScroll } from '@/components/KeyboardAwareScroll';
import { Button, EmptyText, ErrorView, Field, InlineError, ListRow } from '@/components/ui';
import {
  addExercise,
  addIntensifier,
  getIntensifierPickerData,
  ValidationError,
  type IntensifierType,
} from '@/data/repository';
import { useFocusData } from '@/lib/useFocusData';
import { requestFocus } from '@/lib/writeQueue';
import { useTheme } from '@/theme/settings';

// Intensifier picker (SPEC.md 3.6): exactly three choices. A superset partner
// can be picked from the day's exercises or added on the spot.
export default function IntensifierScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  // Each kind keeps the same colour mark it has on the logging screen.
  const mark = (color: string) => ({ borderLeftWidth: 3, borderLeftColor: color });
  const { workoutId, setId } = useLocalSearchParams<{ workoutId: string; setId: string }>();
  const { data, error, reload } = useFocusData(
    () => getIntensifierPickerData(db, workoutId, setId),
    [db, workoutId, setId],
  );
  const [step, setStep] = useState<'choose' | 'partner'>('choose');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  // Set at once (state only updates on the next render), so a fast double tap adds one exercise.
  const busy = useRef(false);

  if (error) return <ErrorView message="Could not load this set." onRetry={reload} />;
  if (!data) return null;

  /** Returns false when the intensifier could not be added (the error is shown). */
  async function add(type: IntensifierType, partnerExerciseId: string | null = null): Promise<boolean> {
    setSaveError(null);
    try {
      const childId = await addIntensifier(db, setId, type, partnerExerciseId);
      // The new row's Reps field gets focus when the logging screen reloads.
      requestFocus(childId);
      router.back();
      return true;
    } catch (e) {
      setSaveError(e instanceof ValidationError ? e.message : 'Could not add. Try again.');
      return false;
    }
  }

  const canAddNew = newName.trim().length > 0 && !addingNew;

  async function addNew() {
    if (!data || !canAddNew || busy.current) return;
    busy.current = true;
    setSaveError(null);
    setAddingNew(true);
    try {
      const exerciseId = await addExercise(db, data.dayId, newName);
      // If pairing fails, the new exercise still exists: reload so it shows in
      // the list above and can be picked, and clear the field.
      if (!(await add('superset', exerciseId))) {
        setNewName('');
        await reload();
      }
    } catch (e) {
      setSaveError(e instanceof ValidationError ? e.message : 'Could not add. Try again.');
    }
    busy.current = false;
    setAddingNew(false);
  }

  const title = step === 'choose' ? `Add intensifier to ${data.setLabel}` : 'Choose the other exercise';

  return (
    <KeyboardAwareScroll style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title }} />
      {/* On the partner step the error shows under the New exercise field instead. */}
      {saveError && step === 'choose' ? <InlineError>{saveError}</InlineError> : null}
      {step === 'choose' ? (
        <>
          <ListRow title="Drop set" subtitle="Lower the weight and keep going" style={mark(colors.kinds.drop)} onPress={() => add('drop')} />
          <ListRow
            title="Partial reps"
            subtitle="Extra short-range reps at the same weight"
            style={mark(colors.kinds.partial)}
            onPress={() => add('partial')}
          />
          <ListRow
            title="Superset"
            style={mark(colors.kinds.superset)}
            subtitle={
              data.hasSuperset ? 'This set already has a superset' : 'Pair this set with a set of another exercise'
            }
            disabled={data.hasSuperset}
            onPress={() => setStep('partner')}
          />
        </>
      ) : (
        <>
          {data.partners.length === 0 ? <EmptyText>No other exercises on this day yet. Add one below.</EmptyText> : null}
          {data.partners.map((p) => (
            <ListRow
              key={p.exerciseId}
              title={p.name}
              subtitle={p.variationName}
              onPress={() => add('superset', p.exerciseId)}
            />
          ))}
          {/* A new exercise is added to the day and paired with this set in one go. */}
          <View style={[styles.buttonRow, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Field
                value={newName}
                onChangeText={(t) => {
                  setNewName(t);
                  setSaveError(null);
                }}
                placeholder="New exercise, e.g. Triceps pushdown"
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={addNew}
                accessibilityLabel="New exercise name"
              />
              {saveError ? <InlineError>{saveError}</InlineError> : null}
            </View>
            <Button label="Add" variant="primary" onPress={addNew} disabled={!canAddNew} />
          </View>
        </>
      )}
      <Button label="Cancel" onPress={() => router.back()} />
    </KeyboardAwareScroll>
  );
}

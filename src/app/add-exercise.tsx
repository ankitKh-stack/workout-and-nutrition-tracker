import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Field, InlineError } from '@/components/ui';
import { addExercise, getExerciseName, renameExercise, ValidationError } from '@/data/repository';
import { useTheme } from '@/theme/settings';

// Add exercise (SPEC.md 3.4), also used to rename one (3.3). Typing a name
// creates the exercise and its first variation; with an exerciseId param it
// renames that exercise instead. The screen underneath reloads on focus.
export default function AddExerciseScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { dayId, exerciseId } = useLocalSearchParams<{ dayId: string; exerciseId?: string }>();
  const isRename = !!exerciseId;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (exerciseId) getExerciseName(db, exerciseId).then((n) => n !== null && setName(n));
  }, [db, exerciseId]);

  const canAdd = name.trim().length > 0 && !saving;

  async function add() {
    if (!canAdd) return;
    setSaving(true);
    try {
      if (isRename) await renameExercise(db, exerciseId, name);
      else await addExercise(db, dayId, name);
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, styles.content]}>
      <Stack.Screen options={{ title: isRename ? 'Rename Exercise' : 'Add Exercise' }} />
      <Field
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        placeholder="e.g. Seated dumbbell curl"
        autoFocus
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={add}
        invalid={!!error}
        accessibilityLabel="Exercise name"
      />
      {error ? <InlineError>{error}</InlineError> : null}
      <View style={styles.buttonRow}>
        <Button label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={isRename ? 'Save' : 'Add'} variant="primary" onPress={add} disabled={!canAdd} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

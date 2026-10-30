import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, InlineError } from '@/components/ui';
import { addExercise, ValidationError } from '@/data/repository';
import { useTheme } from '@/theme/settings';

// Add exercise (SPEC.md 3.4). Typing a name creates the exercise and its
// first variation; the screen underneath reloads on focus and shows it.
export default function AddExerciseScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canAdd = name.trim().length > 0 && !saving;

  async function add() {
    if (!canAdd) return;
    setSaving(true);
    try {
      await addExercise(db, dayId, name);
      router.back();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, styles.content]}>
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
        <Button label="Add" variant="primary" onPress={add} disabled={!canAdd} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

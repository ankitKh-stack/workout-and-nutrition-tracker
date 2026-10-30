import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Field, InlineError } from '@/components/ui';
import { createDay, getDayName, renameDay, ValidationError } from '@/data/repository';
import { useTheme } from '@/theme/settings';

// Name Your Day, used for both create and rename (SPEC.md 3.2).
// With a dayId param it renames that day; without one it creates a new day.
export default function NameDayScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { dayId } = useLocalSearchParams<{ dayId?: string }>();
  const isRename = !!dayId;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dayId) getDayName(db, dayId).then((n) => n !== null && setName(n));
  }, [db, dayId]);

  const canSave = name.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isRename) {
        await renameDay(db, dayId, name);
        router.back();
      } else {
        const id = await createDay(db, name);
        // Close the modal and open the new day so the user can add exercises.
        router.dismissAll();
        router.push({ pathname: '/workouts/day/[dayId]', params: { dayId: id } });
      }
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, styles.content]}>
      <Stack.Screen options={{ title: isRename ? 'Rename Day' : 'Name Your Day' }} />
      <Field
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        placeholder="e.g. Push Day"
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={save}
        invalid={!!error}
        accessibilityLabel="Day name"
      />
      {error ? <InlineError>{error}</InlineError> : null}
      <View style={styles.buttonRow}>
        <Button label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label="Save" variant="primary" onPress={save} disabled={!canSave} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

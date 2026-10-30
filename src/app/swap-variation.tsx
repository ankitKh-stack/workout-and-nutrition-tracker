import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, EmptyText, ErrorView, Field, InlineError, ListRow } from '@/components/ui';
import { createVariationAndSwap, getSwapData, swapVariation, ValidationError } from '@/data/repository';
import { formatDateLong } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

// Variation swap with create-on-the-spot (SPEC.md 3.7). Swapping never moves
// sets: what was logged stays on the old variation.
export default function SwapVariationScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { workoutId, exerciseId } = useLocalSearchParams<{ workoutId: string; exerciseId: string }>();
  const { data, error, reload } = useFocusData(() => getSwapData(db, workoutId, exerciseId), [db, workoutId, exerciseId]);
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (error) return <ErrorView message="Could not load variations." onRetry={reload} />;
  if (!data) return null;

  async function choose(variationId: string) {
    if (!data || variationId === data.selectedVariationId) return router.back();
    try {
      await swapVariation(db, workoutId, exerciseId, variationId);
      router.back();
    } catch {
      setFieldError('Could not save. Try again.');
    }
  }

  const canAdd = name.trim().length > 0 && !saving;

  async function create() {
    if (!canAdd) return;
    setSaving(true);
    try {
      await createVariationAndSwap(db, workoutId, exerciseId, name);
      router.back();
    } catch (e) {
      setFieldError(e instanceof ValidationError ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Swap variation — ${data.exerciseName}` }} />
      {data.variations.map((v) => (
        <ListRow
          key={v.id}
          title={v.name}
          subtitle={v.lastDone ? `Last done ${formatDateLong(v.lastDone)}` : 'Never done'}
          onPress={() => choose(v.id)}
          right={
            v.id === data.selectedVariationId ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.text} accessibilityLabel="Selected" />
            ) : null
          }
        />
      ))}
      {data.variations.length === 1 ? <EmptyText>No other variations yet. Add one below.</EmptyText> : null}
      <View style={[styles.buttonRow, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Field
            value={name}
            onChangeText={(t) => {
              setName(t);
              setFieldError(null);
            }}
            placeholder="New variation, e.g. Standing cable curl"
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={create}
            invalid={!!fieldError}
            accessibilityLabel="New variation name"
          />
          {fieldError ? <InlineError>{fieldError}</InlineError> : null}
        </View>
        <Button label="Add" variant="primary" onPress={create} disabled={!canAdd} />
      </View>
      <Button label="Cancel" onPress={() => router.back()} />
    </ScrollView>
  );
}

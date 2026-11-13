import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { KeyboardAwareScroll } from '@/components/KeyboardAwareScroll';
import { Button, Field, InlineError } from '@/components/ui';
import { createFood, ValidationError, type FoodInput } from '@/data/repository';
import { parseWeight } from '@/lib/format';
import { useTheme } from '@/theme/settings';

const NUMBERS = [
  { key: 'kcal', label: 'Calories (kcal)' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'fat', label: 'Fat (g)' },
  { key: 'servingGrams', label: 'Serving weight (g, optional)' },
] as const;
type Key = (typeof NUMBERS)[number]['key'];

// Create a food (SPEC.md 3.9): name and per-Serving numbers, saved to My foods,
// then straight on to the amount step for the Meal it was opened from.
export default function FoodFormScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const params = useLocalSearchParams<{ date: string; meal: string; name?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [text, setText] = useState<Record<Key, string>>({ kcal: '', protein: '', carbs: '', fat: '', servingGrams: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const values = {} as Record<Key, number | null>;
    for (const { key } of NUMBERS) {
      const parsed = parseWeight(text[key]);
      if (!parsed.ok) return setError(parsed.message);
      // Blank is a missing number; the repository rejects it, except for the optional Serving weight.
      values[key] = parsed.value ?? (key === 'servingGrams' ? null : NaN);
    }
    setSaving(true);
    try {
      const foodId = await createFood(db, { name, ...(values as Omit<FoodInput, 'name'>) });
      router.replace({ pathname: '/food-amount', params: { date: params.date, meal: params.meal, foodId } });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  const edit = (update: () => void) => {
    update();
    setError(null);
  };

  return (
    <KeyboardAwareScroll style={styles.screen} contentContainerStyle={styles.content}>
      <View style={{ gap: 4 }}>
        <Text style={styles.label}>Name</Text>
        <Field
          value={name}
          onChangeText={(t) => edit(() => setName(t))}
          placeholder="e.g. Greek yogurt"
          autoFocus={!name}
          maxLength={80}
          accessibilityLabel="Name"
        />
      </View>
      <Text style={styles.muted}>Per Serving:</Text>
      {NUMBERS.map(({ key, label }) => (
        <View key={key} style={{ gap: 4 }}>
          <Text style={styles.label}>{label}</Text>
          <Field
            value={text[key]}
            onChangeText={(t) => edit(() => setText((prev) => ({ ...prev, [key]: t })))}
            keyboardType="decimal-pad"
            accessibilityLabel={label}
          />
        </View>
      ))}
      {error ? <InlineError>{error}</InlineError> : null}
      <View style={styles.buttonRow}>
        <Button label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label="Save" variant="primary" onPress={save} disabled={saving} style={{ flex: 1 }} />
      </View>
    </KeyboardAwareScroll>
  );
}

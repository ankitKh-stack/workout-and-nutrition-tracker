import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { KeyboardAwareScroll } from '@/components/KeyboardAwareScroll';
import { Button, Field, InlineError } from '@/components/ui';
import { createFood, deleteFood, getFood, updateFood, ValidationError, type FoodInput } from '@/data/repository';
import { confirmAsync } from '@/lib/dialogs';
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
// An Open Food Facts result with gaps opens here prefilled, its gaps marked.
// With a foodId (from My foods on More) it edits or deletes that Food; past Entries keep their numbers.
export default function FoodFormScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const params = useLocalSearchParams<{ date: string; meal: string; foodId?: string; name?: string; barcode?: string; missing?: string } & Partial<Record<Key, string>>>();
  const [name, setName] = useState(params.name ?? '');
  const [text, setText] = useState<Record<Key, string>>({
    kcal: params.kcal ?? '',
    protein: params.protein ?? '',
    carbs: params.carbs ?? '',
    fat: params.fat ?? '',
    servingGrams: params.servingGrams ?? '',
  });
  const gaps = params.missing ? params.missing.split(',') : [];
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!params.foodId;
  const [loaded, setLoaded] = useState(!editing); // nothing to save or delete until the Food is read

  useEffect(() => {
    if (!params.foodId) return;
    getFood(db, params.foodId)
      .then((f) => {
        if (!f) return setError('This food no longer exists.');
        setName(f.name);
        const toText = (v: number | null) => (v === null ? '' : String(v));
        setText({ kcal: toText(f.kcal), protein: toText(f.protein), carbs: toText(f.carbs), fat: toText(f.fat), servingGrams: toText(f.servingGrams) });
        setLoaded(true);
      })
      .catch(() => setError('Could not load this food.'));
  }, [db, params.foodId]);

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
      const numbers = values as Omit<FoodInput, 'name'>;
      if (params.foodId) {
        await updateFood(db, params.foodId, { name, ...numbers });
        return router.back();
      }
      const foodId = await createFood(db, { name, ...numbers, barcode: params.barcode || null });
      router.replace({ pathname: '/food-amount', params: { date: params.date, meal: params.meal, foodId } });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  async function remove() {
    if (saving) return;
    const ok = await confirmAsync(`Delete '${name.trim()}'?`, 'This removes it from My foods. Dates it was logged on keep their entries.', 'Delete', true);
    if (!ok) return;
    try {
      await deleteFood(db, params.foodId!);
      router.back();
    } catch {
      setError('Could not delete. Nothing was removed.');
    }
  }

  const edit = (update: () => void) => {
    update();
    setError(null);
  };

  return (
    <KeyboardAwareScroll style={styles.screen} contentContainerStyle={styles.content}>
      {editing ? <Stack.Screen options={{ title: 'Edit food' }} /> : null}
      <View style={{ gap: 4 }}>
        <Text style={styles.label}>Name</Text>
        <Field
          value={name}
          onChangeText={(t) => edit(() => setName(t))}
          placeholder="e.g. Greek yogurt"
          autoFocus={!name && !editing}
          maxLength={80}
          invalid={gaps.includes('name') && !name.trim()}
          accessibilityLabel="Name"
        />
      </View>
      {gaps.length ? <Text style={styles.muted}>Open Food Facts is missing the marked fields. Fill them in to save.</Text> : null}
      <Text style={styles.muted}>Per Serving:</Text>
      {NUMBERS.map(({ key, label }) => (
        <View key={key} style={{ gap: 4 }}>
          <Text style={styles.label}>{label}</Text>
          <Field
            value={text[key]}
            onChangeText={(t) => edit(() => setText((prev) => ({ ...prev, [key]: t })))}
            keyboardType="decimal-pad"
            invalid={gaps.includes(key) && !text[key].trim()}
            accessibilityLabel={label}
          />
        </View>
      ))}
      {error ? <InlineError>{error}</InlineError> : null}
      <View style={styles.buttonRow}>
        <Button label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label="Save" variant="primary" onPress={save} disabled={saving || !loaded} style={{ flex: 1 }} />
      </View>
      {editing && loaded ? (
        <Button label="Delete food" icon="trash-outline" variant="link" style={{ alignItems: 'flex-start' }} onPress={remove} />
      ) : null}
    </KeyboardAwareScroll>
  );
}

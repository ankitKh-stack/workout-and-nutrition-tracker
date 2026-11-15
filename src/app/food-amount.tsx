import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Field, InlineError, Segmented } from '@/components/ui';
import { addEntry, addEntryWithNewFood, deleteEntry, getEntry, getFood, updateEntry, ValidationError, type Entry, type Food, type FoodInput } from '@/data/repository';
import { entryNumbers, type AmountUnit, type Meal } from '@/domain/nutrition';
import { confirmAsync } from '@/lib/dialogs';
import { parseWeight, whole } from '@/lib/format';
import { useTheme } from '@/theme/settings';

// The amount step (SPEC.md 3.9): Servings by default, grams when the Food has a
// Serving weight, with a live preview of kcal and Macros before adding.
// With an entryId it edits that Entry instead, using the numbers the Entry was logged with.
// With a draft (a complete Open Food Facts result) the Food is saved to My foods only on Add.
export default function FoodAmountScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { date, meal, foodId, entryId, draft } = useLocalSearchParams<{ date: string; meal: Meal; foodId?: string; entryId?: string; draft?: string }>();
  const [food, setFood] = useState<Food | Entry | null>(null);
  const [unit, setUnit] = useState<AmountUnit>('serving');
  const [text, setText] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entryId) {
      getEntry(db, entryId)
        .then((e) => {
          if (!e) return setError('This entry no longer exists.');
          setFood(e);
          setUnit(e.unit);
          setText(String(e.amount));
        })
        .catch(() => setError('Could not load this entry.'));
    } else if (draft) {
      try {
        setFood({ id: '', ...(JSON.parse(draft) as FoodInput) });
      } catch {
        setError('Could not load this food.');
      }
    } else {
      getFood(db, foodId!)
        .then((f) => (f ? setFood(f) : setError('This food no longer exists.')))
        .catch(() => setError('Could not load this food.'));
    }
  }, [db, foodId, entryId, draft]);

  const parsed = parseWeight(text);
  const amount = parsed.ok && parsed.value !== null && parsed.value > 0 ? parsed.value : null;
  const preview = food && amount !== null ? entryNumbers(food, amount, unit, food.servingGrams) : null;

  async function add() {
    if (saving) return;
    if (amount === null) return setError(parsed.ok ? 'Enter an amount above 0.' : parsed.message);
    setSaving(true);
    try {
      if (entryId) {
        await updateEntry(db, entryId, amount, unit);
        router.back();
      } else if (draft) {
        const { name, kcal, protein, carbs, fat, servingGrams, barcode } = food as Food & FoodInput;
        await addEntryWithNewFood(db, { name, kcal, protein, carbs, fat, servingGrams, barcode }, { date, meal, amount, unit });
        router.dismissAll();
      } else {
        await addEntry(db, { date, meal, foodId: foodId!, amount, unit });
        router.dismissAll();
      }
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : entryId ? 'Could not save. Try again.' : 'Could not add. Try again.');
      setSaving(false);
    }
  }

  async function remove() {
    if (!food || saving) return;
    const ok = await confirmAsync(`Delete '${food.name}'?`, 'This removes the entry and its calories from this date.', 'Delete', true);
    if (!ok) return;
    try {
      await deleteEntry(db, entryId!);
      router.back();
    } catch {
      setError('Could not delete. Nothing was removed.');
    }
  }

  return (
    <View style={[styles.screen, styles.content]}>
      <Stack.Screen options={{ title: food?.name ?? 'Amount' }} />
      {food?.servingGrams ? (
        <Segmented
          accessibilityLabel="Amount in"
          value={unit}
          onChange={(u) => {
            // Keep the same quantity of food when switching unit.
            if (amount !== null) setText(String(Math.round((u === 'gram' ? amount * food.servingGrams! : amount / food.servingGrams!) * 100) / 100));
            setUnit(u);
            setError(null);
          }}
          options={[
            { value: 'serving', label: 'Servings' },
            { value: 'gram', label: 'Grams' },
          ]}
        />
      ) : null}
      <Field
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={add}
        invalid={!!error}
        accessibilityLabel={unit === 'gram' ? 'Grams' : 'Servings'}
      />
      {error ? <InlineError>{error}</InlineError> : null}
      <Text style={[styles.body, styles.number]}>
        {preview
          ? `${whole(preview.kcal)} kcal · Protein ${whole(preview.protein)} g · Carbs ${whole(preview.carbs)} g · Fat ${whole(preview.fat)} g`
          : ' '}
      </Text>
      <View style={styles.buttonRow}>
        <Button label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={entryId ? 'Save' : 'Add'} variant="primary" onPress={add} disabled={!food || amount === null || saving} style={{ flex: 1 }} />
      </View>
      {entryId && food ? (
        <Button label="Delete entry" icon="trash-outline" variant="link" style={{ alignItems: 'flex-start' }} onPress={remove} />
      ) : null}
    </View>
  );
}

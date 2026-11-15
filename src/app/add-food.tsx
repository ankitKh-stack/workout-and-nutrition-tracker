import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button, Chevron, EmptyText, Field, InlineError, ListRow } from '@/components/ui';
import { listFoods } from '@/data/repository';
import type { DraftFood } from '@/domain/openFoodFacts';
import { draftRoute } from '@/lib/draftRoute';
import { whole } from '@/lib/format';
import { NOT_ANSWERING, OpenFoodFactsError, searchOpenFoodFacts } from '@/lib/openFoodFacts';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

type OnlineSearch =
  | { query: string; status: 'loading' }
  | { query: string; status: 'done'; results: DraftFood[] }
  | { query: string; status: 'error'; message: string };

// Add food (SPEC.md 3.9): searches My foods as you type, offline. Picking a
// Food opens the amount step; Create a food opens the food form. Open Food Facts
// is searched only when its row is tapped (ADR 0001). The barcode button opens the scanner.
export default function AddFoodScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const [query, setQuery] = useState('');
  const { data: foods } = useFocusData(() => listFoods(db, query), [db, query]);
  const [online, setOnline] = useState<OnlineSearch | null>(null);
  const term = query.trim();
  const shown = online?.query === term ? online : null; // results belong to the text they were searched for

  async function searchOnline() {
    if (online?.status === 'loading') return;
    setOnline({ query: term, status: 'loading' });
    try {
      setOnline({ query: term, status: 'done', results: await searchOpenFoodFacts(term) });
    } catch (e) {
      setOnline({ query: term, status: 'error', message: e instanceof OpenFoodFactsError ? e.message : NOT_ANSWERING });
    }
  }

  async function pick(d: DraftFood) {
    router.push(await draftRoute(db, d, date, meal));
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search My foods"
          autoFocus
          accessibilityLabel="Search My foods"
          style={{ flex: 1 }}
        />
        <Button
          label=""
          icon="barcode-outline"
          accessibilityLabel="Scan a barcode"
          onPress={() => router.push({ pathname: '/scan-food', params: { date, meal } })}
        />
      </View>
      <View style={{ gap: 8 }}>
        {foods?.map((f) => (
          <ListRow
            key={f.id}
            title={f.name}
            subtitle={`${whole(f.kcal)} kcal per Serving${f.servingGrams ? ` (${whole(f.servingGrams)} g)` : ''}`}
            onPress={() => router.push({ pathname: '/food-amount', params: { date, meal, foodId: f.id } })}
            right={<Chevron />}
          />
        ))}
        {foods?.length === 0 ? <EmptyText>{term ? 'No food in My foods matches.' : 'My foods is empty.'}</EmptyText> : null}
      </View>
      {term ? (
        <View style={{ gap: 8 }}>
          <ListRow
            title={`Search Open Food Facts for '${term}'`}
            onPress={searchOnline}
            disabled={online?.status === 'loading'}
            right={online?.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : <Chevron />}
          />
          {shown?.status === 'error' ? <InlineError>{shown.message}</InlineError> : null}
          {shown?.status === 'done' && shown.results.length === 0 ? <EmptyText>Open Food Facts has no match.</EmptyText> : null}
          {shown?.status === 'done'
            ? shown.results.map((d, i) => (
                <ListRow
                  key={`${d.barcode ?? ''}-${i}`}
                  title={d.name || 'Unnamed food'}
                  subtitle={[
                    d.brand,
                    d.missing.length ? 'Some numbers missing' : `${whole(d.kcal!)} kcal per Serving (${whole(d.servingGrams!)} g)`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => pick(d)}
                  right={<Chevron />}
                />
              ))
            : null}
          {shown?.status === 'done' && shown.results.length ? (
            <Text style={styles.muted}>Data from Open Food Facts (ODbL).</Text>
          ) : null}
        </View>
      ) : null}
      <Button
        label="Create a food"
        icon="add"
        onPress={() => router.push({ pathname: '/food-form', params: { date, meal, name: term } })}
      />
    </ScrollView>
  );
}

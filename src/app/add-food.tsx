import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Chevron, EmptyText, Field, ListRow } from '@/components/ui';
import { listFoods } from '@/data/repository';
import { whole } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

// Add food (SPEC.md 3.9): searches My foods as you type, offline. Picking a
// Food opens the amount step; Create a food opens the food form.
export default function AddFoodScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const [query, setQuery] = useState('');
  const { data: foods } = useFocusData(() => listFoods(db, query), [db, query]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field value={query} onChangeText={setQuery} placeholder="Search My foods" autoFocus accessibilityLabel="Search My foods" />
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
        {foods?.length === 0 ? <EmptyText>{query.trim() ? 'No food in My foods matches.' : 'My foods is empty.'}</EmptyText> : null}
      </View>
      <Button
        label="Create a food"
        icon="add"
        onPress={() => router.push({ pathname: '/food-form', params: { date, meal, name: query.trim() } })}
      />
    </ScrollView>
  );
}

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Chevron, EmptyText, ErrorView, Field, ListRow } from '@/components/ui';
import { listFoods } from '@/data/repository';
import { whole } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

// My foods (SPEC.md 3.9), opened from More: every saved Food A–Z with a name
// search. Tapping one opens the food form to edit or delete it.
export default function MyFoodsScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const [query, setQuery] = useState('');
  const { data: foods, error, reload } = useFocusData(() => listFoods(db, query), [db, query]);

  if (error) return <ErrorView message="Could not load My foods." onRetry={reload} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field value={query} onChangeText={setQuery} placeholder="Search My foods" accessibilityLabel="Search My foods" />
      <View style={{ gap: 8 }}>
        {foods?.map((f) => (
          <ListRow
            key={f.id}
            title={f.name}
            subtitle={`${whole(f.kcal)} kcal per Serving${f.servingGrams ? ` (${whole(f.servingGrams)} g)` : ''}`}
            onPress={() => router.push({ pathname: '/food-form', params: { foodId: f.id } })}
            right={<Chevron />}
          />
        ))}
        {foods?.length === 0 ? (
          <EmptyText>{query.trim() ? 'No food in My foods matches.' : 'My foods is empty. Foods you log are kept here.'}</EmptyText>
        ) : null}
      </View>
    </ScrollView>
  );
}

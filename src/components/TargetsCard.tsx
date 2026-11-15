import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Field, InlineError } from '@/components/ui';
import { getTargets, saveTargets, ValidationError, type Targets } from '@/data/repository';
import { parseWeight } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

const FIELDS = [
  { key: 'kcal', label: 'Calories (kcal)' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'fat', label: 'Fat (g)' },
] as const;
type Key = (typeof FIELDS)[number]['key'];

const toText = (t: Targets) =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, t[key] === null ? '' : String(t[key])])) as Record<Key, string>;

// Targets on More (SPEC.md 3.9): four daily numbers, the same on every Date; any can be blank.
export function TargetsCard() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { data: stored } = useFocusData(() => getTargets(db), [db]);
  const [text, setText] = useState<Record<Key, string>>({ kcal: '', protein: '', carbs: '', fat: '' });
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Keyed on the values, so a refocus that reloads the same Targets keeps unsaved typing.
  const storedKey = stored && JSON.stringify(stored);
  useEffect(() => {
    if (storedKey) setText(toText(JSON.parse(storedKey)));
  }, [storedKey]);

  async function save() {
    if (saving) return;
    const targets = {} as Targets;
    for (const { key, label } of FIELDS) {
      const parsed = parseWeight(text[key]);
      if (!parsed.ok) return setMessage({ error: true, text: `${label}: ${parsed.message}` });
      targets[key] = parsed.value;
    }
    setSaving(true);
    try {
      await saveTargets(db, targets);
      setMessage({ error: false, text: 'Saved' });
    } catch (e) {
      setMessage({ error: true, text: e instanceof ValidationError ? e.message : 'Could not save. Try again.' });
    }
    setSaving(false);
  }

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {FIELDS.map(({ key, label }) => (
          <View key={key} style={{ flexBasis: '45%', flexGrow: 1, gap: 4 }}>
            <Text style={styles.label}>{label}</Text>
            <Field
              value={text[key]}
              onChangeText={(t) => {
                setText((prev) => ({ ...prev, [key]: t }));
                setMessage(null);
              }}
              placeholder="Blank"
              keyboardType="decimal-pad"
              accessibilityLabel={`${label} target`}
            />
          </View>
        ))}
      </View>
      <Text style={styles.small}>The same every day. Leave any blank to just see its total.</Text>
      {message?.error ? <InlineError>{message.text}</InlineError> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button label="Save targets" variant="primary" onPress={save} disabled={saving} style={{ flex: 1 }} />
        {message && !message.error ? <Text style={styles.muted}>{message.text}</Text> : null}
      </View>
    </View>
  );
}

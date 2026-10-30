import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SetField } from '@/components/SetField';
import { Button, EmptyText, ErrorView } from '@/components/ui';
import {
  addSet,
  countIntensifiers,
  getLoggingData,
  removeIntensifier,
  removeSet,
  swapVariation,
  type IntensifierRow,
  type IntensifierType,
  type NormalSetRow,
} from '@/data/repository';
import { confirmAsync } from '@/lib/dialogs';
import { formatDateShort, formatNumber, formatWeight, plural, toDisplayWeight } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { drainWrites, requestFocus, takeFocusRequest } from '@/lib/writeQueue';
import { useSettings, useTheme } from '@/theme/settings';
import type { Palette } from '@/theme/palette';

/** Each intensifier gets its own accent colour, like the macro colours in the reference screenshots. */
const intensifierColor = (type: IntensifierType, c: Palette) =>
  type === 'drop' ? c.orange : type === 'partial' ? c.yellow : c.blue;

// Exercise logging (SPEC.md 3.5)
export default function LogScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
  const { workoutId, exerciseId } = useLocalSearchParams<{ workoutId: string; exerciseId: string }>();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [failedWrites, setFailedWrites] = useState<(() => Promise<void>)[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const opened = useRef(false);

  const { data, error, reload } = useFocusData(async () => {
    // Field edits save in the background; wait so the reload sees them.
    await drainWrites();
    const firstLoad = !opened.current;
    opened.current = true;
    let d = await getLoggingData(db, workoutId, exerciseId);
    // A freshly opened exercise with nothing logged gets one empty set row,
    // so the reps and weight fields are visible straight away.
    if (d && firstLoad && d.workoutStatus === 'in_progress' && d.sets.length === 0 && d.partnerSets.length === 0) {
      requestFocus(await addSet(db, workoutId, d.selectedVariationId));
      d = await getLoggingData(db, workoutId, exerciseId);
    }
    setFocusId(takeFocusRequest());
    return d;
  }, [db, workoutId, exerciseId]);

  if (error) return <ErrorView message="Could not load this exercise." onRetry={reload} />;
  if (data === undefined) return <View style={styles.screen} />;
  if (data === null) {
    return (
      <View style={styles.centered}>
        <EmptyText>This exercise no longer exists.</EmptyText>
      </View>
    );
  }
  if (data.workoutStatus !== 'in_progress') {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: data.exerciseName }} />
        <EmptyText>This workout has been finished. Start a new workout from the day screen to log more sets.</EmptyText>
      </View>
    );
  }

  const onSaveError = (retry: () => Promise<void>) => setFailedWrites((list) => [...list, retry]);

  async function retryWrites() {
    const list = failedWrites;
    setFailedWrites([]);
    for (const write of list) {
      try {
        await write();
      } catch {
        onSaveError(write);
      }
    }
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      await reload();
    } catch {
      setActionError('Last change was not saved. Try again.');
    }
  }

  async function onRemoveSet(set: NormalSetRow) {
    const n = await countIntensifiers(db, set.setId);
    if (n > 0) {
      const ok = await confirmAsync(
        `Remove Set ${set.number}?`,
        `Remove Set ${set.number} and its ${plural(n, 'intensifier')}?`,
        'Remove',
        true,
      );
      if (!ok) return;
    }
    await run(() => removeSet(db, set.setId));
  }

  const lastTimeText = data.lastTime
    ? `Last time (${formatDateShort(data.lastTime.date)}): ${
        data.lastTime.sets.map((s) => `${s.reps ?? '—'} × ${formatWeight(s.weight, unit)} ${unit}`).join(', ') || '—'
      }`
    : 'No history for this variation yet';

  const showWriteError = failedWrites.length > 0 || actionError;
  const rowStyles = makeRowStyles(colors);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: data.exerciseName }} />
      {showWriteError ? (
        <View style={{ backgroundColor: colors.danger, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#fff', flex: 1 }}>Last change was not saved. Try again.</Text>
          {failedWrites.length > 0 ? <Button label="Retry" compact onPress={retryWrites} /> : null}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Variation</Text>
              <Text style={styles.title}>{data.selectedVariationName}</Text>
            </View>
            <Button
              label="Swap"
              compact
              onPress={() => router.push({ pathname: '/swap-variation', params: { workoutId, exerciseId } })}
            />
          </View>
          <Text style={styles.muted}>{lastTimeText}</Text>
          {data.alsoLogged.length > 0 ? (
            <Text style={styles.muted}>
              Also logged this workout:{' '}
              {data.alsoLogged.map((v, i) => (
                <Text key={v.variationId}>
                  {i > 0 ? ', ' : ''}
                  <Text
                    accessibilityRole="link"
                    style={{ color: colors.primary }}
                    onPress={() => run(() => swapVariation(db, workoutId, exerciseId, v.variationId))}
                  >
                    {v.name} ({plural(v.count, 'set')})
                  </Text>
                </Text>
              ))}
            </Text>
          ) : null}
        </View>

        {data.sets.map((set) => (
          <SetBlock
            // Remount when stored values or the unit change so fields show fresh values.
            key={`${unit}:${set.setId}:${set.reps}:${set.weight}:${set.intensifiers.map((i) => `${i.reps}/${i.weight}`).join()}`}
            set={set}
            focusId={focusId}
            onSaveError={onSaveError}
            onAddIntensifier={() =>
              router.push({ pathname: '/intensifier', params: { workoutId, setId: set.setId } })
            }
            onRemove={() => onRemoveSet(set)}
            onRemoveIntensifier={(i) => run(() => removeIntensifier(db, i.intensifierId))}
          />
        ))}

        {data.partnerSets.map((p) => (
          <View key={`${unit}:${p.setId}:${p.reps}:${p.weight}`} style={[styles.card, rowStyles.accent(colors.blue)]}>
            <Text style={rowStyles.label}>{p.label}</Text>
            <View style={rowStyles.fields}>
              <SetField setId={p.setId} field="reps" initial={p.reps} onSaveError={onSaveError} />
              <SetField setId={p.setId} field="weight" initial={p.weight} onSaveError={onSaveError} />
            </View>
          </View>
        ))}

        <Button
          label="+ Add set"
          onPress={() =>
            run(async () => {
              requestFocus(await addSet(db, workoutId, data.selectedVariationId));
            })
          }
        />
      </ScrollView>
    </View>
  );
}

type SetBlockProps = {
  set: NormalSetRow;
  focusId: string | null;
  onSaveError: (retry: () => Promise<void>) => void;
  onAddIntensifier: () => void;
  onRemove: () => void;
  onRemoveIntensifier: (i: IntensifierRow) => void;
};

/** A normal set row followed by its indented intensifier rows. */
function SetBlock({ set, focusId, onSaveError, onAddIntensifier, onRemove, onRemoveIntensifier }: SetBlockProps) {
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
  const rowStyles = makeRowStyles(colors);
  // Tracked here, in the display unit, so partial-reps rows show the parent weight as it is typed.
  const [parentWeight, setParentWeight] = useState(set.weight === null ? null : toDisplayWeight(set.weight, unit));

  return (
    <View style={styles.card}>
      <View style={rowStyles.fields}>
        <Text style={rowStyles.setLabel}>Set {set.number}</Text>
        <SetField
          setId={set.setId}
          field="reps"
          initial={set.reps}
          autoFocus={focusId === set.setId}
          onSaveError={onSaveError}
        />
        <SetField
          setId={set.setId}
          field="weight"
          initial={set.weight}
          onValueChange={setParentWeight}
          onSaveError={onSaveError}
        />
      </View>
      <View style={[styles.buttonRow, { justifyContent: 'flex-end' }]}>
        <Button label="+ Intensifier" variant="link" compact onPress={onAddIntensifier} />
        <Button label="Remove" variant="link" compact onPress={onRemove} />
      </View>
      {set.intensifiers.map((i) => (
        <View key={i.intensifierId} style={[rowStyles.indented, rowStyles.accent(intensifierColor(i.type, colors))]}>
          <View style={rowStyles.fields}>
            <Text style={[rowStyles.intensifierLabel, { color: intensifierColor(i.type, colors) }]}>
              {i.type === 'drop' ? 'Drop' : i.type === 'partial' ? 'Partials' : `Superset: ${i.partnerLabel}`}
            </Text>
            <SetField
              setId={i.childSetId}
              field="reps"
              initial={i.reps}
              autoFocus={focusId === i.childSetId}
              onSaveError={onSaveError}
            />
            {i.type === 'partial' ? (
              // Partial reps have no weight field: they use the parent set's weight.
              <Text style={[styles.muted, { flex: 1, paddingTop: 10 }]}>
                @ {parentWeight === null ? '—' : formatNumber(parentWeight)} {unit}
              </Text>
            ) : (
              <SetField setId={i.childSetId} field="weight" initial={i.weight} onSaveError={onSaveError} />
            )}
          </View>
          <View style={[styles.buttonRow, { justifyContent: 'flex-end' }]}>
            <Pressable accessibilityRole="button" onPress={() => onRemoveIntensifier(i)}>
              <Text style={{ color: colors.primary, fontWeight: '600', padding: 4 }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function makeRowStyles(c: Palette) {
  return {
    fields: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8 },
    setLabel: { width: 48, paddingTop: 10, fontWeight: '700' as const, color: c.text },
    label: { fontWeight: '600' as const, color: c.text },
    indented: { marginLeft: 16, paddingLeft: 10, gap: 4 },
    intensifierLabel: { width: 96, paddingTop: 10, fontWeight: '600' as const },
    accent: (color: string) => ({ borderLeftWidth: 3, borderLeftColor: color }),
  };
}

import Ionicons from '@expo/vector-icons/Ionicons';
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
import { fonts, type Palette } from '@/theme/palette';
import { useSettings, useTheme } from '@/theme/settings';

/** Each kind of intensifier has its own mark: a 3px edge and its label in the kind's colour. */
const intensifierColor = (type: IntensifierType, c: Palette) => c.kinds[type];

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
    ? `Last done ${formatDateShort(data.lastTime.date)} · ${plural(data.lastTime.sets.length, 'set')}`
    : 'No history for this variation yet';

  const showWriteError = failedWrites.length > 0 || actionError;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: data.exerciseName }} />
      {showWriteError ? (
        <View style={{ backgroundColor: colors.surface, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="alert-circle" size={18} color={colors.negative} />
          <Text style={[styles.body, { flex: 1 }]}>Last change was not saved.</Text>
          {failedWrites.length > 0 ? <Button label="Retry" compact onPress={retryWrites} /> : null}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.label}>Variation</Text>
              <Text style={styles.title}>{data.selectedVariationName}</Text>
            </View>
            <Button
              label="Swap"
              icon="swap-horizontal"
              compact
              onPress={() => router.push({ pathname: '/swap-variation', params: { workoutId, exerciseId } })}
            />
          </View>
          <Text style={styles.small}>{lastTimeText}</Text>
          {data.alsoLogged.length > 0 ? (
            <Text style={styles.small}>
              Also logged this workout:{' '}
              {data.alsoLogged.map((v, i) => (
                <Text key={v.variationId}>
                  {i > 0 ? ', ' : ''}
                  <Text
                    accessibilityRole="link"
                    style={{ color: colors.text, fontFamily: fonts.semibold, textDecorationLine: 'underline' }}
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
            last={data.lastTime?.sets[set.number - 1] ?? null}
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
          <View key={`${unit}:${p.setId}:${p.reps}:${p.weight}`} style={[styles.card, edge(colors.kinds.superset)]}>
            <Text style={[styles.bodyStrong, { color: colors.kinds.superset }]}>{p.label}</Text>
            <FieldPair setId={p.setId} reps={p.reps} weight={p.weight} onSaveError={onSaveError} />
          </View>
        ))}

        <Button
          label="Add set"
          icon="add"
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

const edge = (color: string) => ({ borderLeftWidth: 3, borderLeftColor: color });

/** Reps and weight side by side, each with its label above the field. */
function FieldPair({
  setId,
  reps,
  weight,
  autoFocus,
  onWeightChange,
  onSaveError,
}: {
  setId: string;
  reps: number | null;
  weight: number | null;
  autoFocus?: boolean;
  onWeightChange?: (value: number | null) => void;
  onSaveError: (retry: () => Promise<void>) => void;
}) {
  const { styles } = useTheme();
  const { unit } = useSettings();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.label}>Reps</Text>
        <SetField setId={setId} field="reps" initial={reps} autoFocus={autoFocus} onSaveError={onSaveError} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.label}>Weight ({unit})</Text>
        <SetField setId={setId} field="weight" initial={weight} onValueChange={onWeightChange} onSaveError={onSaveError} />
      </View>
    </View>
  );
}

type SetBlockProps = {
  set: NormalSetRow;
  /** The set with the same number from the last workout on this variation, if there was one. */
  last: { reps: number | null; weight: number | null } | null;
  focusId: string | null;
  onSaveError: (retry: () => Promise<void>) => void;
  onAddIntensifier: () => void;
  onRemove: () => void;
  onRemoveIntensifier: (i: IntensifierRow) => void;
};

/** A normal set: last time's numbers beside its name, its fields, then its intensifier rows. */
function SetBlock({ set, last, focusId, onSaveError, onAddIntensifier, onRemove, onRemoveIntensifier }: SetBlockProps) {
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
  // Tracked here, in the display unit, so partial-reps rows show the parent weight as it is typed.
  const [parentWeight, setParentWeight] = useState(set.weight === null ? null : toDisplayWeight(set.weight, unit));

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[styles.bodyStrong, { flex: 1, fontSize: 16 }]}>Set {set.number}</Text>
        {last ? (
          <Text style={[styles.small, styles.number]}>
            Last {last.reps ?? '—'} × {formatWeight(last.weight, unit)} {unit}
          </Text>
        ) : null}
      </View>
      <FieldPair
        setId={set.setId}
        reps={set.reps}
        weight={set.weight}
        autoFocus={focusId === set.setId}
        onWeightChange={setParentWeight}
        onSaveError={onSaveError}
      />
      {set.intensifiers.map((i) => {
        const color = intensifierColor(i.type, colors);
        const label = i.type === 'drop' ? 'Drop set' : i.type === 'partial' ? 'Partial reps' : `Superset: ${i.partnerLabel}`;
        return (
          <View key={i.intensifierId} style={[{ marginLeft: 12, paddingLeft: 12, gap: 6 }, edge(color)]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.bodyStrong, { color, flex: 1 }]} numberOfLines={1}>
                {label}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${label}`}
                onPress={() => onRemoveIntensifier(i)}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={18} color={colors.faint} />
              </Pressable>
            </View>
            {i.type === 'partial' ? (
              // Partial reps have no weight field: they use the parent set's weight.
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.label}>Reps</Text>
                  <SetField
                    setId={i.childSetId}
                    field="reps"
                    initial={i.reps}
                    autoFocus={focusId === i.childSetId}
                    onSaveError={onSaveError}
                  />
                </View>
                <View style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                  <Text style={[styles.muted, styles.number]}>
                    at {parentWeight === null ? '—' : formatNumber(parentWeight)} {unit}
                  </Text>
                </View>
              </View>
            ) : (
              <FieldPair
                setId={i.childSetId}
                reps={i.reps}
                weight={i.weight}
                autoFocus={focusId === i.childSetId}
                onSaveError={onSaveError}
              />
            )}
          </View>
        );
      })}
      <View style={[styles.buttonRow, { justifyContent: 'space-between' }]}>
        <Button label="Intensifier" icon="add" variant="link" compact onPress={onAddIntensifier} />
        <Button label="Remove set" icon="trash-outline" variant="quiet" compact onPress={onRemove} />
      </View>
    </View>
  );
}

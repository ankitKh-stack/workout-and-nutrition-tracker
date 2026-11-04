import { Text, View } from 'react-native';

import type { NormalSetRow } from '@/data/repository';
import { formatWeight } from '@/lib/format';
import { useSettings, useTheme } from '@/theme/settings';

/**
 * Read-only lines for logged sets: "Set 1 · 10 × 60 kg", each followed by its
 * intensifier rows with their kind's colour edge. Used by exercise history
 * and the History tab's workout screen.
 */
export function SetLines({ sets }: { sets: NormalSetRow[] }) {
  const { styles, colors } = useTheme();
  const { unit } = useSettings();

  const w = (kg: number | null) => `${formatWeight(kg, unit)} ${unit}`;
  const line = (label: string, value: string, color?: string, indent = false) => (
    <View
      key={label + value}
      style={[
        { flexDirection: 'row', alignItems: 'baseline', minHeight: 28 },
        indent && { marginLeft: 12, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: color },
      ]}
    >
      <Text style={[indent ? styles.muted : styles.bodyStrong, { flex: 1 }, indent && color ? { color } : null]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[indent ? styles.muted : styles.body, styles.number]}>{value}</Text>
    </View>
  );

  return (
    <>
      {sets.map((s) => (
        <View key={s.setId} style={{ gap: 2 }}>
          {line(`Set ${s.number}`, `${s.reps ?? '—'} × ${w(s.weight)}`)}
          {s.intensifiers.map((i) =>
            i.type === 'drop'
              ? line('Drop set', `${i.reps ?? '—'} × ${w(i.weight)}`, colors.kinds.drop, true)
              : i.type === 'partial'
                ? line('Partial reps', `${i.reps ?? '—'} at ${w(s.weight)}`, colors.kinds.partial, true)
                : line(`Superset: ${i.partnerLabel}`, `${i.reps ?? '—'} × ${w(i.weight)}`, colors.kinds.superset, true),
          )}
        </View>
      ))}
    </>
  );
}

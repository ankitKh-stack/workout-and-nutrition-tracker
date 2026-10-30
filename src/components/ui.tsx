// Plain building blocks for the list-based screens. Colours come from the
// active theme (light or dark); see src/theme.
import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDayHeading } from '@/lib/format';
import { useTheme } from '@/theme/settings';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'secondary', disabled, style, compact }: ButtonProps) {
  const { styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'link' && styles.buttonLink,
        disabled && styles.buttonDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          (variant === 'primary' || variant === 'danger') && styles.buttonTextOnColor,
          variant === 'link' && styles.buttonTextLink,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Small coloured label above the title, e.g. "IN PROGRESS". */
  badge?: { label: string; color: string };
};

export function ListRow({ title, subtitle, onPress, right, disabled, style, badge }: ListRowProps) {
  const { styles } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.buttonDisabled, style]}
    >
      <View style={styles.rowText}>
        {badge ? <Text style={[styles.eyebrow, { color: badge.color }]}>{badge.label}</Text> : null}
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { invalid?: boolean }) {
  const { styles, colors } = useTheme();
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...rest}
      style={[styles.field, invalid && styles.fieldInvalid, style]}
    />
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { styles } = useTheme();
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{message}</Text>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  const { styles } = useTheme();
  return <Text style={styles.empty}>{children}</Text>;
}

export function InlineError({ children }: { children: ReactNode }) {
  const { styles } = useTheme();
  return <Text style={styles.inlineError}>{children}</Text>;
}

/** Pill toggle in the style of the reference screenshots ("Consumed | Remaining"). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const { styles } = useTheme();
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Large page title with today's date above it, used on tab root screens. */
export function LargeHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { styles } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 4 }}>
      <Text style={styles.eyebrow}>{formatDayHeading(new Date())}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[styles.largeTitle, { flex: 1 }]}>{title}</Text>
        {right}
      </View>
    </View>
  );
}

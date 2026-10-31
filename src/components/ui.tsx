// Plain building blocks for the list-based screens. Colours and type come
// from the active theme (see src/theme).
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEnsureVisible } from '@/components/KeyboardAwareScroll';
import type { DragHandlers } from '@/components/ReorderableList';
import { formatDayHeading } from '@/lib/format';
import { fonts } from '@/theme/palette';
import { useTheme } from '@/theme/settings';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** primary: the screen's one main action, an inverted pill. danger: outlined in the negative colour. quiet: a grey text action. */
  variant?: 'primary' | 'secondary' | 'danger' | 'link' | 'quiet';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'secondary', icon, disabled, style, compact }: ButtonProps) {
  const { styles, colors } = useTheme();
  const textColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.negative
        : variant === 'quiet'
          ? colors.muted
          : colors.text;
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
        (variant === 'link' || variant === 'quiet') && styles.buttonLink,
        disabled && styles.buttonDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={textColor} /> : null}
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' && styles.buttonTextPrimary,
            variant === 'danger' && styles.buttonTextDanger,
            variant === 'quiet' && { color: colors.muted, fontFamily: fonts.medium },
            compact && { fontSize: 14 },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** A line in the data hue under the title, e.g. "In progress · started 16:55". */
  status?: string;
  onPress?: () => void;
  right?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Lifted for dragging: outlined so it stands out from the rows around it. */
  lifted?: boolean;
} & Partial<DragHandlers>;

export function ListRow({ title, subtitle, status, onPress, right, disabled, style, lifted, ...drag }: ListRowProps) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={disabled || (!onPress && !drag.onLongPress)}
      {...drag}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress && styles.pressed,
        disabled && styles.buttonDisabled,
        style,
        lifted && { borderWidth: 1.5, borderColor: colors.text, opacity: 1 },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {status ? <Text style={[styles.rowSubtitle, { color: colors.accent }]}>{status}</Text> : null}
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

/** A trailing chevron for rows that open another screen. */
export function Chevron() {
  const { colors } = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={colors.faint} />;
}

export function Field(props: TextInputProps & { invalid?: boolean }) {
  const { styles, colors } = useTheme();
  const { invalid, style, onFocus, ...rest } = props;
  const ensureVisible = useEnsureVisible();
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...rest}
      onFocus={(e) => {
        onFocus?.(e);
        // Inside a KeyboardAwareScroll, bring this field above the keyboard.
        ensureVisible();
      }}
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

/** Pill toggle; the selected option is an inverted pill, as in the reference screenshots. */
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

/** The screen's title (its h1) on tab root screens, with today's date in a grey line under it. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { styles } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 4, flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>
        <Text role="heading" aria-level={1} style={styles.pageTitle}>
          {title}
        </Text>
        <Text style={styles.pageSubtitle}>{subtitle ?? formatDayHeading(new Date())}</Text>
      </View>
      {right}
    </View>
  );
}

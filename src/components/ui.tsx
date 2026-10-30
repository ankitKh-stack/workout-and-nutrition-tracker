// Plain building blocks for the list-based screens. Styling is deliberately
// minimal: the prototype proves behaviour, not visual design (SPEC.md 8).
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

export const colors = {
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  background: '#ffffff',
  surface: '#f9fafb',
  primary: '#2563eb',
  danger: '#dc2626',
  success: '#15803d',
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'secondary', disabled, style, compact }: ButtonProps) {
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
};

export function ListRow({ title, subtitle, onPress, right, disabled }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.buttonDisabled]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { invalid?: boolean }) {
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
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{message}</Text>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function InlineError({ children }: { children: ReactNode }) {
  return <Text style={styles.inlineError}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  buttonCompact: { paddingVertical: 6, paddingHorizontal: 10 },
  buttonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  buttonLink: { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 4 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  buttonTextOnColor: { color: '#ffffff' },
  buttonTextLink: { color: colors.primary },
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 8,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.muted },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  fieldInvalid: { borderColor: colors.danger },
  errorText: { fontSize: 15, color: colors.text, textAlign: 'center' },
  empty: { fontSize: 15, color: colors.muted, paddingVertical: 12 },
  inlineError: { fontSize: 13, color: colors.danger },
  muted: { fontSize: 14, color: colors.muted },
  body: { fontSize: 15, color: colors.text },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  buttonRow: { flexDirection: 'row', gap: 8 },
});

import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Field, InlineError } from '@/components/ui';
import { updateSetField } from '@/data/repository';
import { parseReps, parseWeight } from '@/lib/format';
import { enqueueWrite } from '@/lib/writeQueue';

const SAVE_DELAY_MS = 500;

type Props = {
  setId: string;
  field: 'reps' | 'weight';
  initial: number | null;
  autoFocus?: boolean;
  /** Called with every valid value as the user types (used to show a parent weight on partial rows). */
  onValueChange?: (value: number | null) => void;
  /** Called when a write fails, with a function that retries it. */
  onSaveError: (retry: () => Promise<void>) => void;
};

/**
 * A reps or weight input that saves itself: within 500 ms of the last
 * keystroke, on blur, and on unmount, so a restart at any moment keeps what
 * was typed (SPEC.md 3.5, 6). Invalid values are shown but never saved.
 */
export function SetField({ setId, field, initial, autoFocus, onValueChange, onSaveError }: Props) {
  const db = useSQLiteContext();
  const [text, setText] = useState(initial === null ? '' : String(initial));
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ value: number | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const write = () => enqueueWrite(() => updateSetField(db, setId, field, p.value));
    write().catch(() => onSaveError(write));
  };

  // Save anything still pending when the row goes away.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  function onChangeText(t: string) {
    setText(t);
    const parsed = field === 'reps' ? parseReps(t) : parseWeight(t);
    if (!parsed.ok) {
      setError(parsed.message);
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    setError(null);
    onValueChange?.(parsed.value);
    pending.current = { value: parsed.value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Field
        value={text}
        onChangeText={onChangeText}
        onBlur={flush}
        placeholder={field === 'reps' ? 'Reps' : 'kg'}
        keyboardType={field === 'reps' ? 'number-pad' : 'decimal-pad'}
        autoFocus={autoFocus}
        invalid={!!error}
        accessibilityLabel={field === 'reps' ? 'Reps' : 'Weight in kg'}
        style={{ paddingVertical: 8 }}
      />
      {error ? <InlineError>{error}</InlineError> : null}
    </View>
  );
}

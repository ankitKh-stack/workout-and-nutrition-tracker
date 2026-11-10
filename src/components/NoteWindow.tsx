import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { NOTE_MAX_LENGTH } from '@/data/repository';
import { confirmAsync } from '@/lib/dialogs';
import { useTheme } from '@/theme/settings';

/** The counter shows from here on, so it doesn't distract while typing a short note. */
const COUNTER_FROM = 450;

type Props = {
  /** Shown as the window's title, e.g. the variation name. */
  title: string;
  /** The saved note, or null when there is none. */
  note: string | null;
  /** Open straight into editing (Write). */
  startEditing: boolean;
  /** Saves the trimmed text; '' removes the note. Rejects when saving fails. */
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
};

/**
 * A small window over the screen for a variation's note: read it, tap the pen
 * to edit, and Save. Nothing is saved without Save, and unsaved changes are
 * only thrown away after "Discard changes?". Render it only while open, so
 * each opening starts fresh from the saved note.
 */
export function NoteWindow({ title, note, startEditing, onSave, onClose }: Props) {
  const { styles, colors } = useTheme();
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<ComponentRef<typeof View>>(null);
  const [keyboard, measureKeyboard] = useKeyboardOverlap(frame);

  // Compared trimmed, the way Save stores it, so stray spaces aren't an unsaved change.
  const dirty = editing && draft.trim() !== (note ?? '');

  /** Asks before throwing away unsaved changes; true when it is fine to leave. */
  async function mayLeave() {
    if (!dirty) return true;
    return confirmAsync('Discard changes?', 'Your changes to this note will be lost.', 'Discard', true);
  }

  async function close() {
    if (saving) return; // Let the save finish, so a failure is shown rather than lost.
    if (await mayLeave()) onClose();
  }

  async function cancel() {
    if (!(await mayLeave())) return;
    if (note === null) {
      onClose();
    } else {
      setDraft(note);
      setEditing(false);
    }
  }

  async function save() {
    const text = draft.trim();
    setSaving(true);
    setError(null);
    try {
      await onSave(text);
      if (text === '') {
        onClose();
      } else {
        setDraft(text);
        setEditing(false);
      }
    } catch {
      setError('Could not save the note. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View
        ref={frame}
        onLayout={measureKeyboard}
        style={{ flex: 1, justifyContent: 'center', padding: 16, paddingBottom: 16 + keyboard }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close note"
          onPress={close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        <View accessibilityViewIsModal style={[styles.card, { width: '100%', maxWidth: 420, maxHeight: '100%', alignSelf: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.label}>Note</Text>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
            {editing ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit note"
                onPress={() => setEditing(true)}
                hitSlop={8}
                style={({ pressed }) => [{ padding: 8 }, pressed && styles.pressed]}
              >
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </Pressable>
            )}
          </View>

          {editing ? (
            <>
              <TextInput
                accessibilityLabel={`Note for ${title}`}
                value={draft}
                onChangeText={setDraft}
                multiline
                autoFocus
                maxLength={NOTE_MAX_LENGTH}
                placeholder="Bench height, seat position, grip…"
                placeholderTextColor={colors.faint}
                textAlignVertical="top"
                style={[styles.field, { minHeight: 120, maxHeight: 240, fontFamily: styles.body.fontFamily }]}
              />
              {draft.length >= COUNTER_FROM ? (
                <Text style={[styles.small, styles.number, { alignSelf: 'flex-end' }]}>
                  {draft.length}/{NOTE_MAX_LENGTH}
                </Text>
              ) : null}
              {error ? <Text style={styles.inlineError}>{error}</Text> : null}
              <View style={[styles.buttonRow, { justifyContent: 'flex-end' }]}>
                <Button label="Cancel" variant="quiet" compact onPress={cancel} />
                <Button label="Save" variant="primary" compact disabled={saving} onPress={save} />
              </View>
            </>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={styles.body} selectable>
                {note}
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * How much of the window the on-screen keyboard covers (0 when hidden), so the
 * window can be padded to keep the box and Save above it. Measured rather than
 * taken as the keyboard's height: whether a popup's window shrinks for the
 * keyboard depends on the Android version and edge-to-edge drawing, and when it
 * does shrink the overlap is simply 0. Starts from a keyboard that was already
 * open (e.g. from a set field), which fires no "show" event. Call the returned
 * function from the frame's onLayout.
 */
function useKeyboardOverlap(frame: React.RefObject<ComponentRef<typeof View> | null>): [number, () => void] {
  // Keyboard.metrics is missing on web, where there is no on-screen keyboard to track.
  const keyboardTop = useRef<number | null>(
    typeof Keyboard.metrics === 'function' ? (Keyboard.metrics()?.screenY ?? null) : null,
  );
  const [overlap, setOverlap] = useState(0);

  const measure = () => {
    const top = keyboardTop.current;
    if (top === null) return setOverlap(0);
    frame.current?.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, y + h - top)));
  };

  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardDidShow', (e) => {
        keyboardTop.current = e.endCoordinates.screenY;
        measure();
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
        setOverlap(0);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
    // measure only reads refs, so subscribing once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [overlap, measure];
}

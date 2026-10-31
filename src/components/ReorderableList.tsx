import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';

/** Spread onto the row's Pressable (ListRow accepts all of these). */
export type DragHandlers = {
  onLongPress: () => void;
  onPressOut: () => void;
  delayLongPress: number;
  accessibilityHint: string;
  accessibilityActions: AccessibilityActionInfo[];
  onAccessibilityAction: (e: AccessibilityActionEvent) => void;
};

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, drag: { handlers: DragHandlers; active: boolean }) => ReactNode;
  /** Called with every key in the new order after a move. */
  onReorder: (keys: string[]) => void;
  /** True while a row is being dragged; the screen turns off scrolling meanwhile. */
  onDragChange?: (dragging: boolean) => void;
  gap?: number;
  /** Turns dragging off, e.g. while the screen is in remove mode. */
  disabled?: boolean;
};

type Layout = { y: number; height: number };

const move = (keys: string[], from: number, to: number) => {
  const next = keys.slice();
  const [key] = next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
};

/**
 * A vertical list whose rows can be held and dragged into a new order. Built
 * on React Native's own PanResponder and Animated, so it works in Expo Go.
 *
 * Holding a row (long press) picks it up; moving the finger drags it while
 * the other rows slide out of its way; letting go drops it there. Screen
 * readers get "Move up" and "Move down" actions on each row instead.
 */
export function ReorderableList<T>({ items, keyOf, renderItem, onReorder, onDragChange, gap = 12, disabled }: Props<T>) {
  // The order just dropped, shown until the saved order comes back in `items`.
  const [pending, setPending] = useState<string[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  useEffect(() => setPending(null), [items]);

  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const keys = pending && pending.length === items.length && pending.every((k) => byKey.has(k)) ? pending : items.map(keyOf);

  const keysRef = useRef(keys);
  keysRef.current = keys;
  const layouts = useRef(new Map<string, Layout>());
  const offsets = useRef(new Map<string, Animated.Value>());
  const dy = useRef(new Animated.Value(0)).current;
  const active = useRef<string | null>(null);
  const target = useRef(0);
  const granted = useRef(false);
  const callbacks = useRef({ onReorder, onDragChange, gap });
  callbacks.current = { onReorder, onDragChange, gap };

  const offsetOf = (key: string) => {
    let value = offsets.current.get(key);
    if (!value) {
      value = new Animated.Value(0);
      offsets.current.set(key, value);
    }
    return value;
  };

  const commit = (next: string[]) => {
    setPending(next);
    callbacks.current.onReorder(next);
  };

  const end = () => {
    const key = active.current;
    if (key === null) return;
    const from = keysRef.current.indexOf(key);
    const to = target.current;
    active.current = null;
    granted.current = false;
    dy.setValue(0);
    offsets.current.forEach((v) => v.setValue(0));
    setActiveKey(null);
    callbacks.current.onDragChange?.(false);
    if (from !== -1 && from !== to) commit(move(keysRef.current, from, to));
  };

  // Slides the other rows out of the way of the dragged one.
  const follow = (moved: number) => {
    const key = active.current;
    const list = keysRef.current;
    const from = key === null ? -1 : list.indexOf(key);
    const own = key === null ? undefined : layouts.current.get(key);
    if (from === -1 || !own) return;
    const centre = own.y + own.height / 2 + moved;
    let to = 0;
    list.forEach((k, i) => {
      const l = layouts.current.get(k);
      if (i !== from && l && l.y + l.height / 2 < centre) to++;
    });
    if (to === target.current) return;
    target.current = to;
    const step = own.height + callbacks.current.gap;
    list.forEach((k, i) => {
      if (i === from) return;
      const shift = from < i && i <= to ? -step : to <= i && i < from ? step : 0;
      Animated.timing(offsetOf(k), { toValue: shift, duration: 150, useNativeDriver: false }).start();
    });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only takes the touch over once a row has been picked up by a long press.
        onMoveShouldSetPanResponderCapture: () => active.current !== null,
        onMoveShouldSetPanResponder: () => active.current !== null,
        onPanResponderGrant: () => {
          granted.current = true;
        },
        onPanResponderMove: (_e, g) => {
          dy.setValue(g.dy);
          follow(g.dy);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: end,
        onPanResponderTerminate: end,
      }),
    // Created once: follow and end read everything through refs.
    [],
  );

  const handlersFor = (key: string, index: number): DragHandlers => ({
    delayLongPress: 300,
    onLongPress: () => {
      if (disabled) return;
      active.current = key;
      target.current = index;
      granted.current = false;
      dy.setValue(0);
      setActiveKey(key);
      callbacks.current.onDragChange?.(true);
    },
    onPressOut: () => {
      // Let go without moving: put the row back. When the finger moved, the
      // drag took over the touch and finishes on release instead. Checked a
      // tick later because the press ends just before the drag begins.
      setTimeout(() => {
        if (!granted.current) end();
      }, 0);
    },
    accessibilityHint: disabled ? '' : 'Touch and hold, then drag to reorder',
    accessibilityActions: disabled
      ? []
      : [
          ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
          ...(index < keys.length - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
        ],
    onAccessibilityAction: (e) => {
      const to = e.nativeEvent.actionName === 'moveUp' ? index - 1 : e.nativeEvent.actionName === 'moveDown' ? index + 1 : index;
      if (to !== index && to >= 0 && to < keys.length) commit(move(keys, index, to));
    },
  });

  return (
    <View {...responder.panHandlers} style={{ gap }}>
      {keys.map((key, index) => {
        const isActive = key === activeKey;
        return (
          <Animated.View
            key={key}
            onLayout={(e) => layouts.current.set(key, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })}
            style={{
              zIndex: isActive ? 10 : 0,
              elevation: isActive ? 8 : 0,
              transform: [{ translateY: isActive ? dy : offsetOf(key) }, { scale: isActive ? 1.02 : 1 }],
            }}
          >
            {renderItem(byKey.get(key)!, { handlers: handlersFor(key, index), active: isActive })}
          </Animated.View>
        );
      })}
    </View>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

import { useRestBarHeight } from '@/lib/restTimer';

/** Space kept between the focused field and the top of the keyboard. */
const MARGIN = 24;

type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

const EnsureVisibleContext = createContext<{ ensureVisible: () => void; reveal: (node: Measurable | null) => void }>({
  ensureVisible: () => {},
  reveal: () => {},
});

/** Called by fields when they gain focus, so the screen scrolls them above the keyboard. */
export const useEnsureVisible = () => useContext(EnsureVisibleContext).ensureVisible;

/** Scrolls a view (e.g. a menu that just opened) into the space above the keyboard, when it is open. */
export const useRevealAboveKeyboard = () => useContext(EnsureVisibleContext).reveal;

/**
 * A ScrollView that keeps the focused field above the on-screen keyboard.
 *
 * Android apps are drawn edge to edge, so the window no longer shrinks when the
 * keyboard opens and fields near the bottom end up behind it. While the
 * keyboard is open this adds its height as extra space at the end of the
 * content (so everything can be scrolled into view), and scrolls the focused
 * field to just above the keyboard. It uses React Native's own keyboard events,
 * so it also works in Expo Go.
 */
export function KeyboardAwareScroll({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsetY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // The rest timer bar sits just above the keyboard, so fields must clear it too.
  const barHeight = useRestBarHeight();
  const barRef = useRef(barHeight);
  barRef.current = barHeight;

  /**
   * Scrolls so the view sits between the top of the scroll area and the keyboard
   * (and the rest bar above it): down when it is behind the keyboard, up when it
   * is above the visible area, e.g. a warm-up set just added at the top.
   */
  const reveal = useCallback((node: Measurable | null) => {
    // Wait a frame so the layout (and the extra space) is in place before measuring.
    requestAnimationFrame(() => {
      const top = keyboardTop.current;
      if (top === null || !node) return;
      node.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + MARGIN + barRef.current - top;
        if (overlap > 0) return scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
        (scrollRef.current as unknown as Measurable | null)?.measureInWindow((_sx, scrollTop) => {
          const above = scrollTop + MARGIN - y;
          if (above > 0) scrollRef.current?.scrollTo({ y: Math.max(0, offsetY.current - above), animated: true });
        });
      });
    });
  }, []);

  const ensureVisible = useCallback(() => {
    // No keyboard open: nothing to do. Checked first because on web there is
    // never a keyboard event, and react-native-web's TextInput.State has no
    // currentlyFocusedInput().
    if (keyboardTop.current === null) return;
    reveal(TextInput.State.currentlyFocusedInput() ?? null);
  }, [reveal]);

  const context = useMemo(() => ({ ensureVisible, reveal }), [ensureVisible, reveal]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      // The keyboard's top edge on screen; fall back to window height minus its height.
      keyboardTop.current = e.endCoordinates.screenY || Dimensions.get('window').height - e.endCoordinates.height;
      setKeyboardHeight(e.endCoordinates.height);
      ensureVisible();
    };
    const onHide = () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
      // On Android, Back closes the keyboard but leaves the field focused, so the
      // field never "loses focus" (no save-on-blur, no rest prompt). Blur it here.
      if (Platform.OS === 'android') TextInput.State.currentlyFocusedInput()?.blur();
    };
    const subs = [Keyboard.addListener(showEvent, onShow), Keyboard.addListener(hideEvent, onHide)];
    return () => subs.forEach((s) => s.remove());
  }, [ensureVisible]);

  // The bar can appear (a rest prompt) after a field was scrolled into view: scroll again.
  useEffect(() => {
    if (barHeight > 0) ensureVisible();
  }, [barHeight, ensureVisible]);

  return (
    <EnsureVisibleContext.Provider value={context}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          offsetY.current = e.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: 16 + keyboardHeight + (keyboardHeight > 0 ? barHeight : 0) }]}
        {...rest}
      >
        {children}
      </ScrollView>
    </EnsureVisibleContext.Provider>
  );
}

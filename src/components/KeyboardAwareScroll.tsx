import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
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

/** Space kept between the focused field and the top of the keyboard. */
const MARGIN = 24;

const EnsureVisibleContext = createContext<() => void>(() => {});

/** Called by fields when they gain focus, so the screen scrolls them above the keyboard. */
export const useEnsureVisible = () => useContext(EnsureVisibleContext);

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

  const ensureVisible = useCallback(() => {
    // Wait a frame so the layout (and the extra space) is in place before measuring.
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const top = keyboardTop.current;
      if (!input || top === null) return;
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + MARGIN - top;
        if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
      });
    });
  }, []);

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
    };
    const subs = [Keyboard.addListener(showEvent, onShow), Keyboard.addListener(hideEvent, onHide)];
    return () => subs.forEach((s) => s.remove());
  }, [ensureVisible]);

  return (
    <EnsureVisibleContext.Provider value={ensureVisible}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          offsetY.current = e.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: 16 + keyboardHeight }]}
        {...rest}
      >
        {children}
      </ScrollView>
    </EnsureVisibleContext.Provider>
  );
}

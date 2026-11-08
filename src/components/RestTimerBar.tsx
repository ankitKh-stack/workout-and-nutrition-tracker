import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { formatClock, remainingSeconds } from '@/domain/restTimer';
import { useRestTimer } from '@/lib/restTimer';
import { useSettings, useTheme } from '@/theme/settings';

/**
 * The rest timer's bar at the bottom of the logging and day screens: the
 * "Start rest?" prompt, the countdown, or "Rest over". Shows only what belongs
 * to this screen's day.
 */
export function RestTimerBar({ dayId }: { dayId: string }) {
  const { styles, colors } = useTheme();
  const { restSeconds } = useSettings();
  const { prompt, countdown, over, start, dismiss, adjust, skip, reportBarHeight } = useRestTimer();
  const lift = useKeyboardLift();

  // Re-render every second while counting down; the time is always read from the clock.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!countdown) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const mine = <T extends { owner: { dayId: string } }>(x: T | null) => (x && x.owner.dayId === dayId ? x : null);
  const shownPrompt = mine(prompt);
  const shownCountdown = mine(countdown);
  const shownOver = mine(over);

  let content = null;
  if (shownPrompt) {
    content = (
      <>
        <Text style={[styles.bodyStrong, { flex: 1 }]}>
          Set {shownPrompt.setNumber} done · {shownCountdown ? 'Restart rest?' : `Start ${formatClock(restSeconds)} rest?`}
        </Text>
        <Button label="Start" variant="primary" compact onPress={start} />
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={dismiss} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="close" size={20} color={colors.faint} />
        </Pressable>
      </>
    );
  } else if (shownCountdown) {
    content = (
      <>
        <Text style={[styles.title, styles.number, { flex: 1 }]} accessibilityLiveRegion="polite">
          Rest {formatClock(remainingSeconds(shownCountdown, Date.now()))}
        </Text>
        <Button label="−15s" compact onPress={() => adjust(-15)} />
        <Button label="+15s" compact onPress={() => adjust(15)} />
        <Button label="Skip" variant="quiet" compact onPress={skip} />
      </>
    );
  } else if (shownOver) {
    content = <Text style={[styles.title, { flex: 1, color: colors.accent }]}>Rest over</Text>;
  }

  return (
    <View
      ref={lift.ref}
      onLayout={(e) => {
        lift.onLayout();
        reportBarHeight(e.nativeEvent.layout.height);
      }}
      style={{ transform: [{ translateY: -lift.offset }] }}
    >
      {content ? (
        <View
          style={[
            styles.card,
            { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingVertical: 10 },
          ]}
        >
          {content}
        </View>
      ) : null}
    </View>
  );
}

/**
 * How far to raise the bar so the on-screen keyboard doesn't cover it. Android
 * apps draw edge to edge, so the keyboard covers the bottom of the screen, and
 * the prompt often appears while the keyboard is still open.
 */
function useKeyboardLift() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const keyboardTop = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);

  const measure = () => {
    const top = keyboardTop.current;
    if (top === null) return;
    ref.current?.measureInWindow((_x, y, _w, h) => {
      // measureInWindow includes the current lift, so add it back to get the resting position.
      const next = Math.max(0, y + offsetRef.current + h - top);
      offsetRef.current = next;
      setOffset(next);
    });
  };

  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardDidShow', (e) => {
        keyboardTop.current = e.endCoordinates.screenY;
        measure();
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
        offsetRef.current = 0;
        setOffset(0);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return { ref, offset, onLayout: measure };
}

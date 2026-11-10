import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Vibration } from 'react-native';

import { adjustCountdown, remainingSeconds, startCountdown, type Countdown } from '@/domain/restTimer';
import { cancelRestAlert, ensureRestAlertsAllowed, scheduleRestAlert } from '@/lib/restAlert';
import { useSettings } from '@/theme/settings';

/** The workout a prompt or countdown belongs to. */
export type RestOwner = { dayId: string; workoutId: string };

type RestTimerValue = {
  /** "Set {setNumber} done": shown for 10 s after a set is done. */
  prompt: { setNumber: number; owner: RestOwner } | null;
  countdown: (Countdown & { owner: RestOwner }) | null;
  /** True for 5 s after a countdown ends ("Rest over"). */
  over: { owner: RestOwner } | null;
  /** Whether rest alerts may notify; null until first asked (and always on web). */
  alertsAllowed: boolean | null;
  offer: (owner: RestOwner, setNumber: number) => void;
  start: () => void;
  /** Starts the rest right away, without the prompt (Fill from last time). */
  startNow: (owner: RestOwner) => void;
  dismiss: () => void;
  adjust: (deltaSeconds: 15 | -15) => void;
  skip: () => void;
  /** Clears the prompt and countdown, and cancels the alert, when they belong to this day or workout. */
  cancelFor: (match: { dayId?: string; workoutId?: string }) => void;
  /** Height of the bar on screen (0 when empty), so fields can be scrolled clear of it. */
  barHeight: number;
  reportBarHeight: (height: number) => void;
};

const PROMPT_MS = 10_000;
const OVER_MS = 5_000;
const VIBRATION: number[] = [0, 400, 200, 400];

const RestTimerContext = createContext<RestTimerValue | null>(null);

const matches = (owner: RestOwner, m: { dayId?: string; workoutId?: string }) =>
  owner.dayId === m.dayId || owner.workoutId === m.workoutId;

/**
 * The rest timer for the whole app (SPEC.md 3.5): the "Start timer?" prompt,
 * the one running countdown and its scheduled alert. It lives above the
 * screens, so the countdown keeps going when moving between them.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const { restSeconds } = useSettings();
  const [prompt, setPrompt] = useState<RestTimerValue['prompt']>(null);
  const [countdown, setCountdownState] = useState<RestTimerValue['countdown']>(null);
  const [over, setOver] = useState<RestTimerValue['over']>(null);
  const [alertsAllowed, setAlertsAllowed] = useState<boolean | null>(null);
  const [barHeight, setBarHeight] = useState(0);

  // The latest countdown, read by the alert queue when it runs.
  const latest = useRef<RestTimerValue['countdown']>(null);
  const alertId = useRef<string | null>(null);
  const asked = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  /**
   * Makes the scheduled alert match the latest countdown. Runs one at a time,
   * so quick taps never leave an old alert scheduled.
   */
  const syncAlert = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (latest.current && !asked.current && Platform.OS !== 'web') {
        asked.current = true;
        setAlertsAllowed(await ensureRestAlertsAllowed());
      }
      await cancelRestAlert(alertId.current);
      alertId.current = null;
      if (latest.current) alertId.current = await scheduleRestAlert(remainingSeconds(latest.current, Date.now()));
    });
  }, []);

  const setCountdown = useCallback(
    (c: RestTimerValue['countdown']) => {
      latest.current = c;
      setCountdownState(c);
      syncAlert();
    },
    [syncAlert],
  );

  // A prompt goes away on its own.
  useEffect(() => {
    if (!prompt) return;
    const t = setTimeout(() => setPrompt(null), PROMPT_MS);
    return () => clearTimeout(t);
  }, [prompt]);

  // At 0:00: the scheduled notification alerts by itself; the bar shows "Rest over".
  useEffect(() => {
    if (!countdown) return;
    const t = setTimeout(() => {
      // Without notification permission, vibrate in the app, but not when coming back much later.
      if (alertsAllowed === false && Date.now() - countdown.endsAt < OVER_MS) Vibration.vibrate(VIBRATION);
      alertId.current = null;
      latest.current = null;
      setCountdownState(null);
      setOver({ owner: countdown.owner });
    }, Math.max(0, countdown.endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [countdown, alertsAllowed]);

  useEffect(() => {
    if (!over) return;
    const t = setTimeout(() => setOver(null), OVER_MS);
    return () => clearTimeout(t);
  }, [over]);

  const value = useMemo<RestTimerValue>(() => {
    const startNow = (owner: RestOwner) => {
      setPrompt(null);
      setOver(null);
      setCountdown({ ...startCountdown(Date.now(), restSeconds), owner });
    };
    return {
      prompt,
      countdown,
      over,
      alertsAllowed,
      offer: (owner, setNumber) => {
        setOver(null);
        setPrompt({ setNumber, owner });
      },
      start: () => {
        if (prompt) startNow(prompt.owner);
      },
      startNow,
      dismiss: () => setPrompt(null),
      adjust: (delta) => {
        // From the latest countdown, not this render's copy, so quick taps all count.
        const c = latest.current;
        if (c) setCountdown({ ...adjustCountdown(c, delta, Date.now()), owner: c.owner });
      },
      skip: () => setCountdown(null),
      cancelFor: (match) => {
        setPrompt((p) => (p && matches(p.owner, match) ? null : p));
        setOver((o) => (o && matches(o.owner, match) ? null : o));
        if (latest.current && matches(latest.current.owner, match)) setCountdown(null);
      },
      barHeight,
      reportBarHeight: setBarHeight,
    };
  }, [prompt, countdown, over, alertsAllowed, restSeconds, setCountdown, barHeight]);

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

/**
 * Height of the rest timer bar, for KeyboardAwareScroll: with the keyboard
 * open the bar sits just above it, so a field must clear the bar too.
 */
export function useRestBarHeight(): number {
  return useContext(RestTimerContext)?.barHeight ?? 0;
}

export function useRestTimer(): RestTimerValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used inside RestTimerProvider');
  return ctx;
}

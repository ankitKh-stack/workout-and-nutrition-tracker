# Rest Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a set is done, offer a rest countdown in a bar at the bottom of the screen. When the countdown ends, alert with vibration and sound, even when the phone is locked.

**Architecture:**
- **Timer maths and the "should we offer rest?" rule** are pure functions in `src/domain/restTimer.ts`, tested in plain Node.
- **The alert** is a scheduled local notification (`expo-notifications`) on a high-importance Android channel, which supplies the vibration and sound.
- **An app-wide `RestTimerProvider`** holds the prompt and the countdown. A `RestTimerBar` component shows them on the logging and day screens.
- **The default rest time** is a new key in the existing `settings` table.

**Tech Stack:** Expo SDK 58, React Native 0.88, expo-router, expo-sqlite, `expo-notifications` (new), Node test runner with node:sqlite.

**Spec:** `docs/superpowers/specs/2026-11-08-rest-timer-design.md` (approved 8 Nov 2026). The background is in `docs/PRD-workout-gaps.md` 4.1.

## Global Constraints

- **Rest length:** default rest **120 seconds**; the stepper changes it in **15-second** steps between **30** and **300** seconds.
- **±15s buttons:** the countdown never goes below 0:00.
- **Prompt copy:**
  - when nothing is running: `Set {n} done · Start {m:ss} rest?`;
  - while a countdown runs: `Set {n} done · Restart rest?`;
  - buttons **Start** and **✕**.
- **Countdown copy:** `Rest {m:ss}`, with buttons **−15s**, **+15s**, **Skip**.
- **End copy:** `Rest over` on the bar for **5 s**. The notification title is `Rest over`, with the body `Time for your next set.`
- **Timing:** the prompt hides itself after **10 s**. A prompt shown over a running countdown returns to the countdown after 10 s.
- **One countdown at a time.** Starting again replaces the old countdown and cancels its scheduled alert.
- **Android channel:**
  - id `rest-timer`, name `Rest timer`, importance HIGH;
  - vibration pattern `[0, 400, 200, 400]`;
  - the default sound, with no custom sound file.
- **Permission:** asked the first time **Start** is tapped. If it's denied, the countdown still runs, at 0:00 the phone vibrates with React Native `Vibration`, and More shows: `Notifications are off, so the rest timer can only vibrate while the app is open.`
- **Web:** never calls `expo-notifications`; every alert function is a no-op there.
- **Dependencies:** install with `npx expo install expo-notifications` only, never npm/yarn add (AGENTS.md). Before writing notification code, read `https://docs.expo.dev/versions/v58.0.0/sdk/notifications/` (AGENTS.md).
- **Not in this version:**
  - per-exercise rest;
  - a custom sound;
  - starting the countdown by itself;
  - a live lock-screen countdown.

## Review Focus

1. **A set is done, then the app reloads.** For example, coming back to the screen remounts `SetBlock`. A set that was already done when the screen loaded must not prompt again. Tests: `newlyDone` cases in Task 1, plus the preview check in Task 4.
2. **Typing a value and then clearing it, or typing an invalid one** (`abc`, `1000` reps). That set is not done and must not prompt. Test: `newlyDone` with a `null` value in Task 1.
3. **Finishing early, or the workout ending on its own, with an alert still pending.** No alert may go off later. Checks: Task 4 (finish clears the bar and cancels) and the Task 5 phone check.
4. **Tapping ±15s or Start several times quickly.** Only the latest alert may exist. Check: the Task 4 provider rule "cancel the previous alert id before scheduling a new one", plus the Task 5 phone check.
5. **The phone sleeping for longer than the rest.** On return the bar must show `Rest over`, or be hidden, never a negative time. Test: `remainingSeconds` after `endsAt` returns 0 in Task 1.

---

### Task 1: Timer maths and the rest-offer rule

**Files:**
- Create: `src/domain/restTimer.ts`
- Test: `tests/restTimer.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_REST_SECONDS = 120`, `REST_STEP_SECONDS = 15`, `MIN_REST_SECONDS = 30`, `MAX_REST_SECONDS = 300`;
  - `type Countdown = { endsAt: number }` (epoch ms);
  - `startCountdown(now: number, seconds: number): Countdown`;
  - `adjustCountdown(c: Countdown, deltaSeconds: number, now: number): Countdown`, which clamps so `endsAt >= now`;
  - `remainingSeconds(c: Countdown, now: number): number`, which rounds up and is never below 0;
  - `formatClock(seconds: number): string`, for example `"2:00"`, `"0:05"`;
  - `stepRest(current: number, direction: 1 | -1): number`, which clamps to 30–300;
  - `newlyDone(wasDone: boolean, reps: number | null, weight: number | null): boolean`, true only when not done before and both values are set;
  - `type RowKind = 'normal' | 'drop' | 'partial' | 'superset'`;
  - `offersRest(kind: RowKind, hasSuperset: boolean): boolean`, which is true for `'superset'`, true for `'normal'` only when it has no superset, and false for drop and partial.

- [ ] **Step 1: Write the failing tests** in `tests/restTimer.test.ts`:

```ts
test('a countdown counts down from the start time', () => {
  const c = startCountdown(1_000, 120);
  assert.equal(remainingSeconds(c, 1_000), 120);
  assert.equal(remainingSeconds(c, 1_000 + 500), 120); // rounds up
  assert.equal(remainingSeconds(c, 1_000 + 61_000), 59);
});
test('time left is never negative, even after a long sleep', () => {
  assert.equal(remainingSeconds(startCountdown(0, 30), 10 * 60_000), 0);
});
test('±15s changes the time left but never below zero', () => {
  const c = startCountdown(0, 120);
  assert.equal(remainingSeconds(adjustCountdown(c, 15, 0), 0), 135);
  assert.equal(remainingSeconds(adjustCountdown(startCountdown(0, 10), -15, 0), 0), 0);
});
test('clock format', () => {
  assert.equal(formatClock(120), '2:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(5), '0:05');
});
test('the rest stepper stays between 0:30 and 5:00 in 15 s steps', () => {
  assert.equal(stepRest(120, 1), 135);
  assert.equal(stepRest(30, -1), 30);
  assert.equal(stepRest(300, 1), 300);
});
test('a set counts as newly done once, and only with both values', () => {
  assert.equal(newlyDone(false, 10, 60), true);
  assert.equal(newlyDone(true, 10, 60), false); // already done when loaded, or edited
  assert.equal(newlyDone(false, 10, null), false); // weight cleared or invalid
  assert.equal(newlyDone(false, null, 60), false);
});
test('rest is offered after normal sets and superset rows, not drops or partials', () => {
  assert.equal(offersRest('normal', false), true);
  assert.equal(offersRest('normal', true), false); // waits for its superset row
  assert.equal(offersRest('superset', false), true);
  assert.equal(offersRest('drop', false), false);
  assert.equal(offersRest('partial', false), false);
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `npm test`. Expected: FAIL, because `src/domain/restTimer.ts` doesn't exist.
- [ ] **Step 3: Implement the Interfaces above in `src/domain/restTimer.ts`.** No imports, matching `progress.ts`, so it runs in plain Node.
- [ ] **Step 4: Run the tests.** Run: `npm test`. Expected: all pass (35 existing + 7 new).
- [ ] **Step 5: Commit.** `git add src/domain/restTimer.ts tests/restTimer.test.ts` with the message `Add rest timer maths and rest-offer rule`.

---

### Task 2: Remembered rest length and the More stepper

**Files:**
- Modify: `src/data/repository.ts`: `StoredSettings`, `getSettings`, `saveSetting`, around lines 1110–1130.
- Modify: `src/theme/settings.tsx`: add `restSeconds` and `setRestSeconds` to `SettingsValue`.
- Modify: `src/app/(tabs)/more/index.tsx`: a new "Rest timer" section between Units and Your data.
- Test: `tests/repository.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_REST_SECONDS`, `MIN_REST_SECONDS`, `MAX_REST_SECONDS`, `stepRest`, `formatClock` (Task 1).
- Produces:
  - `StoredSettings.restSeconds: number | null`;
  - `saveSetting(db, key: 'theme' | 'unit' | 'restSeconds', value: string)`;
  - `useSettings()` returns `restSeconds: number`, falling back to `DEFAULT_REST_SECONDS`, and `setRestSeconds(s: number): void`.

- [ ] **Step 1: Write the failing test** in `tests/repository.test.ts` (import `getSettings` and `saveSetting`):

```ts
test('the rest length is remembered, and a bad stored value is ignored', async () => {
  const db = await openTestDb();
  assert.equal((await getSettings(db)).restSeconds, null);
  await saveSetting(db, 'restSeconds', '150');
  assert.equal((await getSettings(db)).restSeconds, 150);
  await saveSetting(db, 'restSeconds', '9999');
  assert.equal((await getSettings(db)).restSeconds, null); // outside 30–300
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run: `npm test`. Expected: FAIL (`restSeconds` is undefined).
- [ ] **Step 3: Implement the setting.**
  - `getSettings` parses `restSeconds` as an integer, keeping it only within `MIN_REST_SECONDS..MAX_REST_SECONDS`, otherwise `null`.
  - Widen the `saveSetting` key type.
  - In `SettingsProvider`, add the `restSeconds` state, with `setRestSeconds` saving like `setUnit` does.
- [ ] **Step 4: Add the More card.** Use section title `Rest timer`, then a card with:
  - a row: `Rest between sets` in bodyStrong, with `Saved on this phone` under it in small;
  - on the right, `−`, `formatClock(restSeconds)` and `+` buttons. Use `Button` `compact` for − and +, with accessibility labels `Shorter rest` and `Longer rest`, using `stepRest`. Disable each button at its limit.
- [ ] **Step 5: Run the tests and typecheck.** Run: `npm test` and `npx tsc --noEmit`. Expected: all pass, and no type errors.
- [ ] **Step 6: Check in the web preview.** Open More. − and + change the value in 0:15 steps and stop at 0:30 and 5:00, and the value is still there after reloading the page.
- [ ] **Step 7: Commit** with the message `Remember the rest length and add the More stepper`.

---

### Task 3: The alert, a scheduled notification with vibration and sound

**Files:**
- Modify: `package.json`, through `npx expo install expo-notifications` only.
- Create: `src/lib/restAlert.ts`
- Modify: `src/app/_layout.tsx`: call `configureRestAlerts()` once at module level, outside the component.

**Interfaces:**
- Produces, from `src/lib/restAlert.ts`; every function is a no-op that returns `false` or `null` when `Platform.OS === 'web'`:
  - `configureRestAlerts(): void`
    - sets `Notifications.setNotificationHandler`;
    - `handleNotification` returns `{ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }`, so the alert also sounds while the app is open.
  - `ensureRestAlertsAllowed(): Promise<boolean>`
    - creates the channel first, with the Global Constraints values, through `setNotificationChannelAsync`;
    - then calls `getPermissionsAsync`, and if not granted, `requestPermissionsAsync`;
    - returns whether alerts are allowed.
  - `scheduleRestAlert(seconds: number): Promise<string | null>`
    - calls `scheduleNotificationAsync` with title `Rest over`, body `Time for your next set.`, and trigger `{ type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'rest-timer' }`;
    - returns the id, or `null` if alerts aren't allowed or `seconds < 1`.
  - `cancelRestAlert(id: string | null): Promise<void>`

- [ ] **Step 1: Read the SDK 58 notifications page** (link in Global Constraints) and confirm the exact names above still match: `SchedulableTriggerInputTypes.TIME_INTERVAL`, `channelId` on the trigger, and the `NotificationBehavior` fields. Adjust only the names if the docs differ.
- [ ] **Step 2: Install.** Run: `npx expo install expo-notifications`. Expected: it's added to `package.json` at an SDK-58-compatible version.
- [ ] **Step 3: Implement `src/lib/restAlert.ts`** with the Interfaces above, and call `configureRestAlerts()` at the top of `src/app/_layout.tsx`.
- [ ] **Step 4: Verify.** Run: `npx tsc --noEmit`, `npm test` and `npx expo-doctor`. Expected:
  - no type errors;
  - tests pass;
  - expo-doctor reports nothing new about `expo-notifications`. The 6 known patch-version warnings may remain.
- [ ] **Step 5: Check that the web preview still loads** with no console errors (all alert calls are no-ops on web).
- [ ] **Step 6: Commit** `package.json`, `package-lock.json`, `src/lib/restAlert.ts` and `src/app/_layout.tsx` with the message `Add rest alert notifications`.

---

### Task 4: The bar, the prompt and the countdown on screen

**Files:**
- Create: `src/lib/restTimer.tsx`: `RestTimerProvider` and `useRestTimer()`.
- Create: `src/components/RestTimerBar.tsx`
- Modify: `src/app/_layout.tsx`: wrap `ThemedApp`'s `Stack` in `RestTimerProvider`, inside `SettingsProvider`.
- Modify: `src/app/(tabs)/workouts/log.tsx`:
  - `FieldPair` (line ~201) gains `onDone?: () => void`;
  - `SetBlock` (line ~244) and the partner-set rows (line ~177) call `offer`;
  - render `<RestTimerBar />` below the scroll view.
- Modify: `src/components/SetField.tsx`: add the prop `onBlurValue?: (value: number | null) => void`, called in `onBlur` with the last valid value, or `null` when the field is invalid or empty.
- Modify: `src/app/(tabs)/workouts/day/[dayId].tsx`:
  - render `<RestTimerBar />` above the Start/Finish button;
  - cancel after a successful finish, and when the loaded day has no workout in progress.
- Modify: `src/app/(tabs)/more/index.tsx`: under the Rest timer card from Task 2, when `useRestTimer().alertsAllowed === false`, show in `styles.small` the denied-notifications note from Global Constraints.

**Interfaces:**
- Consumes:
  - from Task 1: `startCountdown`, `adjustCountdown`, `remainingSeconds`, `formatClock`, `newlyDone`, `offersRest`;
  - from Task 2: `useSettings().restSeconds`;
  - from Task 3: `ensureRestAlertsAllowed`, `scheduleRestAlert`, `cancelRestAlert`.
- Produces: `useRestTimer()` returns:
  - `offer(owner: { dayId: string; workoutId: string }, setNumber: number): void`, which shows the prompt;
  - `start(): void`, `dismiss(): void`, `adjust(deltaSeconds: 15 | -15): void`, `skip(): void`;
  - `cancelFor(match: { dayId?: string; workoutId?: string }): void`, which clears the prompt and countdown and cancels the alert when the owner matches;
  - `alertsAllowed: boolean | null` (`null` until first asked);
  - the read-only state the bar uses: `prompt: { setNumber: number } | null`, `countdown: Countdown | null`, `over: boolean`.

**Rules the provider must follow** (from the spec):
- **Prompt timing:** `offer` shows the prompt for 10 s.
- **Start:**
  - starts a full `restSeconds` countdown;
  - asks for permission the first time;
  - cancels the previous alert id before scheduling a new one.
- **adjust:** reschedules the alert for the new time left (cancel, then schedule).
- **At zero:**
  - set `over` for 5 s, then clear everything;
  - if `alertsAllowed === false`, call `Vibration.vibrate([0, 400, 200, 400])`.
- **skip, cancelFor:** cancel the alert.
- **Ticking:** `RestTimerBar` re-renders every second while a countdown runs, with a 1 s interval cleared on unmount. It always reads time from `remainingSeconds(countdown, Date.now())`.

**How the logging screen reports done sets:**
- **Tracking done-ness:**
  - `FieldPair` keeps a `wasDone` ref, initialised from `reps !== null && weight !== null`, and the latest reps and weight from `onBlurValue`;
  - on blur, if `newlyDone(wasDone, reps, weight)`, it sets `wasDone = true` and calls `onDone`.
- **Who calls `offer`:**
  - **`SetBlock`** passes `onDone` to the normal set's `FieldPair` only when `offersRest('normal', set.intensifiers.some(i => i.type === 'superset'))`, and to superset rows (`offersRest('superset', false)`).
  - **Drop and partial rows** get no `onDone`.
  - **Partner-set rows** at line ~177 use `offersRest('superset', false)`, with the set number taken from the parent set.
- **The owner** is `{ dayId: data.dayId, workoutId }`.
- **Cancelling:**
  - the log screen calls `cancelFor({ workoutId })` when loaded data is `null` or `workoutStatus !== 'in_progress'`;
  - the day screen calls `cancelFor({ dayId })` when `day.workout` is null after load, and `cancelFor({ workoutId })` after `finishWorkout` returns true.

**Bar layout:** a row with `styles.card`-like surface, pinned under the content, matching the summary-card look:
- **prompt:** label text, then `Button` `compact` `Start` (primary), then a ✕ icon button labelled `Dismiss`;
- **countdown:** `Rest {m:ss}` in title style with `styles.number`, then compact `−15s`, `+15s` and `Skip` buttons;
- **over:** `Rest over` only.

- [ ] **Step 1: Implement** the provider, the bar and the screen wiring per the rules above.
- [ ] **Step 2: Run the tests and typecheck.** Run: `npm test` and `npx tsc --noEmit`. Expected: all pass, and no type errors.
- [ ] **Step 3: Check in the web preview** (alerts are no-ops on web, so this checks the UI and the rules):
  - **Prompts:**
    - filling a normal set's reps and weight, then moving to the next field, shows `Set 1 done · Start 2:00 rest?`;
    - drop and partial rows never prompt;
    - a set with a superset prompts only after the superset row is filled;
    - leaving the prompt alone hides it after about 10 s.
  - **Countdown:**
    - Start shows `Rest 1:59` counting down;
    - +15s and −15s change it, and −15s at 0:10 shows `Rest 0:00` then `Rest over`;
    - Skip hides the bar;
    - another done set while running shows `Restart rest?`, and returns to the countdown after about 10 s.
  - **Navigation and finishing:**
    - going back to the day screen keeps the countdown showing;
    - Finish workout clears it.
  - **Reloads:** reopening the exercise (a reload remounts the sets) does not prompt for sets that were already done.
- [ ] **Step 4: Commit** with the message `Show rest prompt and countdown bar on logging and day screens`.

---

### Task 5: Docs and phone check

**Files:**
- Modify: `SPEC.md`:
  - 3.5 (logging): the rest prompt and bar;
  - 3.3 (day screen): the bar, and finish cancelling;
  - 3.10 (More): the Rest timer card and the denied-notifications note;
  - 5.9 (settings): the `restSeconds` key.
- Modify: `README.md`: a features bullet `Rest timer`, and `expo-notifications` in the tech stack.
- Modify: `docs/PRD-workout-gaps.md` 4.1: mark it built, pointing to the design doc.

- [ ] **Step 1: Update the three docs** as listed. Copy the exact strings from Global Constraints.
- [ ] **Step 2: Verify everything.** Run: `npx tsc --noEmit` and `npm test`. Expected: no type errors, and all 43 tests pass (35 + 7 + 1).
- [ ] **Step 3: Commit** with the message `Document the rest timer`.
- [ ] **Step 4: Hand over the phone checklist for Ankit** to run in Expo Go (`npx expo start`), then in a new APK:
  - **Permission:** allow notifications at the first Start.
  - **Locked phone:** start a 0:30 rest and lock the phone. It should vibrate and sound at about 0:30.
  - **Closed app:** start a rest and close the app from recents. The alert still goes off.
  - **Finishing early:** start a rest, then Finish the workout. No alert afterwards.
  - **Rapid taps:** tap +15s five times quickly, then wait. Exactly one alert, at the new time.
  - **Denied permission:** deny it (or turn it off in Android settings). The countdown still runs and vibrates in the app, and More shows the note.

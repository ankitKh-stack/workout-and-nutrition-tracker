# Rest timer: design

**Feature 1 of the build order** in [PRD-workout-gaps.md](../../PRD-workout-gaps.md) (section 4.1, decisions in section 3).
**Size:** a small change: one feature, one new native module, no database migration.
**Status:** awaiting Ankit's approval.

## Intent

Between sets, the user wants to know when to start the next one without watching a clock or switching apps. When a set is done, the app offers to start a rest countdown. When the countdown ends, the phone vibrates and plays a sound, even when it is locked or another app is open.

## Decided by Ankit

- **Prompt style:** a "Start timer?" prompt, not a timer that starts by itself. Ankit chose the **bar at the bottom** of the screen (approach A below).
- **Default rest:** 2:00, and it can be changed.
- **Alert at zero:** vibration **and** sound.

## Approaches considered

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| A | **A bar at the bottom of the logging screen:** "Set 2 done · Start 2:00 rest? [Start] ✕". Tapping Start turns the bar into the countdown. | Never blocks typing, and can be ignored. Less attention-grabbing than a dialog. | **Chosen** |
| B | A dialog box, "Start timer?" with Start / Not now | Hard to miss, but it covers the screen and closes the keyboard after every set. | Rejected |
| C | A "Rest" button on each set, with no prompt | Fewest interruptions, but it isn't the prompt Ankit asked for. | Rejected |

## Behaviour

**When the prompt appears**
- **The usual case:** the prompt appears when a set becomes *done* for the first time, meaning reps and weight are both filled in and the user moves off the field.
- **Drop sets, partial reps and supersets:** if a set has any of these rows, the prompt waits until its **last** row is done, so you rest after the whole set, not between its parts. A partial reps row is done once its reps are filled in. (Changed 8 Nov 2026 after the final review: the first version prompted after the main set and never after a drop or partial row. Ankit chose "after the drop".)
- **Edits:** editing a set that was already done does not prompt again.
- **Ignored prompts:** the prompt hides itself after 10 seconds. Tapping ✕ hides it at once.

**The countdown**
- Tapping **Start** turns the bar into "Rest 1:59 · −15s · +15s · Skip".
  - −15s and +15s change the time left. It never goes below 0:00.
  - **Skip** stops the countdown and hides the bar.
- Only **one** countdown runs at a time.
- If another set is done while a countdown is running, the bar shows "Set 3 done · Restart rest? [Start] ✕" for up to 10 seconds, then goes back to the countdown. Start restarts it at the full rest time.
- **At 0:00:**
  - the phone vibrates and plays the notification sound;
  - a notification "Rest over. Time for your next set." appears;
  - the bar shows "Rest over" for 5 seconds, then hides.
- **Where the bar shows:** the countdown lives app-wide, so moving between the logging screen and the day screen keeps it going. The bar shows on both screens.
- **When it's cancelled:** finishing the workout cancels the countdown and its alert. So does the workout auto-ending, or the app noticing it is no longer in progress.
- **If the app is closed:** the countdown on screen is lost, but the alert still goes off at the right time, because the phone holds the scheduled notification.

**Changing the default**
- **On More:** a new "Rest timer" card under Weight with a stepper, "− 2:00 +", in 15-second steps from 0:30 to 5:00. It applies to the next countdown and is remembered after a restart.
- **No per-exercise rest times** for now. The −15s/+15s buttons cover one-off changes.

## How it gets built (my calls)

- **Alert:** `expo-notifications`, local notifications only. Installed with `npx expo install`, as AGENTS.md requires.
  - **Scheduling:** tapping Start schedules a notification `seconds` from now, using the `TIME_INTERVAL` trigger.
  - **Changes:** ±15s cancels it and schedules a new one. Skip, Finish and auto-end cancel it.
  - **Android channel:** one channel, "Rest timer", at HIGH importance with a vibration pattern and the default notification sound. That is what makes it vibrate and sound when the phone is locked. No custom sound file in this version.
  - **In-app alert:** `setNotificationHandler` plays the sound and shows the banner when the app is open, so the alert is the same in the app and outside it.
  - **Permission:** asked for the first time Start is tapped. That's the Android 13+ prompt, and it needs the channel to exist first.
  - **If notifications are denied,** the countdown still runs on screen and the phone vibrates at 0:00 (React Native `Vibration`). There's no sound or background alert, and a one-line note on More says so.
- **Expo Go:** SDK 58's docs say local notifications work in Expo Go, so this can be tested there before building a new APK.
- **Web preview:** notifications are skipped on web, so the preview keeps working.
- **Code layout:**
  - **Timer maths** go in `src/domain/restTimer.ts`, pure functions so they're easy to test:
    - start;
    - add and subtract time;
    - time left at a given moment;
    - finished or not.
  - **The countdown state** (`RestTimerProvider`) sits next to `SettingsProvider` in the root layout.
  - **`RestTimerBar`** is a component, used on the logging screen and the day screen.
  - **Reporting finished sets:** the logging screen reports "a set was done" from `SetBlock`, which already tracks the set's values.
- **Settings:** a new key, `restSeconds`, defaulting to 120, in the existing `settings` table. There's no schema change. `saveSetting` widens its key type to allow it.
- **Clock:** the countdown is worked out from a stored end time, not by counting ticks, so it stays correct after the phone sleeps.

## Not in this version

- Per-exercise rest times.
- A custom alert sound.
- Starting the countdown by itself without the prompt.
- Showing the countdown on the lock screen as a live, updating notification.

## Risks to check on the phone

- **Late alerts:** Android may deliver a scheduled notification a few seconds late in battery-saving modes. If it's noticeably late, the fix is exact alarms, which need an extra permission on Android 14+.
- **The channel's settings are permanent.** Its sound and vibration can't be changed after it's first created. Getting them right before the first release matters, and changing them later needs a new channel name.

## How it's checked

- **Unit tests for the timer maths:**
  - start;
  - ±15s, never below zero;
  - restart;
  - time left after a long gap, as when the phone slept.
- **Typecheck and the existing 35 tests.**
- **Web preview:**
  - the prompt appears after a set is done, but not for drop or partial rows;
  - Start, ±15s and Skip work;
  - finishing the workout clears the bar;
  - the More stepper saves.
- **On the phone (Expo Go, then the APK):**
  - the alert vibrates and sounds with the screen locked;
  - it still alerts with the app closed;
  - it's cancelled when you finish early.

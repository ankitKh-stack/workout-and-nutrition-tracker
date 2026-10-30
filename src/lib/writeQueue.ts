// Field edits are saved in the background. Running them one at a time, in
// order, means a reload that waits for drain() always sees the latest values.

let tail: Promise<unknown> = Promise.resolve();

export function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}

export function drainWrites(): Promise<unknown> {
  return tail;
}

// The set whose Reps field should receive focus when the logging screen next
// reloads (after "+ Add set" or adding an intensifier from the picker).
let pendingFocusSetId: string | null = null;

export function requestFocus(setId: string) {
  pendingFocusSetId = setId;
}

export function takeFocusRequest(): string | null {
  const id = pendingFocusSetId;
  pendingFocusSetId = null;
  return id;
}

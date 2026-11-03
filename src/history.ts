import { useCallback, useRef, useState } from "react";

// An undo stack whose bookkeeping lives in refs. Every operation reads the previous past, future and
// value from the refs and writes the new ones synchronously, in the event handler that called it, and
// only then mirrors the result into state with plain values. Nothing happens inside a state updater:
// React StrictMode calls updaters twice in development, so an undo that pushed onto the future stack
// and wrote valueRef from inside setPast ran twice, left a duplicate entry behind and made Redo
// restore the state the editor was already in. Plain setState calls are not repeated, so the refs are
// the one source of truth and the state is a mirror of them for rendering. PageStage reads
// valueRef.current from event handlers, which is why the value has to be current the moment
// replace/commit/undo/redo/reset return.
export function useHistory<T>(initial: T) {
  const valueRef = useRef(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const [value, setValue] = useState(initial);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Mirrors the refs into state so the component re-renders with the new value and button states.
  const publish = useCallback(() => {
    setValue(valueRef.current);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  // Sets the value without recording a step, for live adjustments whose baseline is pushed later.
  const replace = useCallback((next: T) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  // Records the value a live adjustment started from, once it has finished, as the step to undo to.
  // Nothing is recorded when the adjustment changed nothing.
  const pushBaseline = useCallback(
    (baseline: T): boolean => {
      if (JSON.stringify(baseline) === JSON.stringify(valueRef.current)) return false;
      pastRef.current = [...pastRef.current, baseline];
      futureRef.current = [];
      publish();
      return true;
    },
    [publish],
  );

  const commit = useCallback(
    (next: T): boolean => {
      const current = valueRef.current;
      if (Object.is(current, next)) return false;
      pastRef.current = [...pastRef.current, current];
      futureRef.current = [];
      valueRef.current = next;
      publish();
      return true;
    },
    [publish],
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1] as T;
    futureRef.current = [valueRef.current, ...futureRef.current];
    pastRef.current = past.slice(0, -1);
    valueRef.current = previous;
    publish();
  }, [publish]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    const next = future[0] as T;
    pastRef.current = [...pastRef.current, valueRef.current];
    futureRef.current = future.slice(1);
    valueRef.current = next;
    publish();
  }, [publish]);

  const reset = useCallback(
    (next: T) => {
      valueRef.current = next;
      pastRef.current = [];
      futureRef.current = [];
      publish();
    },
    [publish],
  );

  return {
    value,
    valueRef,
    replace,
    commit,
    pushBaseline,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  };
}

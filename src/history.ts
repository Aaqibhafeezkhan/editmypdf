import { useCallback, useRef, useState } from "react";

export function useHistory<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  const valueRef = useRef(initial);

  const replace = useCallback((next: T) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  const pushBaseline = useCallback((baseline: T): boolean => {
    if (JSON.stringify(baseline) === JSON.stringify(valueRef.current)) return false;
    setPast((items) => [...items, baseline]);
    setFuture([]);
    return true;
  }, []);

  const commit = useCallback((next: T): boolean => {
    const current = valueRef.current;
    if (Object.is(current, next)) return false;
    setPast((items) => [...items, current]);
    setFuture([]);
    valueRef.current = next;
    setValue(next);
    return true;
  }, []);

  const undo = useCallback(() => {
    setPast((items) => {
      if (items.length === 0) return items;
      const previous = items[items.length - 1] as T;
      const current = valueRef.current;
      valueRef.current = previous;
      setFuture((upcoming) => [current, ...upcoming]);
      setValue(previous);
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (items.length === 0) return items;
      const [next, ...rest] = items;
      if (next === undefined) return items;
      setPast((previous) => [...previous, valueRef.current]);
      valueRef.current = next;
      setValue(next);
      return rest;
    });
  }, []);

  const reset = useCallback((next: T) => {
    valueRef.current = next;
    setPast([]);
    setFuture([]);
    setValue(next);
  }, []);

  return {
    value,
    valueRef,
    replace,
    commit,
    pushBaseline,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

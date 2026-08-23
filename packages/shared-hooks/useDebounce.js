import { useState, useEffect, useRef, useCallback } from "react";

function normalizeDebounceArgs(delay, options) {
  let _delay;
  let maxWait;
  if (typeof delay === "object" && delay !== null) {
    _delay = delay.delay ?? delay.wait ?? 250;
    maxWait = delay.maxWait;
  } else {
    _delay = delay ?? 250;
    if (typeof options === "object" && options !== null) {
      maxWait = options.maxWait ?? options.maxWaitMs;
    } else if (typeof options === "number") {
      maxWait = options;
    }
  }
  _delay = Number.isFinite(_delay) && _delay >= 0 ? _delay : 250;
  if (maxWait !== null && maxWait !== undefined) {
    maxWait = Number.isFinite(maxWait) && maxWait >= 0 ? maxWait : undefined;
  }
  return { _delay, maxWait };
}

export function useDebounce(value, delay = 250, options = {}) {
  const { _delay, maxWait } = normalizeDebounceArgs(delay, options);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const debounceRef = useRef(null);
  const maxWaitRef = useRef(null);
  const lastInvokeRef = useRef(Date.now());

  useEffect(() => {
    // Schedule trailing debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedValue(value);
      lastInvokeRef.current = Date.now();
      if (maxWaitRef.current) {
        clearTimeout(maxWaitRef.current);
        maxWaitRef.current = null;
      }
    }, _delay);

    // Schedule maxWait if provided — ensures update at least every maxWait ms
    if (
      maxWait !== null &&
      maxWait !== undefined &&
      maxWait > 0 &&
      !maxWaitRef.current
    ) {
      const timeSinceLastInvoke = Date.now() - lastInvokeRef.current;
      const timeUntilMaxWait = maxWait - timeSinceLastInvoke;
      if (timeUntilMaxWait <= 0) {
        // Already exceeded — update immediately on next tick to avoid sync setState during render
        maxWaitRef.current = setTimeout(() => {
          setDebouncedValue(value);
          lastInvokeRef.current = Date.now();
          maxWaitRef.current = null;
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
          }
        }, 0);
      } else {
        maxWaitRef.current = setTimeout(() => {
          setDebouncedValue(value);
          lastInvokeRef.current = Date.now();
          maxWaitRef.current = null;
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
          }
        }, timeUntilMaxWait);
      }
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, _delay, maxWait]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    };
  }, []);

  return debouncedValue;
}

export function useDebouncedCallback(callback, delay = 250, options = {}) {
  const { _delay, maxWait } = normalizeDebounceArgs(delay, options);
  const timerRef = useRef(null);
  const maxWaitRef = useRef(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef(null);
  const lastInvokeRef = useRef(0);
  callbackRef.current = callback;

  const invoke = useCallback(() => {
    const args = argsRef.current;
    argsRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (maxWaitRef.current) {
      clearTimeout(maxWaitRef.current);
      maxWaitRef.current = null;
    }
    if (args) {
      callbackRef.current?.(...args);
      lastInvokeRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    };
  }, []);

  return useCallback(
    (...args) => {
      argsRef.current = args;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(invoke, _delay);

      if (
        maxWait !== null &&
        maxWait !== undefined &&
        maxWait > 0 &&
        !maxWaitRef.current
      ) {
        const timeSinceLastInvoke = Date.now() - lastInvokeRef.current;
        const timeUntilMaxWait = maxWait - timeSinceLastInvoke;
        // If we have never invoked, treat lastInvoke as now
        const wait =
          lastInvokeRef.current === 0
            ? maxWait
            : timeUntilMaxWait <= 0
              ? 0
              : timeUntilMaxWait;
        maxWaitRef.current = setTimeout(invoke, wait);
      }
    },
    [_delay, maxWait, invoke],
  );
}

export default useDebounce;

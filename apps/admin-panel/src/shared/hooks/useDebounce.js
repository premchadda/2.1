import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useDebounce - Debounces a value with a specified delay (default 250ms)
 * @param {*} value - The input value to debounce
 * @param {number} delay - The debounce delay in milliseconds
 * @returns {*} The debounced value
 */
export function useDebounce(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback - Debounces a function callback execution
 * @param {Function} callback - The function to debounce
 * @param {number} delay - The debounce delay in milliseconds
 * @returns {Function} The debounced function
 */
export function useDebouncedCallback(callback, delay = 250) {
  const timerRef = useRef(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current?.(...args);
      }, delay);
    },
    [delay],
  );
}

export default useDebounce;

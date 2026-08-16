import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing undo/redo history
 * @param {number} maxHistory - Maximum number of history entries to keep
 */
export function useUndoRedo(maxHistory = 50) {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isExecutingRef = useRef(false);
  // Ref to track currentIndex for use inside setHistory callback (avoids stale closure)
  const currentIndexRef = useRef(-1);

  // Keep ref in sync
  const setIndex = useCallback((updater) => {
    setCurrentIndex(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      currentIndexRef.current = next;
      return next;
    });
  }, []);

  /**
   * Execute an operation and add it to history
   * @param {Function} doAction - Function to perform the action
   * @param {Function} undoAction - Function to undo the action
   * @param {string} label - Optional label for the operation
   */
  const execute = useCallback(async (doAction, undoAction, label = '') => {
    isExecutingRef.current = true;
    
    try {
      const result = await doAction();
      
      // Use ref to get the current index at time of execution, avoiding stale closure
      const idxAtCall = currentIndexRef.current;

      setHistory(prev => {
        // Remove any future history if we're not at the end
        const newHistory = prev.slice(0, idxAtCall + 1);
        newHistory.push({ doAction, undoAction, label, timestamp: Date.now() });
        
        // Trim history if exceeding max
        if (newHistory.length > maxHistory) {
          return newHistory.slice(-maxHistory);
        }
        return newHistory;
      });
      
      setIndex(prev => Math.min(prev + 1, maxHistory - 1));
      isExecutingRef.current = false;
      return result;
    } catch (error) {
      isExecutingRef.current = false;
      throw error;
    }
  }, [maxHistory, setIndex]);

  /**
   * Undo the last operation
   */
  const undo = useCallback(async () => {
    if (currentIndexRef.current < 0 || isExecutingRef.current) return null;
    
    isExecutingRef.current = true;

    // Read from ref + current history snapshot
    const idx = currentIndexRef.current;
    const entry = history[idx];
    if (!entry) {
      isExecutingRef.current = false;
      return null;
    }

    // M44: execute side effect OUTSIDE the state updater (updater must be pure)
    entry.undoAction();

    setIndex(prev => prev - 1);
    isExecutingRef.current = false;

    return { result: true, label: entry.label };
  }, [history, setIndex]);

  /**
   * Redo the previously undone operation
   */
  const redo = useCallback(async () => {
    if (currentIndexRef.current >= history.length - 1 || isExecutingRef.current) return null;
    
    isExecutingRef.current = true;

    const idx = currentIndexRef.current;
    const entry = history[idx + 1];
    if (!entry) {
      isExecutingRef.current = false;
      return null;
    }

    try {
      const result = await entry.doAction();
      setIndex(prev => prev + 1);
      isExecutingRef.current = false;
      return { result, label: entry.label };
    } catch (error) {
      isExecutingRef.current = false;
      throw error;
    }
  }, [history, setIndex]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setIndex(-1);
  }, [setIndex]);

  const canUndo = currentIndexRef.current >= 0 && !isExecutingRef.current;
  const canRedo = currentIndexRef.current < history.length - 1 && !isExecutingRef.current;

  return {
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    history,
    currentIndex
  };
}

export default useUndoRedo;

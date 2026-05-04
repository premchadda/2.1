import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing undo/redo history
 * @param {number} maxHistory - Maximum number of history entries to keep
 */
export function useUndoRedo(maxHistory = 50) {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isExecutingRef = useRef(false);

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
      
      setHistory(prev => {
        // Remove any future history if we're not at the end
        const newHistory = prev.slice(0, currentIndex + 1);
        newHistory.push({ doAction, undoAction, label, timestamp: Date.now() });
        
        // Trim history if exceeding max
        if (newHistory.length > maxHistory) {
          return newHistory.slice(-maxHistory);
        }
        return newHistory;
      });
      
      setCurrentIndex(prev => Math.min(prev + 1, maxHistory - 1));
      isExecutingRef.current = false;
      return result;
    } catch (error) {
      isExecutingRef.current = false;
      throw error;
    }
  }, [currentIndex, maxHistory]);

  /**
   * Undo the last operation
   */
  const undo = useCallback(async () => {
    if (currentIndex < 0 || isExecutingRef.current) return null;
    
    isExecutingRef.current = true;
    const entry = history[currentIndex];
    
    try {
      const result = await entry.undoAction();
      setCurrentIndex(prev => prev - 1);
      isExecutingRef.current = false;
      return { result, label: entry.label };
    } catch (error) {
      isExecutingRef.current = false;
      throw error;
    }
  }, [currentIndex, history]);

  /**
   * Redo the previously undone operation
   */
  const redo = useCallback(async () => {
    if (currentIndex >= history.length - 1 || isExecutingRef.current) return null;
    
    isExecutingRef.current = true;
    const entry = history[currentIndex + 1];
    
    try {
      const result = await entry.doAction();
      setCurrentIndex(prev => prev + 1);
      isExecutingRef.current = false;
      return { result, label: entry.label };
    } catch (error) {
      isExecutingRef.current = false;
      throw error;
    }
  }, [currentIndex, history]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  const canUndo = currentIndex >= 0 && !isExecutingRef.current;
  const canRedo = currentIndex < history.length - 1 && !isExecutingRef.current;

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
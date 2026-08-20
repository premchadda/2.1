import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useDebounce } from "../../hooks/useDebounce";

/**
 * SearchInput - A polished, accessible, responsive search bar with debouncing,
 * keyboard shortcut focus, and clear functionality.
 */
export default function SearchInput({
  value,
  onChange,
  onDebouncedChange,
  onClear,
  placeholder = "Search...",
  debounceDelay = 250,
  loading = false,
  enableShortcut = true,
  shortcutKey = "/",
  size = "md",
  autoFocus = false,
  className = "",
  id,
  ariaLabel = "Search",
  ...props
}) {
  const [internalValue, setInternalValue] = useState(
    value !== undefined ? value : "",
  );
  const inputRef = useRef(null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Debounced callback
  const debouncedValue = useDebounce(currentValue, debounceDelay);

  useEffect(() => {
    if (onDebouncedChange) {
      onDebouncedChange(debouncedValue);
    }
  }, [debouncedValue, onDebouncedChange]);

  // Sync controlled value
  useEffect(() => {
    if (isControlled) {
      setInternalValue(value || "");
    }
  }, [value, isControlled]);

  // Keyboard shortcut listener (e.g. '/' or 'Ctrl+K' when outside editable elements)
  useEffect(() => {
    if (!enableShortcut) return;

    const handleKeyDown = (e) => {
      // Don't capture if user is typing in another input / textarea
      const tag = document.activeElement?.tagName;
      const isEditable =
        document.activeElement?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";
      if (isEditable) return;

      if (shortcutKey === "/" && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (
        shortcutKey === "k" &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableShortcut, shortcutKey]);

  const handleChange = (e) => {
    const val = e.target.value;
    if (!isControlled) {
      setInternalValue(val);
    }
    onChange?.(e);
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue("");
    }
    onClear?.();
    inputRef.current?.focus();
  };

  const sizeClasses = {
    sm: "py-1 pl-7 pr-7 text-xs rounded-lg",
    md: "py-1.5 pl-8 pr-8 text-xs sm:text-sm rounded-xl",
    lg: "py-2 pl-9 pr-9 text-sm sm:text-base rounded-2xl",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5 left-2",
    md: "w-4 h-4 left-2.5",
    lg: "w-4.5 h-4.5 left-3",
  };

  return (
    <div className={`relative flex items-center w-full min-w-0 ${className}`}>
      {/* Search / Loading Icon */}
      {loading ? (
        <Loader2
          className={`absolute top-1/2 -translate-y-1/2 text-indigo-500 animate-spin pointer-events-none ${iconSizes[size] || iconSizes.md}`}
        />
      ) : (
        <Search
          className={`absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none ${iconSizes[size] || iconSizes.md}`}
        />
      )}

      {/* Text Input */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={currentValue}
        onChange={handleChange}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full bg-gray-50/70 dark:bg-gray-800/80 border border-gray-200/90 dark:border-gray-700/80 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium ${sizeClasses[size] || sizeClasses.md}`}
        {...props}
      />

      {/* Trailing Controls: Clear Button & Shortcut Badge */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {currentValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors tap-feedback"
            aria-label="Clear search text"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : enableShortcut ? (
          <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/50 rounded border border-gray-200/80 dark:border-gray-600/50 pointer-events-none">
            {shortcutKey}
          </kbd>
        ) : null}
      </div>
    </div>
  );
}

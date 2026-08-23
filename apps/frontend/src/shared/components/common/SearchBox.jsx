import React, { useRef, useEffect } from "react";
import { Search, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { useDebounce } from "../../hooks/useDebounce";

/**
 * Shared SearchBox component for Hero sections & page search bars
 * Automatically stays compact on mobile and allows for customization
 */
const SearchBox = ({
  value,
  onChange,
  onDebouncedChange,
  onClear,
  onSubmit,
  placeholder = "Search...",
  className = "",
  iconColorClass = "group-focus-within:text-brand-start",
  containerClass = "max-w-[95vw] sm:max-w-xl",
  inputClass = "shadow-2xl text-lg",
  showAction = false,
  actionText = "Search",
  compact = false,
  loading = false,
  enableShortcut = false,
  debounceDelay = 250,
  ...props
}) => {
  const inputRef = useRef(null);

  // Debounced callback
  const debouncedValue = useDebounce(value, debounceDelay);

  useEffect(() => {
    if (onDebouncedChange && debouncedValue !== undefined) {
      onDebouncedChange(debouncedValue);
    }
  }, [debouncedValue, onDebouncedChange]);

  // Optional keyboard shortcut listener
  useEffect(() => {
    if (!enableShortcut) return;
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditable =
        document.activeElement?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";
      if (isEditable) return;

      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableShortcut]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(e);
  };

  const handleClear = () => {
    onClear?.();
    inputRef.current?.focus();
  };

  if (compact) {
    return (
      <form
        onSubmit={handleSubmit}
        className={`relative animate-slide-up group ${containerClass} ${className}`}
        style={{ animationDelay: "0.2s" }}
      >
        {loading ? (
          <Loader2
            className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin pointer-events-none`}
          />
        ) : (
          <Search
            className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 ${iconColorClass} transition-colors pointer-events-none`}
          />
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`w-full pl-9 pr-8 py-2 rounded-lg border-0 focus:ring-2 focus:ring-white/20 text-gray-800 dark:text-white bg-white dark:bg-gray-800 text-sm outline-none transition-all ${inputClass} ${showAction ? "pr-24" : ""}`}
          {...props}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {value && onClear && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-0.5"
              aria-label="Clear search"
            >
              <XCircle className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
          {showAction && (
            <button
              type="submit"
              className="px-3 py-1 bg-brand-start text-white text-xs font-bold rounded-md hover:shadow-lg transition-all flex items-center gap-1"
            >
              {actionText}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative animate-slide-up group ${containerClass} ${className}`}
      style={{ animationDelay: "0.2s" }}
    >
      {loading ? (
        <Loader2
          className={`w-4 h-4 md:w-5 md:h-5 absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin pointer-events-none`}
        />
      ) : (
        <Search
          className={`w-4 h-4 md:w-5 md:h-5 absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-gray-400 ${iconColorClass} transition-colors pointer-events-none`}
        />
      )}
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full pl-10 md:pl-12 pr-10 md:pr-4 py-2.5 md:py-4 rounded-xl md:rounded-2xl border-0 focus:ring-4 focus:ring-white/20 text-gray-800 dark:text-white bg-white dark:bg-gray-800 text-sm md:text-lg outline-none transition-all ${inputClass} ${showAction ? "pr-20 md:pr-32" : ""}`}
        {...props}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {value && onClear && (
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
            aria-label="Clear search"
          >
            <XCircle className="w-4 h-4 md:w-5 md:h-5 fill-current" />
          </button>
        )}
        {showAction && (
          <button
            type="submit"
            className="px-3 md:px-5 py-1.5 md:py-2 bg-brand-start text-white text-[10px] md:text-sm font-bold rounded-lg md:rounded-xl hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            {actionText}
            <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchBox;

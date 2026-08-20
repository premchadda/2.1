import { useState, useMemo } from "react";
import { useDebounce } from "./useDebounce.js";
import { filterAndRank } from "./searchUtils.js";

export function useSearch(items = [], getFields, options = {}) {
  const {
    debounceDelay = 200,
    threshold = 20,
    maxResults = 100,
    initialQuery = "",
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, debounceDelay);

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return items;
    return filterAndRank(items, debouncedQuery, getFields, {
      threshold,
      maxResults,
    });
  }, [items, debouncedQuery, getFields, threshold, maxResults]);

  const clear = () => setQuery("");

  return {
    query,
    setQuery,
    debouncedQuery,
    results,
    clear,
    isSearching: Boolean(query.trim()),
    resultsCount: results.length,
    totalCount: items.length,
  };
}

export default useSearch;

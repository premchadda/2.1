import { useState, useMemo } from "react";
import { useDebounce } from "./useDebounce";
import { filterAndRank } from "../utils/searchUtils";

/**
 * useSearch - High-performance search hook with instant UI response, debounced filtering, and fuzzy ranking.
 *
 * @param {Array} items - The source items list
 * @param {Function} getFields - Function returning searchable fields for each item: item => [item.name, item.code]
 * @param {Object} options - { debounceDelay: number, threshold: number, maxResults: number, initialQuery: string }
 */
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

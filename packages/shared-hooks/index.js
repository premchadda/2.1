// Shared Hooks Package - Exports common hooks used across frontend and admin-panel
// HIGH-09 Fix: Consolidated hook files into single shared package
// 9 identical hooks found across frontend/src/shared/hooks/ and admin-panel/src/shared/hooks/

export { default as useStages } from "./useStages.js";
export { default as useExamCategories } from "./useExamCategories.js";
export { default as useTestCategories } from "./useTestCategories.js";
export { default as useProPass, initProPassAuth } from "./useProPass.js";
export { default as useFormManager } from "./useFormManager.js";
export { default as useGenericCRUD } from "./useGenericCRUD.js";
export { default as useDraggableScroll } from "./useDraggableScroll.js";
export { useWebSocket } from "./useWebSocket.js";
export { default as useUndoRedo } from "./useUndoRedo.js";
export { useDebounce, useDebouncedCallback } from "./useDebounce.js";
export { useSearch } from "./useSearch.js";
export {
  filterAndRank,
  calculateFuzzyScore,
  normalizeSearchText,
} from "./searchUtils.js";
// Note: useDraggableScroll.fixed.js - merge into useDraggableScroll.js for single source

export { default as EmptyState } from "./src/EmptyState.jsx";
export { ThemeProvider, useTheme } from "./ThemeContext.jsx";
export { setSharedApiClient, getSharedApiClient } from "./apiClientConfig.js";

/**
 * Shared Hooks Package (@trstprep/shared-hooks)
 * Primary entry point for custom React hooks across Trstprep applications.
 */

export { default as useUndoRedo } from "../useUndoRedo.js";
export { default as useFormManager } from "../useFormManager.js";
export { default as useDraggableScroll } from "../useDraggableScroll.js";

export { default as useStages } from "../useStages.js";
export { default as useExamCategories } from "../useExamCategories.js";
export { default as useTestCategories } from "../useTestCategories.js";
export {
  default as useProPass,
  initProPassAuth,
  formatRemainingDays,
  getUrgencyColors,
} from "../useProPass.js";
export { default as useGenericCRUD } from "../useGenericCRUD.js";
export { useWebSocket } from "../useWebSocket.js";
export { useDebounce, useDebouncedCallback } from "../useDebounce.js";
export { useSearch } from "../useSearch.js";
export {
  filterAndRank,
  calculateFuzzyScore,
  normalizeSearchText,
} from "../searchUtils.js";
export { default as usePwaInstall } from "../usePwaInstall.js";
export { setSharedApiClient, getSharedApiClient } from "../apiClientConfig.js";

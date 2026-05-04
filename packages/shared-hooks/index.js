// Shared Hooks Package - Exports common hooks used across frontend and admin-panel
// HIGH-09 Fix: Consolidate duplicated hook files into single shared package
// 9 identical hooks found across frontend/src/shared/hooks/ and admin-panel/src/shared/hooks/

export { default as useStages } from './useStages.js'
export { default as useExamCategories } from './useExamCategories.js'
export { default as useTestCategories } from './useTestCategories.js'
export { default as useProPass } from './useProPass.js'
export { default as useFormManager } from './useFormManager.js'
export { default as useGenericCRUD } from './useGenericCRUD.js'
export { default as useDraggableScroll } from './useDraggableScroll.js'
export { useWebSocket } from './useWebSocket.js'
export { default as useUndoRedo, useUndoRedo as useUndoRedoHook } from './useUndoRedo.js'
// Note: useDraggableScroll.fixed.js - merge into useDraggableScroll.js for single source

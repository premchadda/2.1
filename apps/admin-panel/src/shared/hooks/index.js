// Re-exports from @trstprep/shared-hooks package
// All hooks now use shared package - single source of truth

// Re-export from shared-hooks package
export {
  default as useStages,
  default as useExamCategories,
  default as useTestCategories,
  default as useProPass,
  default as useFormManager,
  default as useGenericCRUD,
  default as useDraggableScroll,
  useWebSocket,
  useUndoRedo,
  useUndoRedo as useUndoRedoHook
} from '@trstprep/shared-hooks';
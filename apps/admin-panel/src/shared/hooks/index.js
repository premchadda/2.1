// Re-exports from @trstprep/shared-hooks package
// All hooks now use shared package - single source of truth

export {
  useStages,
  useExamCategories,
  useTestCategories,
  useProPass,
  useFormManager,
  useGenericCRUD,
  useDraggableScroll,
  useWebSocket,
  useUndoRedo,
  useUndoRedo as useUndoRedoHook
} from '@trstprep/shared-hooks'

export { useForm } from './useForm.js'

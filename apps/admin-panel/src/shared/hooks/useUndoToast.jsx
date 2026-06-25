import { useState, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { logger } from '../lib/logger'

export function useUndoToast() {
  const pendingActions = useRef(new Map())

  const withUndo = useCallback(async (action, options = {}) => {
    const {
      successMessage = 'Action completed',
      errorMessage = 'Action failed',
      undoMessage = 'Action undone',
      undoAction,
      duration = 5000
    } = options

    const actionId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `action_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      : `action_${Date.now()}_${Date.now().toString(36)}`

    try {
      const result = await action()

      toast.success(
        (t) => (
          <div className="flex items-center gap-3">
            <span>{successMessage}</span>
            {undoAction && (
              <button
                onClick={() => {
                  undoAction(result)
                  toast.dismiss(t.id)
                  toast.success(undoMessage)
                }}
                className="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium underline"
              >
                Undo
              </button>
            )}
          </div>
        ),
        { duration, id: actionId }
      )

      pendingActions.current.set(actionId, { result, undoAction })
      setTimeout(() => pendingActions.current.delete(actionId), duration)

      return result
    } catch (error) {
      logger.error(errorMessage, error)
      toast.error(errorMessage)
      throw error
    }
  }, [])

  const clearPending = useCallback(() => {
    pendingActions.current.clear()
  }, [])

  return { withUndo, clearPending }
}

export default useUndoToast

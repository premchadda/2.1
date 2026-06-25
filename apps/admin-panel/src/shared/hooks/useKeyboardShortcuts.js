import { useEffect, useRef } from 'react'

export function useKeyboardShortcuts(handlers = {}) {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const { onSave, onNew, onClose, onDelete, onSearch, shortcuts } = handlersRef.current

      // Ctrl+S / Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave?.()
      }

      // Ctrl+N / Cmd+N - New
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        onNew?.()
      }

      // Escape - Close/Cancel
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }

      // Ctrl+/ - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        onSearch?.()
      }

      // Custom shortcuts map
      if (shortcuts) {
        const key = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`
        shortcuts[key]?.(e)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

export default useKeyboardShortcuts

import { useEffect, useRef, useId } from 'react'
import { X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full mx-4',
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement),
  )
}

function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  closeOnOverlay = true,
  className = '',
}) {
  const overlayRef = useRef(null)
  const dialogRef = useRef(null)
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'

    const prevFocused = document.activeElement
    const node = dialogRef.current
    if (node) {
      const focusable = node.querySelector(FOCUSABLE)
      ;(focusable || node).focus()
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
      if (prevFocused && typeof prevFocused.focus === 'function' && document.contains(prevFocused)) {
        prevFocused.focus()
      }
    }
  }, [isOpen, onClose])

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return
    const node = dialogRef.current
    if (!node) return
    const focusable = getFocusable(node)
    if (focusable.length === 0) {
      e.preventDefault()
      node.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first || !node.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (active === last || !node.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={twMerge(
          'relative w-full bg-white dark:bg-gray-800 rounded-2xl shadow-elevated border border-gray-200 dark:border-gray-700 animate-scale-in',
          sizes[size] || sizes.md,
          className,
        )}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            {title && <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>}
            {showClose && (
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>
        )}
        <div id={bodyId} className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export { Modal }
export default Modal

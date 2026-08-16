import React from 'react'

export default function ImageZoomModal({ isOpen, imageUrl, questionNumber, onClose }) {
  if (!isOpen || !imageUrl) return null

  return (
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose()
        } else if (e.key === 'Tab') {
          e.preventDefault()
        }
      }}
      tabIndex={0}
      ref={(el) => {
        if (el) {
          el.focus()
          el._trapFocus = (ev) => {
            if (ev.key === 'Tab') ev.preventDefault()
          }
          document.addEventListener('keydown', el._trapFocus)
        }
      }}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Zoomed question image"
    >
      <img
        src={imageUrl}
        alt={`Question ${questionNumber || ''} (zoomed)`}
        className="max-w-full max-h-full object-contain"
      />
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
        aria-label="Close zoom"
      >
        ✕
      </button>
    </div>
  )
}

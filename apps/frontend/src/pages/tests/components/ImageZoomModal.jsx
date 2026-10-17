import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function ImageZoomModal({
  isOpen,
  imageUrl,
  questionNumber,
  onClose,
}) {
  const overlayRef = useRef(null);

  // Focus the overlay on open. The previous implementation registered a
  // keydown listener on `document` from inside a ref callback and never removed
  // it, so every open leaked a listener that cancelled Tab for the whole page.
  // Escape/Tab handling now lives on the overlay itself, scoped to this modal.
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    overlayRef.current?.focus();
  }, [isOpen, imageUrl]);

  if (!isOpen || !imageUrl || typeof document === "undefined") return null;

  return createPortal(
    <React.Fragment>
      <div
        ref={overlayRef}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onClose();
          } else if (e.key === "Tab") {
            // Single close button: keep focus inside the dialog.
            e.preventDefault();
          }
        }}
        tabIndex={0}
        className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out outline-none animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Zoomed question image"
      >
        <img
          loading="lazy"
          decoding="async"
          src={imageUrl}
          alt={`Question ${questionNumber || ""} (zoomed)`}
          className="max-w-full max-h-full object-contain"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors cursor-pointer"
          aria-label="Close zoom"
        >
          ✕
        </button>
      </div>
    </React.Fragment>,
    document.body,
  );
}

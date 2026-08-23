import React from "react";
import { createPortal } from "react-dom";

export default function ImageZoomModal({
  isOpen,
  imageUrl,
  questionNumber,
  onClose,
}) {
  if (!isOpen || !imageUrl || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        } else if (e.key === "Tab") {
          e.preventDefault();
        }
      }}
      tabIndex={0}
      ref={(el) => {
        if (el) {
          el.focus();
          el._trapFocus = (ev) => {
            if (ev.key === "Tab") ev.preventDefault();
          };
          document.addEventListener("keydown", el._trapFocus);
        }
      }}
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
    </div>,
    document.body,
  );
}

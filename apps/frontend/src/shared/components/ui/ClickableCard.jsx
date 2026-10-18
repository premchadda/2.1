import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

/**
 * ClickableCard — a container that behaves like a button but keeps its own
 * layout box (block-level, full width, left aligned).
 *
 * Use it for list rows / cards that are currently `<div onClick={...}>` so
 * they become reachable by keyboard and exposed to assistive tech without any
 * extra wiring: focus, Enter and Space all work, and a visible focus ring is
 * provided for free.
 *
 * IMPORTANT: do NOT render this inside another interactive element (button,
 * anchor, input, [role="button"]). HTML forbids nesting interactive controls,
 * which produces invalid markup and confusing screen-reader output. If the
 * surrounding markup already contains a real control (e.g. a radio input), do
 * not add this wrapper at all — give the container `role="presentation"` or
 * leave it non-interactive instead.
 *
 * If you genuinely need a non-button element (e.g. to keep a flex-row layout or
 * to avoid nesting), skip this primitive and add the semantics yourself on the
 * existing element: `role="button" tabIndex={0}` plus
 * `onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); } }}`
 * and a `focus-visible` ring class.
 */
const ClickableCard = forwardRef(function ClickableCard(
  { as: _as, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={twMerge(
        "w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export { ClickableCard };
export default ClickableCard;

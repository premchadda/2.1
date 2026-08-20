/**
 * DS-02 / SC-04: Shared Card component with optional accent stripe.
 * Supports elevated and flat variants with consistent styling.
 */
import React from "react";

const accentColors = {
  indigo: "border-t-indigo-500",
  emerald: "border-t-emerald-500",
  amber: "border-t-amber-500",
  red: "border-t-red-500",
  blue: "border-t-blue-500",
  purple: "border-t-purple-500",
  pink: "border-t-pink-500",
  gray: "border-t-gray-400",
};

export default function Card({
  children,
  accent,
  padding = "md",
  elevated = true,
  hoverable = false,
  className = "",
  onClick,
  ...props
}) {
  const paddings = {
    none: "",
    xs: "p-2 sm:p-2.5",
    sm: "p-3 sm:p-3.5",
    md: "p-3.5 sm:p-4 md:p-5",
    lg: "p-5 sm:p-6",
    xl: "p-6 sm:p-8",
  };

  const baseClasses = [
    "rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 transition-all",
    elevated ? "shadow-sm" : "",
    hoverable
      ? "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 card-hover-transitive cursor-pointer tap-feedback"
      : "",
    accent ? `border-t-4 ${accentColors[accent] || accentColors.indigo}` : "",
    paddings[padding] || paddings.md,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const Component = onClick ? "button" : "div";

  return (
    <Component className={baseClasses} onClick={onClick} {...props}>
      {children}
    </Component>
  );
}

/**
 * Card.Header — optional header section with title and actions.
 */
Card.Header = function CardHeader({
  title,
  subtitle,
  actions,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3.5 ${className}`}
    >
      <div>
        <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

/**
 * Card.Footer — optional footer section.
 */
Card.Footer = function CardFooter({ children, className = "" }) {
  return (
    <div
      className={`mt-3.5 pt-3.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 ${className}`}
    >
      {children}
    </div>
  );
};

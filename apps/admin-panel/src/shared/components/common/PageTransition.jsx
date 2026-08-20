import React from "react";
import { useLocation } from "react-router-dom";

/**
 * PageTransition - Smooth, hardware-accelerated transitive page wrapper.
 * Automatically animates when the route changes.
 */
export default function PageTransition({ children, className = "", ...props }) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className={`page-transition w-full min-w-0 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

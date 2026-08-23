import React from "react";

/**
 * TrstprepLoading — Premium branded loading screen & component for Trstprep.
 *
 * Features:
 * - Floating glowing rocket brand mark with iridescent shimmer
 * - Dual ambient background blur with brand-gradient pulses
 * - Sleek indeterminate gradient progress bar
 * - Dark / Light theme parity with accessible ARIA status
 */
export function TrstprepLoading({
  message = "Loading Trstprep...",
  subtext = "Preparing your test preparation environment",
  fullscreen = false,
  size = "md",
  className = "",
}) {
  const isSmall = size === "sm";
  const isLarge = size === "lg";

  const containerSizes = isSmall
    ? "w-10 h-10 rounded-xl"
    : isLarge
      ? "w-20 h-20 sm:w-24 sm:h-24 rounded-3xl"
      : "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl";

  const iconSizes = isSmall
    ? "w-5 h-5"
    : isLarge
      ? "w-10 h-10 sm:w-12 sm:h-12"
      : "w-7 h-7 sm:w-8 sm:h-8";

  return (
    <div
      className={`flex flex-col items-center justify-center transition-all duration-300 ${
        fullscreen
          ? "fixed inset-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md"
          : "w-full py-12"
      } ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="relative flex items-center justify-center mb-5">
        {/* Ambient Glow */}
        <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 blur-2xl rounded-full animate-pulse" />

        {/* Orbiting Ring */}
        <div
          className="absolute -inset-3 rounded-2xl border-2 border-dashed border-indigo-400/30 dark:border-indigo-400/20 animate-spin"
          style={{ animationDuration: "10s" }}
        />

        {/* Glowing Logo Card */}
        <div
          className={`relative ${containerSizes} bg-slate-900 dark:bg-slate-950 flex items-center justify-center shadow-2xl overflow-hidden border border-white/10 dark:border-white/5 animate-float`}
        >
          {/* Internal Radiant Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 opacity-90 animate-pulse" />

          {/* Shimmer Light Sweep */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shimmer" />

          {/* Rocket Icon */}
          <svg
            viewBox="0 0 24 24"
            className={`${iconSizes} relative z-10 text-white fill-current drop-shadow-md animate-bounce-subtle`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
            <path d="M12 16L7 18.2L12 6L17 18.2L12 16Z" fillOpacity="0.5" />
          </svg>
        </div>

        {/* Orbiting Sparkle Particle */}
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-lg shadow-amber-400/50 animate-ping" />
      </div>

      {/* Brand Text */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tighter">
          TRST<span className="text-indigo-600 dark:text-indigo-400">PREP</span>
        </span>
      </div>

      {/* Indeterminate Gradient Progress Bar */}
      <div className="w-36 sm:w-48 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden my-2.5 relative">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full w-full animate-indeterminate-bar" />
      </div>

      {/* Status Message */}
      {message && (
        <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
          {message}
        </p>
      )}
      {subtext && (
        <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 max-w-xs text-center">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default TrstprepLoading;

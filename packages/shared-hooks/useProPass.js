/**
 * useProPass Hook - Pro Pass Status Management
 *
 * Provides comprehensive Pro Pass status checking including:
 * - Active status verification with expiry check
 * - Remaining days calculation
 * - Validity period display
 * - Consistent access across all components
 */

import { useMemo } from "react";

// Injectable AuthContext — consumers pass their own useAuth or context
let _useAuth = null;

/**
 * Inject the useAuth hook from your app's AuthContext.
 * Call once at app root: initProPassAuth(useAuth)
 * @param {Function} useAuthHook - The useAuth hook from your AuthContext
 */
export function initProPassAuth(useAuthHook) {
  _useAuth = useAuthHook;
}

/**
 * Custom hook for Pro Pass status management
 * @returns {Object} Pro Pass status information
 */
export function useProPass() {
  if (!_useAuth) {
    // Gracefully degrade instead of throwing hard — allows usage without explicit init
    // for backwards compatibility and to avoid crashing the component tree.
    // Consumers should call initProPassAuth(useAuth) at app root for correct data.
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "useProPass: AuthContext not initialized. Call initProPassAuth(useAuth) at app root. Returning degraded defaults.",
      );
    }
    return {
      isProUser: false,
      isActive: false,
      isExpired: false,
      isAdmin: false,
      expiryDate: null,
      formattedExpiry: null,
      formattedStartDate: null,
      remainingDays: null,
      statusText: "Free Plan",
      urgencyLevel: "active",
      isExpiringWithin: () => false,
      isExpiringSoon: false,
      hasProPass: false,
      user: null,
    };
  }
  const { user } = _useAuth();

  // Check if user is admin - admins get unlimited access
  const isAdmin =
    user?.role === "admin" || user?.role === "superadmin" || user?.isAdmin;

  // Get Pro Pass status from multiple possible sources
  const isProUser =
    isAdmin || user?.isProUser || user?.is_pro || user?.is_pro_user || false;
  const proPassExpiry =
    user?.proPassExpiry || user?.pro_expiry || user?.proExpiry || null;
  const proPassStartDate =
    user?.proPassStartDate ||
    user?.pro_start_date ||
    user?.proStartDate ||
    user?.pro_start ||
    null;

  // For admins, show unlimited access
  const remainingDays = useMemo(() => {
    if (isAdmin) return null; // null means "unlimited" in UI
    if (!isProUser || !proPassExpiry) return null;

    const expiryDate = new Date(proPassExpiry);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }, [isAdmin, isProUser, proPassExpiry]);

  // Calculate if Pro Pass is actually active (not expired)
  const isActive = useMemo(() => {
    if (isAdmin) return true; // Admins always have active "pro" status
    if (!isProUser) return false;

    if (proPassExpiry) {
      const expiryDate = new Date(proPassExpiry);
      const now = new Date();
      return expiryDate > now;
    }

    // If isProUser is true but no expiry date, assume active
    return isProUser;
  }, [isAdmin, isProUser, proPassExpiry]);

  // Format expiry date for display
  const formattedExpiry = useMemo(() => {
    if (!proPassExpiry) return null;

    const date = new Date(proPassExpiry);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [proPassExpiry]);

  // Format start date — prefer actual start date field, fallback to expiry -1yr
  const formattedStartDate = useMemo(() => {
    if (proPassStartDate) {
      const date = new Date(proPassStartDate);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }
    if (!proPassExpiry) return null;

    const expiryDate = new Date(proPassExpiry);
    // Fallback: assume subscription started 1 year before expiry (for yearly plans)
    const startDate = new Date(expiryDate);
    startDate.setFullYear(startDate.getFullYear() - 1);

    return startDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [proPassExpiry, proPassStartDate]);

  // Get status text
  const statusText = useMemo(() => {
    if (isAdmin) return "Unlimited";
    if (!isProUser) return "Free Plan";
    if (!isActive) return "Expired";
    if (remainingDays !== null && remainingDays <= 7) return "Expiring Soon";
    return "Active";
  }, [isAdmin, isProUser, isActive, remainingDays]);

  // Get urgency level for UI styling
  const urgencyLevel = useMemo(() => {
    if (isAdmin) return "active"; // Admins always have active status
    if (!isActive) return "expired";
    if (remainingDays === null) return "active";
    if (remainingDays <= 3) return "critical";
    if (remainingDays <= 7) return "warning";
    if (remainingDays <= 30) return "notice";
    return "active";
  }, [isAdmin, isActive, remainingDays]);

  // Check if expiring within given days
  const isExpiringWithin = useMemo(() => {
    return (days) => {
      if (isAdmin) return false; // Admins never expire
      if (!isActive || remainingDays === null) return false;
      return remainingDays <= days;
    };
  }, [isAdmin, isActive, remainingDays]);

  return {
    // Core status
    isProUser,
    isActive,
    isExpired: isProUser && !isActive,
    isAdmin,

    // Date information
    expiryDate: proPassExpiry,
    formattedExpiry,
    formattedStartDate,
    remainingDays,

    // Status helpers
    statusText,
    urgencyLevel,
    isExpiringWithin,
    isExpiringSoon: remainingDays !== null && remainingDays <= 30,

    // For backward compatibility
    hasProPass: isActive,

    // Raw data
    user,
  };
}

/**
 * Format remaining days for display
 * @param {number|null} days - Number of remaining days
 * @returns {string} Formatted string
 */
export function formatRemainingDays(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day remaining";
  if (days < 7) return `${days} days remaining`;
  if (days < 30) return `${Math.floor(days / 7)} weeks remaining`;
  if (days < 365) return `${Math.floor(days / 30)} months remaining`;
  return "1 year+ remaining";
}

/**
 * Get urgency color classes based on remaining days
 * @param {string} urgencyLevel - Urgency level from useProPass
 * @returns {Object} Color classes for different UI elements
 */
export function getUrgencyColors(urgencyLevel) {
  switch (urgencyLevel) {
    case "expired":
      return {
        bg: "bg-gray-100 dark:bg-gray-800",
        text: "text-gray-600 dark:text-gray-400",
        badge: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
        border: "border-gray-300 dark:border-gray-600",
      };
    case "critical":
      return {
        bg: "bg-red-50 dark:bg-red-900/20",
        text: "text-red-600 dark:text-red-400",
        badge: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
        border: "border-red-300 dark:border-red-700",
      };
    case "warning":
      return {
        bg: "bg-amber-50 dark:bg-amber-900/20",
        text: "text-amber-600 dark:text-amber-400",
        badge:
          "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
        border: "border-amber-300 dark:border-amber-700",
      };
    case "notice":
      return {
        bg: "bg-blue-50 dark:bg-blue-900/20",
        text: "text-blue-600 dark:text-blue-400",
        badge:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
        border: "border-blue-300 dark:border-blue-700",
      };
    case "active":
    default:
      return {
        bg: "bg-green-50 dark:bg-green-900/20",
        text: "text-green-600 dark:text-green-400",
        badge:
          "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
        border: "border-green-300 dark:border-green-700",
      };
  }
}

export default useProPass;

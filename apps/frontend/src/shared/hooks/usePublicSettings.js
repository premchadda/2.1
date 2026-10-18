import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../lib/dataService.js";

const FALLBACK_SETTINGS = {
  features: {
    userRegistration: true,
    emailVerification: true,
    smsNotifications: false,
    paymentGateway: false,
    analytics: false,
    seoEnabled: false,
    demoMode: false,
  },
  maintenance: {
    enabled: false,
    message:
      "We're performing scheduled maintenance to improve your experience.",
    endTime: null,
    allowAdminAccess: true,
    estimatedDowntime: "30 minutes",
  },
  comingSoon: {},
  appearance: {
    primaryColor: "#667eea",
    secondaryColor: "#764ba2",
    theme: "light",
    fontFamily: "Inter, sans-serif",
  },
  analytics: { trackingId: null, facebookPixelId: null },
  seo: { title: "", description: "", keywords: "" },
};

/**
 * Fetches public site settings (features, maintenance, coming soon, appearance) from the backend.
 * Used by MaintenanceMode, ComingSoon pages, and feature-gated components.
 *
 * Falls back to safe defaults if the API is unreachable so the app never breaks.
 * Appearance is applied as CSS variables so the admin Appearance tab actually themes the site.
 */

function applyAppearance(appearance) {
  if (typeof document === "undefined" || !appearance) return;
  const root = document.documentElement;
  if (appearance.primaryColor)
    root.style.setProperty("--brand-primary", appearance.primaryColor);
  if (appearance.secondaryColor)
    root.style.setProperty("--brand-secondary", appearance.secondaryColor);
  if (appearance.fontFamily)
    root.style.setProperty("--font-family-base", appearance.fontFamily);
  if (appearance.theme) {
    if (appearance.theme === "dark") root.classList.add("dark");
    else if (appearance.theme === "light") root.classList.remove("dark");
    else if (appearance.theme === "auto") {
      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.classList.toggle("dark", prefersDark);
    }
  }
}

export function usePublicSettings() {
  const { data, isLoading, isSuccess, isError, error, dataUpdatedAt } =
    useQuery({
      queryKey: ["public-settings"],
      // NOTE: queryFn deliberately does NOT catch. It used to swallow every
      // error and `return FALLBACK_SETTINGS`, which made the fetch RESOLVE
      // successfully — so a real 500 was indistinguishable from "feature off",
      // and the hard-coded `maintenance.enabled: false` in the fallback silently
      // ignored an actual maintenance-mode deploy (no banner, broken site).
      // Letting it reject hands the failure to React Query, which is what makes
      // `isError` / `isDegraded` meaningful. `placeholderData` still renders the
      // safe defaults meanwhile, so the page never blanks out.
      queryFn: async () => {
        // Public settings have a safe local fallback. Do not retry an
        // unavailable backend here: an 8s timeout plus one retry made a
        // public page wait ~16s before rendering the fallback.
        const res = await api.get("/api/settings/public", { timeout: 4000 });
        return res.data?.data || FALLBACK_SETTINGS;
      },
      placeholderData: FALLBACK_SETTINGS,
      staleTime: 1000 * 60 * 10, // 10 minutes cache
      refetchInterval: false, // Don't aggressively poll every 60s
      retry: 0,
      // The fallback placeholder renders while pending; once the fetch rejects,
      // `data` is undefined. Distinguish "the server answered" from "we never
      // got an answer" instead of inferring it from the shape of the data.
      refetchOnMount: true,
      // A kill-switch must be able to turn a feature OFF. With these pinned to
      // false the very first successful response froze the flags for the whole
      // gcTime (up to 30 min, or indefinitely on a tab left open) — so an admin
      // enabling maintenance mode, or disabling a feature, had no effect on any
      // visitor who had already loaded the page once.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    });

  // `placeholderData` is also used for the error path below, so `data` is always
  // populated. Distinguish "we successfully asked the server" from "we never
  // got an answer".
  const settings = data || FALLBACK_SETTINGS;

  // A failed fetch is DEGRADED, not authoritative: `maintenance.enabled: false`
  // in the fallback is a guess, not a fact. Surface it so MaintenanceMode can
  // refuse to treat "offline" as "site is fine".
  const isDegraded = !isSuccess;

  useEffect(() => {
    applyAppearance(settings.appearance || FALLBACK_SETTINGS.appearance);
  }, [settings.appearance]);

  return {
    settings,
    isLoading,
    // ADDITIVE — existing consumers keep working unchanged.
    isSuccess,
    isError,
    isDegraded,
    settingsError: isError ? error : null,
    settingsUpdatedAt: dataUpdatedAt || null,
    // True ONLY when the server actually answered and said maintenance is on.
    // Never derived from the fallback, so a network blip cannot silence the
    // banner and a fallback cannot invent one.
    isMaintenanceMode: Boolean(
      isSuccess && settings.maintenance?.enabled === true,
    ),
    features: settings.features || FALLBACK_SETTINGS.features,
    maintenance: settings.maintenance || FALLBACK_SETTINGS.maintenance,
    comingSoon: settings.comingSoon || FALLBACK_SETTINGS.comingSoon,
    appearance: settings.appearance || FALLBACK_SETTINGS.appearance,
    analytics: settings.analytics || FALLBACK_SETTINGS.analytics,
    seo: settings.seo || FALLBACK_SETTINGS.seo,
    notifications: settings.notifications || null,
    isFeatureEnabled: (key) => Boolean(settings.features?.[key]),
    isComingSoon: (pageKey) => Boolean(settings.comingSoon?.[pageKey]?.enabled),
    getComingSoonConfig: (pageKey) => settings.comingSoon?.[pageKey] || null,
    isAnalyticsEnabled: () =>
      Boolean(
        settings.features?.analytics &&
        (settings.analytics?.trackingId || settings.analytics?.facebookPixelId),
      ),
  };
}

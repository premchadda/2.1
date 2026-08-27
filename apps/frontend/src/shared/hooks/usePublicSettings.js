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
  const { data, isLoading } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      try {
        // Public settings have a safe local fallback. Do not retry an
        // unavailable backend here: an 8s timeout plus one retry made a
        // public page wait ~16s before rendering the fallback.
        const res = await api.get("/api/settings/public", { timeout: 4000 });
        return res.data?.data || FALLBACK_SETTINGS;
      } catch (err) {
        return FALLBACK_SETTINGS;
      }
    },
    placeholderData: FALLBACK_SETTINGS,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
    retry: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const settings = data || FALLBACK_SETTINGS;

  useEffect(() => {
    applyAppearance(settings.appearance || FALLBACK_SETTINGS.appearance);
  }, [settings.appearance]);

  return {
    settings,
    isLoading,
    features: settings.features || FALLBACK_SETTINGS.features,
    maintenance: settings.maintenance || FALLBACK_SETTINGS.maintenance,
    comingSoon: settings.comingSoon || FALLBACK_SETTINGS.comingSoon,
    appearance: settings.appearance || FALLBACK_SETTINGS.appearance,
    analytics: settings.analytics || FALLBACK_SETTINGS.analytics,
    seo: settings.seo || FALLBACK_SETTINGS.seo,
    notifications: settings.notifications || null,
    isMaintenanceMode: Boolean(settings.maintenance?.enabled),
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

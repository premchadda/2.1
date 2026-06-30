import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/dataService.js'

const FALLBACK_SETTINGS = {
  features: {
    userRegistration: true,
    emailVerification: true,
    smsNotifications: false,
    paymentGateway: true,
    analytics: true,
    seoEnabled: true,
    demoMode: false,
  },
  maintenance: {
    enabled: false,
    message: "We're performing scheduled maintenance to improve your experience.",
    endTime: null,
    allowAdminAccess: true,
    estimatedDowntime: '30 minutes',
  },
  comingSoon: {},
}

/**
 * Fetches public site settings (features, maintenance, coming soon) from the backend.
 * Used by MaintenanceMode, ComingSoon pages, and feature-gated components.
 *
 * Falls back to safe defaults if the API is unreachable so the app never breaks.
 */
export function usePublicSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-settings'],
    queryFn: async () => {
      const res = await api.get('/api/settings/public')
      return res.data?.data || FALLBACK_SETTINGS
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
    retry: 2,
    refetchOnMount: true,
  })

  const settings = data || FALLBACK_SETTINGS

  return {
    settings,
    isLoading,
    features: settings.features || FALLBACK_SETTINGS.features,
    maintenance: settings.maintenance || FALLBACK_SETTINGS.maintenance,
    comingSoon: settings.comingSoon || FALLBACK_SETTINGS.comingSoon,
    isMaintenanceMode: Boolean(settings.maintenance?.enabled),
    isFeatureEnabled: (key) => Boolean(settings.features?.[key]),
    isComingSoon: (pageKey) => Boolean(settings.comingSoon?.[pageKey]?.enabled),
    getComingSoonConfig: (pageKey) => settings.comingSoon?.[pageKey] || null,
  }
}
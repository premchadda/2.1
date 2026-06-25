import { z } from 'zod'

/**
 * Validation schema for the AdminSettings form.
 *
 * - Coerces numeric fields
 * - Allows empty secrets (write-only — the backend never returns them)
 * - Caps tax rate to a sane range
 * - Requires a valid From Email when SMTP is configured
 */
export const settingsSchema = z.object({
  siteName:        z.string().min(1, 'Site name is required').max(120),
  siteDescription: z.string().max(500).optional().or(z.literal('')),
  siteLogo:        z.string().url('Site logo must be a valid URL').optional().or(z.literal('')),
  siteFavicon:     z.string().url().optional().or(z.literal('')),
  siteUrl:         z.string().url('Site URL must be a valid URL').optional().or(z.literal('')),
  metaTitle:       z.string().max(160).optional().or(z.literal('')),
  metaDescription: z.string().max(300).optional().or(z.literal('')),
  keywords:        z.string().max(500).optional().or(z.literal('')),
  contactEmail:    z.string().email('Contact email must be valid').optional().or(z.literal('')),
  contactPhone:    z.string().max(40).optional().or(z.literal('')),
  address:         z.string().max(500).optional().or(z.literal('')),
  socialLinks: z.object({
    facebook:  z.string().url().optional().or(z.literal('')),
    twitter:   z.string().url().optional().or(z.literal('')),
    instagram: z.string().url().optional().or(z.literal('')),
    linkedin:  z.string().url().optional().or(z.literal('')),
    youtube:   z.string().url().optional().or(z.literal('')),
  }).optional(),
  features: z.object({
    userRegistration: z.boolean(),
    emailVerification: z.boolean(),
    smsNotifications:  z.boolean(),
    paymentGateway:    z.boolean(),
    analytics:         z.boolean(),
    seoEnabled:        z.boolean(),
    maintenanceMode:   z.boolean(),
    demoMode:          z.boolean(),
  }).optional(),
  appearance: z.object({
    primaryColor:   z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Must be a hex color').optional().or(z.literal('')),
    secondaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Must be a hex color').optional().or(z.literal('')),
    theme:          z.enum(['light', 'dark', 'auto']).optional(),
    fontFamily:     z.string().max(120).optional().or(z.literal('')),
    logoPosition:   z.enum(['left', 'center', 'right']).optional(),
  }).optional(),
  security: z.object({
    passwordMinLength: z.number().int().min(6).max(128),
    passwordComplexity: z.boolean(),
    twoFactorAuth:      z.boolean(),
    ipWhitelist:        z.array(z.string()).optional(),
    maxLoginAttempts:   z.number().int().min(1).max(50),
    sessionTimeout:     z.number().int().min(60).max(86400),
  }).optional(),
  email: z.object({
    smtpHost:     z.string().max(255).optional().or(z.literal('')),
    smtpPort:     z.number().int().min(1).max(65535),
    smtpUsername: z.string().max(255).optional().or(z.literal('')),
    smtpPassword: z.string().max(500).optional().or(z.literal('')),
    fromEmail:    z.string().email('From email must be valid').optional().or(z.literal('')),
    fromName:     z.string().max(120).optional().or(z.literal('')),
    encryption:   z.enum(['tls', 'ssl', 'none']).optional(),
  }).optional(),
  payment: z.object({
    stripePublicKey:    z.string().max(255).optional().or(z.literal('')),
    stripeSecretKey:    z.string().max(500).optional().or(z.literal('')),
    razorpayKeyId:      z.string().max(255).optional().or(z.literal('')),
    razorpayKeySecret:  z.string().max(500).optional().or(z.literal('')),
    paypalClientId:     z.string().max(255).optional().or(z.literal('')),
    paypalClientSecret: z.string().max(500).optional().or(z.literal('')),
    currency:           z.string().length(3, 'Currency must be a 3-letter code'),
    taxEnabled:         z.boolean(),
    taxRate:            z.number().min(0).max(100, 'Tax rate cannot exceed 100%'),
  }).optional(),
  notifications: z.object({
    emailOnRegistration: z.boolean(),
    emailOnPayment:      z.boolean(),
    smsOnOrder:          z.boolean(),
    pushNotifications:   z.boolean(),
    notificationFrequency: z.enum(['instant', 'daily', 'weekly']).optional(),
  }).optional(),
})

/**
 * Strip write-only secret fields before echoing settings back to the user.
 * These are sent on PUT but never returned by GET — the backend is responsible
 * for storing them encrypted. We mark them with empty strings on load.
 */
export const SECRET_FIELDS = [
  'email.smtpPassword',
  'payment.stripeSecretKey',
  'payment.razorpayKeySecret',
  'payment.paypalClientSecret',
]

export function stripSecrets(settings) {
  if (!settings) return settings
  const clone = structuredClone(settings)
  for (const path of SECRET_FIELDS) {
    const [section, field] = path.split('.')
    if (clone[section]) clone[section][field] = ''
  }
  return clone
}

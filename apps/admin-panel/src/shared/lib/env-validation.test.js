// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest'
import { validateEnvVars } from './env-validation.js'

describe('env-validation', () => {
  test('returns true when required env vars are present', () => {
    // Production requires API, admin-site, backend, and socket URLs.
    import.meta.env.VITE_API_URL = 'http://localhost:5001'
    import.meta.env.VITE_ADMIN_SITE_URL = 'http://localhost:3002'
    import.meta.env.VITE_BACKEND_URL = 'http://localhost:5001'
    import.meta.env.VITE_SOCKET_URL = 'http://localhost:5001'
    expect(validateEnvVars()).toBe(true)
  })

  test('returns false (warning only) when required env vars are missing in dev', () => {
    import.meta.env.VITE_API_URL = ''
    import.meta.env.VITE_ADMIN_SITE_URL = ''
    // Should NOT throw, just warn
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(validateEnvVars()).toBe(false)
    warn.mockRestore()
  })
})

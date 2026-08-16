import { ValidationError } from '@trstprep/shared-config'
import { apiClient } from '../apiClient.js'

export const authAPI = {
  login: (email, password) => {
    if (!email || !password) {
      throw new ValidationError('Email and password are required')
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ValidationError('Please enter a valid email address')
    }
    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters')
    }
    return apiClient.post('/auth/login', { email, password })
  },
  register: (data) => {
    const required = ['name', 'email', 'password']
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`${field} is required`)
      }
    }
    if (!/^\S+@\S+\.\S+$/.test(data.email)) {
      throw new ValidationError('Please enter a valid email address')
    }
    if (data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters')
    }
    return apiClient.post('/auth/register', data)
  },
  logout: () => apiClient.post('/auth/logout'),
  revokeOtherSessions: () => apiClient.delete('/sessions'),
  getMe: () => apiClient.get('/auth/me'),
  refreshToken: () => apiClient.post('/auth/refresh'),
  // Two-factor authentication (TOTP) management
  twoFactorStatus: () => apiClient.get('/auth/2fa/status'),
  twoFactorEnroll: () => apiClient.post('/auth/2fa/enroll'),
  twoFactorVerify: (token) => apiClient.post('/auth/2fa/verify', { token }),
  twoFactorRegenerateBackupCodes: () => apiClient.post('/auth/2fa/backup-codes/regenerate'),
  twoFactorDisable: () => apiClient.post('/auth/2fa/disable'),
}

export default authAPI

import { apiClient, ValidationError } from './apiClient.js'

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
    return apiClient.post('/api/auth/login', { email, password })
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
    return apiClient.post('/api/auth/register', data)
  },
  logout: () => apiClient.post('/api/auth/logout'),
  getMe: () => apiClient.get('/api/auth/me'),
  refreshToken: () => apiClient.post('/api/auth/refresh'),
  changePassword: (currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current and new password are required')
    }
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters')
    }
    return apiClient.post('/api/auth/change-password', { currentPassword, newPassword })
  },
}

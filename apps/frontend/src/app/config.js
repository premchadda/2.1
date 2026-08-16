// App Configuration
import { API_BASE_URL } from '../shared/lib/apiBase.js'

export const APP_CONFIG = {
  NAME: 'Trstprep',
  DESCRIPTION: 'India\'s #1 Platform for SSC & Railway Exam Preparation',
  VERSION: '2.1.0',
  
  // API Configuration
  API: {
    BASE_URL: `${API_BASE_URL}/api`,
    TIMEOUT: 10000
  },
  
  // Authentication
  AUTH: {
    TOKEN_KEY: 'trstprep_token',
    USER_KEY: 'trstprep_user'
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  },
  
  // File Upload
  UPLOAD: {
    // M26: 10MB cap (was 500MB — a DoS vector). Tune via VITE_MAX_FILE_SIZE_MB.
    MAX_FILE_SIZE: (Number(import.meta.env.VITE_MAX_FILE_SIZE_MB) || 10) * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf']
  },
  
  // Colors
  COLORS: {
    BRAND_START: '#3B82F6',
    BRAND_END: '#8B5CF6',
    SUCCESS: '#10B981',
    WARNING: '#F59E0B',
    ERROR: '#EF4444',
    INFO: '#3B82F6'
  }
};
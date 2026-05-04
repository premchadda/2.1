/**
 * React Query Global Client
 * Allows queryClient to be accessed from non-React contexts (like WebSocket listeners)
 */

import { QueryClient } from '@tanstack/react-query'
import { logger } from '@trstprep/shared-config'

let queryClient = null

export const setQueryClient = (client) => {
  queryClient = client
  logger.debug('React Query client registered for global access')
}

export const getQueryClient = () => {
  if (!queryClient) {
    logger.warn('Query client not set yet - WebSocket events may not be able to invalidate queries')
  }
  return queryClient
}

export default {
  setQueryClient,
  getQueryClient
}

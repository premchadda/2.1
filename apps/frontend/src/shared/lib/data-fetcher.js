/**
 * Data Fetcher - Generic fetch wrapper with caching, retry logic, and loading state
 * 
 * Provides intelligent data fetching with:
 * - Cache integration
 * - Retry with exponential backoff
 * - Loading state management
 * - Error handling
 */

import cache from './cache.js'
import { ValidationError, AuthenticationError, NetworkError } from './errors.js'

/**
 * Intelligent Data Service class
 */
class DataFetcher {
  constructor() {
    this.loadingStates = new Map() // Track loading states to prevent duplicate requests
    this.retryAttempts = new Map() // Track retry attempts
    this.maxRetries = 3
  }

  /**
   * Generic fetch with caching and loading state management
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data
   * @param {Object} options - Fetch options
   * @returns {Promise<*>} Fetched data
   */
  async fetchWithCache(key, fetchFn, options = {}) {
    const { 
      forceRefresh = false, 
      ttl = cache.defaultTTL, 
      useCache = true,
      retries = this.maxRetries,
      retryDelay = 1000
    } = options
    
    // Return cached data if available and not forcing refresh
    if (useCache && !forceRefresh) {
      const cached = cache.get(key)
      if (cached !== null) {
        return cached
      }
    }
    
    // Prevent duplicate requests
    if (this.loadingStates.get(key)) {
      // Wait for existing request to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      return this.fetchWithCache(key, fetchFn, options)
    }
    
    // Retry logic
    let lastError
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.loadingStates.set(key, true)
        
        const data = await fetchFn()
        
        if (useCache) {
          cache.set(key, data, ttl)
        }
        
        // Reset retry counter on success
        this.retryAttempts.delete(key)
        return data
      } catch (error) {
        lastError = error
        
        // Don't retry on validation or auth errors
        if (error instanceof ValidationError || error instanceof AuthenticationError) {
          throw error
        }
        
        // Don't retry on last attempt
        if (attempt === retries) {
          break
        }
        
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      } finally {
        this.loadingStates.delete(key)
      }
    }
    
    throw lastError
  }

  /**
   * Clear cache for specific endpoints matching pattern
   * @param {string} endpointPattern - URL pattern to match
   */
  clearCacheForEndpoint(endpointPattern) {
    const keysToDelete = []
    for (const key of cache.cache.keys()) {
      if (key.includes(endpointPattern)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => cache.delete(key))
  }

  /**
   * Clear all cache
   */
  clearCache() {
    cache.clear()
  }

  /**
   * Handle mutations (clear cache after successful operations)
   * @param {Function} mutationFn - Async mutation function
   * @param {string[]} affectedEndpoints - Endpoints whose cache should be cleared
   * @returns {Promise<*>} Mutation result
   */
  async handleMutation(mutationFn, affectedEndpoints = []) {
    const result = await mutationFn()
    affectedEndpoints.forEach(endpoint => {
      this.clearCacheForEndpoint(endpoint)
    })
    this.clearCacheForEndpoint('/admin/')
    this.clearCacheForEndpoint('/study')
    return result
  }

  /**
   * Force refresh specific data type
   * @param {string} dataType - Type of data to refresh
   * @param {Object} dataFetchers - Map of data types to fetch functions
   * @returns {Promise<*>} Refreshed data
   */
  async refreshData(dataType, dataFetchers) {
    const fetcher = dataFetchers[dataType]
    if (fetcher) {
      return await fetcher({ forceRefresh: true })
    }
    throw new ValidationError(`Unknown data type: ${dataType}`)
  }

  /**
   * Force refresh all cached data
   * @param {Object} dataFetchers - Map of data types to fetch functions
   * @returns {Promise<void>}
   */
  async forceRefreshAll(dataFetchers) {
    this.clearCache()
    const fetchPromises = Object.values(dataFetchers).map(fetcher => 
      fetcher({ forceRefresh: true })
    )
    await Promise.allSettled(fetchPromises)
  }
}

export const dataFetcher = new DataFetcher()
export default dataFetcher
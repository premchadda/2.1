import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../lib/dataService'

export function useTests() {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await adminAPI.getTests()
        if (!cancelled) setTests(res.data?.data || [])
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to fetch tests')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  return { tests, loading, error, refetch }
}

export default useTests

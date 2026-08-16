import { useState, useEffect } from 'react'
import { adminAPI } from '../lib/dataService'

let cachedSubjects = null
let inFlightPromise = null
let lastFetchedAt = 0
const CACHE_TTL_MS = 60_000

export function useSubjects() {
  const [subjects, setSubjects] = useState(() => cachedSubjects || [])
  const [loading, setLoading] = useState(() => !cachedSubjects)

  useEffect(() => {
    let mounted = true
    const now = Date.now()

    if (cachedSubjects && now - lastFetchedAt < CACHE_TTL_MS) {
      setSubjects(cachedSubjects)
      setLoading(false)
      return
    }

    if (!inFlightPromise) {
      inFlightPromise = adminAPI.apiClient
        .get('/admin/subjects')
        .then((res) => {
          const data = res.data?.success ? res.data.data : []
          const mapped = data.map((s) => ({
            id: String(s.id || s._id),
            label: s.name || s.title || 'Untitled',
            icon: s.icon || '📚',
            color: s.color || '#f59e0b',
          }))
          cachedSubjects = mapped
          lastFetchedAt = Date.now()
          return mapped
        })
        .catch((e) => {
          console.error('Failed to fetch subjects:', e)
          return []
        })
        .finally(() => {
          inFlightPromise = null
        })
    }

    inFlightPromise.then((data) => {
      if (mounted) {
        setSubjects(data)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  return { subjects, loading }
}
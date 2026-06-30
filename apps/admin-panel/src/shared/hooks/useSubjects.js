import { useState, useEffect } from 'react'
import { adminAPI } from '../lib/dataService'

export function useSubjects() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await adminAPI.apiClient.get('/admin/subjects')
        const data = res.data?.success ? res.data.data : []
        if (!mounted) return
        setSubjects(
          data.map(s => ({
            id: String(s.id || s._id),
            label: s.name || s.title || 'Untitled',
            icon: s.icon || '📚',
            color: s.color || '#f59e0b',
          }))
        )
      } catch (e) {
        console.error('Failed to fetch subjects:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return { subjects, loading }
}
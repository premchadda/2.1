import { useStages as useStagesBase } from '@trstprep/shared-hooks'
import { adminAPI } from '../lib/dataService.js'

export function useStages(options = {}) {
  // Pass the axios instance (adminAPI.apiClient), not the adminAPI wrapper,
  // so shared hooks send cookies through the same-origin proxy instead of a
  // cookie-less cross-origin fetch to localhost:5001 (which 401s and logs out).
  return useStagesBase({ apiClient: adminAPI.apiClient, ...options })
}

export default useStages
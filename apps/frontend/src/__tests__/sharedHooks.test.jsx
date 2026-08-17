import { describe, it, expect, vi } from 'vitest'
import { setSharedApiClient, getSharedApiClient, useStages } from '@trstprep/shared-hooks'
import { renderHook, waitFor, act } from '@testing-library/react'

describe('Shared Hooks API Client & Interceptors', () => {
  it('should allow setting and getting the global API client instance', () => {
    const mockClient = { get: vi.fn() }
    setSharedApiClient(mockClient)
    expect(getSharedApiClient()).toBe(mockClient)
  })

  it('should fall back to the globally configured API client when hook is executed', async () => {
    const mockData = { success: true, data: [{ id: 1, name: 'Stage 1' }] }
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: mockData })
    }

    setSharedApiClient(mockClient)

    const { result } = renderHook(() => useStages())

    await act(async () => {
      result.current.fetchStages()
    })

    await waitFor(() => {
      expect(mockClient.get).toHaveBeenCalledWith('/api/stages')
      expect(result.current.stages).toEqual(mockData.data)
    })
  })
})

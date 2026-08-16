import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adaptiveDifficultyAPI } from '../lib/adaptiveDifficultyAPI'

/**
 * useAdaptiveDifficulty – React Query hook for adaptive difficulty.
 *
 * @param {number|null} topicId – current topic (null to disable fetching)
 * @returns {{
 *   score: number|null,
 *   level: 'easy'|'medium'|'hard'|null,
 *   totalAttempts: number,
 *   recentAccuracy: number,
 *   isLoading: boolean,
 *   submitPerformance: (correct: boolean, timeSpent?: number) => Promise,
 *   isSubmitting: boolean,
 *   resetDifficulty: () => Promise,
 * }}
 */
export function useAdaptiveDifficulty(topicId) {
  const queryClient = useQueryClient()

  // ── Query: fetch current difficulty ──
  const {
    data,
    isLoading,
    refetch: _refetch,
  } = useQuery({
    queryKey: ['adaptive-difficulty', topicId],
    queryFn: () => adaptiveDifficultyAPI.getDifficulty(topicId),
    // Guard against both null and undefined — questions may not be loaded yet,
    // causing topicId to be undefined, which produced /api/adaptive-difficulty/undefined
    enabled: topicId != null,
    staleTime: 30_000,
    retry: 1,
  })

  // ── Mutation: submit performance ──
  const submitMutation = useMutation({
    mutationFn: ({ correct, timeSpent }) =>
      adaptiveDifficultyAPI.submitPerformance({ topicId, correct, timeSpent }),
    onSuccess: (newData) => {
      // Optimistically update the cache
      queryClient.setQueryData(['adaptive-difficulty', topicId], newData)
    },
    onError: (err) => {
      console.error('[useAdaptiveDifficulty] submit failed:', err.message)
    },
  })

  // ── Mutation: reset difficulty ──
  const resetMutation = useMutation({
    mutationFn: () => adaptiveDifficultyAPI.resetDifficulty(topicId),
    onSuccess: (newData) => {
      queryClient.setQueryData(['adaptive-difficulty', topicId], newData)
    },
  })

  const submitPerformance = useCallback(
    (correct, timeSpent = 0) =>
      submitMutation.mutateAsync({ correct, timeSpent }),
    [submitMutation]
  )

  const resetDifficulty = useCallback(
    () => resetMutation.mutateAsync(),
    [resetMutation]
  )

  return {
    score: data?.score ?? null,
    level: data?.level ?? null,
    totalAttempts: data?.totalAttempts ?? 0,
    recentAccuracy: data?.recentAccuracy ?? 0,
    isLoading: topicId != null && isLoading,
    submitPerformance,
    isSubmitting: submitMutation.isPending,
    resetDifficulty,
  }
}

/**
 * useAdaptiveDifficultyBatch – fetch difficulties for multiple topics.
 * @param {number[]} topicIds
 */
export function useAdaptiveDifficultyBatch(topicIds = []) {
  const { data, isLoading } = useQuery({
    queryKey: ['adaptive-difficulty-batch', ...[...topicIds].sort()],
    queryFn: () => adaptiveDifficultyAPI.getBatchDifficulties(topicIds),
    enabled: topicIds.length > 0,
    staleTime: 60_000,
  })

  return {
    difficulties: data ?? [],
    isLoading,
  }
}

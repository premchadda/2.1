import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../lib/dataService";

/**
 * useTestPolicy — Unified hook to consume authoritative backend test permissions.
 *
 * Exposes single-source-of-truth booleans:
 * - canStart, canResume, canSubmit, canViewResult, canReview
 * - isLiveSolutionLocked, reattempt policy breakdown
 * - code, message, effectivePlan
 *
 * @param {string|number} testId
 * @returns {Object} { policy, loading, error, refetch, canStart, canResume, isPro, isLiveSolutionLocked }
 */
export function useTestPolicy(testId) {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(Boolean(testId));
  const [error, setError] = useState(null);

  const fetchPolicy = useCallback(async () => {
    if (!testId) {
      setPolicy(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/tests/${testId}/policy`);
      if (res.data?.success && res.data?.data) {
        setPolicy(res.data.data);
      } else {
        setPolicy(null);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load test policy",
      );
      // If error status is 403 or 404, capture code
      if (err?.response?.data) {
        setPolicy(err.response.data);
      }
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  return {
    policy,
    loading,
    error,
    refetch: fetchPolicy,
    canStart: Boolean(policy?.canStart),
    canResume: Boolean(policy?.canResume),
    canSubmit: Boolean(policy?.canSubmit),
    canReview: Boolean(policy?.canReview),
    canViewResult: Boolean(policy?.canViewResult),
    isLiveSolutionLocked: Boolean(policy?.isLiveSolutionLocked),
    canReattempt: policy?.canReattempt || {
      full: false,
      wrong: false,
      unattempted: false,
      slow: false,
      smart: false,
    },
    isPro: Boolean(policy?.isPro),
    isAdmin: Boolean(policy?.isAdmin),
    effectivePlan: policy?.effectivePlan || "GUEST",
    code: policy?.code || null,
    message: policy?.message || null,
  };
}

export default useTestPolicy;

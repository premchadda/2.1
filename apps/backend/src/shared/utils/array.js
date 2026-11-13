// Shared array utilities for the backend.
import { randomInt } from "crypto";

/**
 * Cryptographically-unbiased in-place-safe Fisher-Yates shuffle.
 * Returns a new array; the input is not mutated.
 *
 * Implemented here (shared/utils) instead of the services layer so any
 * module can reuse it — previously kept in SubscriptionService.js purely
 * to avoid cross-module churn.
 */
export function fisherYatesShuffle(arr) {
  const copy = [...(arr || [])];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

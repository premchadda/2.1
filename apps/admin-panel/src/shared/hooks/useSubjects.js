import { useState, useEffect, useCallback } from "react";
import { adminAPI } from "../lib/dataService";

let cachedSubjects = null;
let inFlightPromise = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60_000;

function toSubjectList(data) {
  const list = Array.isArray(data) ? data : [];
  return list.map((s) => ({
    id: String(s.id || s._id),
    label: s.name || s.title || "Untitled",
    icon: s.icon || "📚",
    color: s.color || "#f59e0b",
  }));
}

// Shared fetch with dedup: concurrent hook instances reuse one in-flight
// request. Success refreshes the module cache; failure propagates to callers
// so they can surface an error WITHOUT caching [] as truth.
function startSubjectsFetch() {
  if (!inFlightPromise) {
    inFlightPromise = adminAPI.apiClient
      .get("/admin/subjects")
      .then((res) => {
        const data = res.data?.success ? res.data.data : [];
        const mapped = toSubjectList(data);
        cachedSubjects = mapped;
        lastFetchedAt = Date.now();
        return mapped;
      })
      .finally(() => {
        inFlightPromise = null;
      });
  }
  return inFlightPromise;
}

// Test-only reset so vitest cases don't leak module cache across tests.
export function resetSubjectsCacheForTests() {
  cachedSubjects = null;
  inFlightPromise = null;
  lastFetchedAt = 0;
}

export function useSubjects() {
  const [subjects, setSubjects] = useState(() => cachedSubjects || []);
  const [loading, setLoading] = useState(() => !cachedSubjects);
  const [error, setError] = useState(null);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const now = Date.now();

    if (cachedSubjects && now - lastFetchedAt < CACHE_TTL_MS) {
      setSubjects(cachedSubjects);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    startSubjectsFetch().then(
      (data) => {
        if (mounted) {
          setSubjects(data);
          setError(null);
          setLoading(false);
        }
      },
      (e) => {
        if (mounted) {
          console.error("Failed to fetch subjects:", e);
          // Keep previously cached subjects (or [] only if never loaded) —
          // never present an error-shaped [] as truth.
          setSubjects(cachedSubjects || []);
          setError(e);
          setLoading(false);
        }
      },
    );

    return () => {
      mounted = false;
    };
  }, [refetchKey]);

  const retry = useCallback(() => {
    inFlightPromise = null;
    lastFetchedAt = 0;
    setError(null);
    setRefetchKey((k) => k + 1);
  }, []);

  return { subjects, loading, error, retry };
}

import { useState, useEffect, useCallback } from "react";
import { getSharedApiClient, request } from "./apiClientConfig.js";

// Canonical error classes from @trstprep/shared-config via relative import
// (no hard dep in package.json — NO package.json edits allowed). Guarded use
// below degrades to the bare-Error shape when the module is unresolvable.
import {
  ValidationError as SharedValidationError,
  AuthenticationError as SharedAuthenticationError,
  ForbiddenError as SharedForbiddenError,
  NotFoundError as SharedNotFoundError,
  RateLimitError as SharedRateLimitError,
} from "../shared-config/src/errors.js";

// Request delegation: ALL requests go through the shared `request()` helper in
// apiClientConfig.js, which respects the passed/global API client and otherwise
// falls back to fetch with cookies/CSRF + env-derived base URL (never a
// hardcoded host). There is deliberately NO local getBaseUrl/readCsrfToken/
// fallbackFetch here — a single fallback implementation lives in
// apiClientConfig.js.
// NOTE: callers surface an explicit, actionable error (via setError) when this
// fallback path is taken or fails — never a silent 401 or empty list.
function warnMissingClient(caller) {
  if (typeof console !== "undefined" && console.warn) {
    console.warn(
      `${caller}: no API client configured (passed apiClient + getSharedApiClient() both null). ` +
        "Falling back to fetch with cookies/CSRF. Call setSharedApiClient(apiClient) at app root for correct auth.",
    );
  }
}

// Typed error mapping — mirrors apiClientConfig.toTypedError so non-typed
// rejections (network failures, legacy client errors) normalize identically:
// 400 -> ValidationError, 401 -> AuthenticationError, 403 -> ForbiddenError,
// 404 -> NotFoundError, 429 -> RateLimitError (carries retryAfter).
// request() already throws these shapes; this only normalizes anything else.
function toStagesError(status, message, details, retryAfter = null) {
  const msg =
    message || `Request failed${status ? ` with status ${status}` : ""}`;
  const body = details ?? null;
  let err = null;
  if (status === 400 && SharedValidationError) {
    err = new SharedValidationError(msg, body);
  } else if (status === 401 && SharedAuthenticationError) {
    err = new SharedAuthenticationError(msg, body);
  } else if (status === 403 && SharedForbiddenError) {
    err = new SharedForbiddenError(msg, body);
  } else if (status === 404 && SharedNotFoundError) {
    err = new SharedNotFoundError(msg, body);
  } else if (status === 429 && SharedRateLimitError) {
    err = new SharedRateLimitError(msg, body, retryAfter ?? null);
  }
  if (err) {
    if (err.status == null) err.status = status;
    if (err.code == null) {
      const codeByStatus = {
        400: "VALIDATION_ERROR",
        401: "AUTHENTICATION_ERROR",
        403: "FORBIDDEN_ERROR",
        404: "NOT_FOUND_ERROR",
        429: "RATE_LIMIT_ERROR",
      };
      err.code = (status && codeByStatus[status]) || "STAGES_ERROR";
    }
    if (status === 429 && retryAfter != null && err.retryAfter == null) {
      err.retryAfter = retryAfter;
    }
    return err;
  }
  // Bare-Error fallback (shared-config unresolvable or unknown status).
  const fallback = new Error(msg);
  fallback.name =
    (status === 400 && "ValidationError") ||
    (status === 401 && "AuthenticationError") ||
    (status === 403 && "ForbiddenError") ||
    (status === 404 && "NotFoundError") ||
    (status === 429 && "RateLimitError") ||
    "DataError";
  fallback.code = status ? `HTTP_${status}` : "STAGES_ERROR";
  fallback.status = status ?? null;
  fallback.details = body;
  if (status === 429) fallback.retryAfter = retryAfter ?? null;
  return fallback;
}

function toActionableError(err, caller) {
  const status = err?.status ?? err?.response?.status ?? null;
  if (err?.code || (err?.name && err.name !== "Error")) {
    // Already typed by request()/toTypedError — surface the server message.
    const base = err.message || "Request failed";
    if (/not configured|localhost in production/i.test(base)) return base;
    return `${base} (${caller}: if unauthenticated, call setSharedApiClient(apiClient) at app root.)`;
  }
  const retryAfter =
    err?.retryAfter ??
    err?.response?.headers?.["retry-after"] ??
    err?.response?.headers?.["Retry-After"] ??
    null;
  const typed = toStagesError(
    status,
    err?.response?.data?.message || err?.message,
    err?.response?.data ?? null,
    retryAfter,
  );
  return `${typed.message} (${caller}: if unauthenticated, call setSharedApiClient(apiClient) at app root.)`;
}

// Abort note: every fetcher/CRUD below accepts an optional trailing options
// argument — either an AbortSignal directly or `{ signal }` — forwarded into
// request() options (apiClientConfig.request threads `signal` to the
// underlying axios client / fetch fallback). Aborted requests reject; list
// fetchers surface via setError, single-entity helpers keep their null/[]
// return shape while also setting error state.
function resolveSignal(optionsOrSignal) {
  if (!optionsOrSignal) return undefined;
  if (
    typeof AbortSignal !== "undefined" &&
    optionsOrSignal instanceof AbortSignal
  ) {
    return optionsOrSignal;
  }
  return optionsOrSignal.signal ?? undefined;
}

// Canonical entity key: _id → public_id/publicId → id so public identifiers
// win over internal numeric ids (matches useGenericCRUD getItemKey).
function getStageKey(item) {
  if (!item) return null;
  return item._id ?? item.public_id ?? item.publicId ?? item.id ?? null;
}

export function useStages(options = {}) {
  const { apiClient: passedClient = null, preferAdminCounts = false } = options;
  const apiClient = passedClient || getSharedApiClient();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all active stages
  const fetchStages = useCallback(
    async (optionsOrSignal = {}) => {
      setLoading(true);
      setError(null);
      try {
        const url = preferAdminCounts
          ? "/admin/stages/with-test-counts"
          : "/stages";
        if (!apiClient) warnMissingClient("useStages.fetchStages");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request("GET", url, null, {
          apiClient,
          ...(signal ? { signal } : {}),
        });
        if (data.success) {
          setStages(data.data);
        } else {
          setError(data.message || "Failed to fetch stages");
        }
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchStages"));
      } finally {
        setLoading(false);
      }
    },
    [apiClient, preferAdminCounts],
  );

  // Fetch stages with their categories
  const fetchStagesWithCategories = useCallback(
    async (optionsOrSignal = {}) => {
      setLoading(true);
      setError(null);
      try {
        const url = "/stages/with-categories";
        if (!apiClient)
          warnMissingClient("useStages.fetchStagesWithCategories");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request("GET", url, null, {
          apiClient,
          ...(signal ? { signal } : {}),
        });
        if (data.success) {
          return data.data;
        } else {
          setError(data.message || "Failed to fetch stages with categories");
          return [];
        }
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchStagesWithCategories"));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [apiClient],
  );

  // Fetch stages with test counts
  const fetchStagesWithTestCounts = useCallback(
    async (optionsOrSignal = {}) => {
      setLoading(true);
      setError(null);
      try {
        const url = "/stages/with-test-counts";
        if (!apiClient)
          warnMissingClient("useStages.fetchStagesWithTestCounts");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request("GET", url, null, {
          apiClient,
          ...(signal ? { signal } : {}),
        });
        if (data.success) {
          return data.data;
        } else {
          setError(data.message || "Failed to fetch stages with test counts");
          return [];
        }
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchStagesWithTestCounts"));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [apiClient],
  );

  // Sync individual fetched stages to the global list
  const updateLocalStage = useCallback((updatedStage) => {
    if (!updatedStage) return;
    const stageKey = getStageKey(updatedStage);
    if (stageKey == null) return;
    const searchId = String(stageKey);
    setStages((prev) => {
      const index = prev.findIndex((s) => {
        const key = getStageKey(s);
        return key != null && String(key) === searchId;
      });
      if (index >= 0) {
        const newStages = [...prev];
        newStages[index] = { ...newStages[index], ...updatedStage };
        return newStages;
      }
      return [...prev, updatedStage];
    });
  }, []);

  // Fetch a single stage by ID
  const fetchStageById = useCallback(
    async (id, optionsOrSignal = {}) => {
      try {
        if (!apiClient) warnMissingClient("useStages.fetchStageById");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request("GET", `/stages/${id}`, null, {
          apiClient,
          ...(signal ? { signal } : {}),
        });
        if (data.success) {
          updateLocalStage(data.data);
          return data.data;
        }
        setError(data.message || "Failed to fetch stage");
        return null;
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchStageById"));
        return null;
      }
    },
    [apiClient, updateLocalStage],
  );

  // Fetch a stage by slug
  const fetchStageBySlug = useCallback(
    async (slug, optionsOrSignal = {}) => {
      try {
        if (!apiClient) warnMissingClient("useStages.fetchStageBySlug");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request("GET", `/stages/slug/${slug}`, null, {
          apiClient,
          ...(signal ? { signal } : {}),
        });
        if (data.success) {
          updateLocalStage(data.data);
          return data.data;
        }
        setError(data.message || "Failed to fetch stage by slug");
        return null;
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchStageBySlug"));
        return null;
      }
    },
    [apiClient, updateLocalStage],
  );

  // Fetch categories for a specific stage
  const fetchCategoriesForStage = useCallback(
    async (stageId, optionsOrSignal = {}) => {
      try {
        if (!apiClient) warnMissingClient("useStages.fetchCategoriesForStage");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request(
          "GET",
          `/stages/${stageId}/categories`,
          null,
          {
            apiClient,
            ...(signal ? { signal } : {}),
          },
        );
        if (data.success) {
          return data.data;
        }
        setError(data.message || "Failed to fetch categories for stage");
        return [];
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchCategoriesForStage"));
        return [];
      }
    },
    [apiClient],
  );

  // Fetch categories for a specific stage as tree
  const fetchCategoryTreeForStage = useCallback(
    async (stageId, optionsOrSignal = {}) => {
      try {
        if (!apiClient)
          warnMissingClient("useStages.fetchCategoryTreeForStage");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request(
          "GET",
          `/stages/${stageId}/categories/tree`,
          null,
          {
            apiClient,
            ...(signal ? { signal } : {}),
          },
        );
        if (data.success) {
          return data.data;
        }
        setError(data.message || "Failed to fetch category tree for stage");
        return [];
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchCategoryTreeForStage"));
        return [];
      }
    },
    [apiClient],
  );

  // Fetch tests for a specific stage
  const fetchTestsForStage = useCallback(
    async (stageId, optionsOrSignal = {}) => {
      try {
        if (!apiClient) warnMissingClient("useStages.fetchTestsForStage");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request("GET", `/stages/${stageId}/tests`, null, {
          apiClient,
          ...(signal ? { signal } : {}),
        });
        if (data.success) {
          return data.data;
        }
        setError(data.message || "Failed to fetch tests for stage");
        return [];
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchTestsForStage"));
        return [];
      }
    },
    [apiClient],
  );

  // Fetch stage details for admin
  const fetchStageDetailsAdmin = useCallback(
    async (stageId, optionsOrSignal = {}) => {
      try {
        if (!apiClient) warnMissingClient("useStages.fetchStageDetailsAdmin");
        const signal = resolveSignal(optionsOrSignal);
        const data = await request(
          "GET",
          `/admin/stages/${stageId}/details`,
          null,
          {
            apiClient,
            ...(signal ? { signal } : {}),
          },
        );
        if (data.success) return data.data;
        setError(data.message || "Failed to fetch admin stage details");
        return null;
      } catch (err) {
        setError(toActionableError(err, "useStages.fetchStageDetailsAdmin"));
        return null;
      }
    },
    [apiClient],
  );

  // Get stage by ID
  const getStageById = useCallback(
    (stageId) => {
      if (!stageId) return null;
      const searchId = String(stageId);
      return (
        stages.find((s) => {
          const key = getStageKey(s);
          return key != null && String(key) === searchId;
        }) || null
      );
    },
    [stages],
  );

  // Get stage name by ID
  const getStageName = useCallback(
    (stageId) => {
      return getStageById(stageId)?.name || null;
    },
    [getStageById],
  );

  // Get stage options for dropdowns
  const getStageOptions = useCallback(() => {
    return stages.map((stage) => ({
      value: getStageKey(stage),
      label: stage.name,
      slug: stage.slug,
      icon: stage.icon,
      description: stage.description,
    }));
  }, [stages]);

  // Get stage names array
  const getStageNames = useCallback(() => {
    return stages.map((s) => s.name);
  }, [stages]);

  // CRUD methods
  const createStage = useCallback(
    async (stageData, optionsOrSignal = {}) => {
      if (!apiClient) warnMissingClient("useStages.createStage");
      const signal = resolveSignal(optionsOrSignal);
      const data = await request("POST", "/stages", stageData, {
        apiClient,
        ...(signal ? { signal } : {}),
      });
      if (data && data.success) await fetchStages();
      return { data };
    },
    [apiClient, fetchStages],
  );

  const updateStage = useCallback(
    async (id, stageData, optionsOrSignal = {}) => {
      if (!apiClient) warnMissingClient("useStages.updateStage");
      const signal = resolveSignal(optionsOrSignal);
      const data = await request("PUT", `/stages/${id}`, stageData, {
        apiClient,
        ...(signal ? { signal } : {}),
      });
      if (data && data.success) await fetchStages();
      return { data };
    },
    [apiClient, fetchStages],
  );

  const deleteStage = useCallback(
    async (id, optionsOrSignal = {}) => {
      if (!apiClient) warnMissingClient("useStages.deleteStage");
      const signal = resolveSignal(optionsOrSignal);
      const data = await request("DELETE", `/stages/${id}`, null, {
        apiClient,
        ...(signal ? { signal } : {}),
      });
      if (data && data.success) await fetchStages();
      return { data };
    },
    [apiClient, fetchStages],
  );

  // Initial fetch
  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  return {
    stages,
    loading,
    error,
    fetchStages,
    fetchStagesWithCategories,
    fetchStagesWithTestCounts,
    fetchStageById,
    fetchStageBySlug,
    fetchCategoriesForStage,
    fetchCategoryTreeForStage,
    fetchTestsForStage,
    fetchStageDetailsAdmin,
    getStageName,
    getStageById,
    getStageOptions,
    getStageNames,
    refresh: fetchStages,
    createStage,
    updateStage,
    deleteStage,
  };
}

export default useStages;

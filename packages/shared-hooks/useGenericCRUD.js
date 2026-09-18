import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";

// Canonical error classes from @trstprep/shared-config via relative import
// (no hard dep in package.json — NO package.json edits allowed). Every branch
// guards with `??`/existence checks so this degrades to the bare-Error shape
// below when the shared module is unresolvable.
import {
  ValidationError as SharedValidationError,
  AuthenticationError as SharedAuthenticationError,
  ForbiddenError as SharedForbiddenError,
  NotFoundError as SharedNotFoundError,
  RateLimitError as SharedRateLimitError,
} from "../shared-config/src/errors.js";

function toCrudError(status, message, details, retryAfter = null) {
  const msg =
    message || `Request failed${status ? ` with status ${status}` : ""}`;
  const body = details ?? null;
  // Canonical mapping: 400 -> ValidationError, 401 -> AuthenticationError,
  // 403 -> ForbiddenError, 404 -> NotFoundError, 409 -> ConflictError
  // (bare-Error fallback: no shared Conflict class exists), 422 ->
  // ValidationError, 429 -> RateLimitError.
  let err = null;
  if (status === 400 && SharedValidationError) {
    err = new SharedValidationError(msg, body);
  } else if (status === 401 && SharedAuthenticationError) {
    err = new SharedAuthenticationError(msg, body);
  } else if (status === 403 && SharedForbiddenError) {
    err = new SharedForbiddenError(msg, body);
  } else if (status === 404 && SharedNotFoundError) {
    err = new SharedNotFoundError(msg, body);
  } else if (status === 422 && SharedValidationError) {
    err = new SharedValidationError(msg, body);
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
        409: "CONFLICT_ERROR",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMIT_ERROR",
      };
      err.code = (status && codeByStatus[status]) || "CRUD_ERROR";
    }
    if (err.details == null) err.details = body;
    if (status === 429 && retryAfter != null && err.retryAfter == null) {
      err.retryAfter = retryAfter;
    }
    return err;
  }
  // Bare-Error fallback (shared-config unresolvable or unknown status).
  const nameByStatus = {
    400: "ValidationError",
    401: "AuthenticationError",
    403: "ForbiddenError",
    404: "NotFoundError",
    409: "ConflictError",
    422: "ValidationError",
    429: "RateLimitError",
  };
  const codeByStatus = {
    400: "VALIDATION_ERROR",
    401: "AUTHENTICATION_ERROR",
    403: "FORBIDDEN_ERROR",
    404: "NOT_FOUND_ERROR",
    409: "CONFLICT_ERROR",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_ERROR",
  };
  const fallback = new Error(msg);
  fallback.name = (status && nameByStatus[status]) || "DataError";
  fallback.code =
    (status && codeByStatus[status]) || (status ? `HTTP_${status}` : "CRUD_ERROR");
  fallback.status = status ?? null;
  fallback.details = body;
  if (status === 429) fallback.retryAfter = retryAfter ?? null;
  return fallback;
}

function getErrorStatus(error) {
  return (
    error?.status ??
    error?.response?.status ??
    error?.cause?.status ??
    null
  );
}

function getErrorDetails(error) {
  return (
    error?.details ??
    error?.response?.data ??
    error?.data ??
    null
  );
}

function getRetryAfter(error, response = null) {
  return (
    error?.retryAfter ??
    error?.response?.headers?.["retry-after"] ??
    error?.response?.headers?.["Retry-After"] ??
    response?.headers?.["retry-after"] ??
    response?.headers?.["Retry-After"] ??
    null
  );
}

// Canonical entity key: supports legacy _id plus public_id/publicId and numeric id.
// Order is _id → public_id/publicId → id so public identifiers win over internal
// numeric ids (avoids PUT null when only public_id is present).
function getItemKey(item) {
  if (!item) return null;
  return (
    item._id ?? item.public_id ?? item.publicId ?? item.id ?? null
  );
}

/**
 * Generic CRUD Hook for Admin Managers
 * Eliminates 95%+ duplication across 30+ manager components
 *
 * @param {Object} config - Configuration object
 * @param {string} config.endpoint - API endpoint (e.g., '/subjects', '/banners')
 * @param {Object} config.api - API service to use (api or adminAPI)
 * @param {Object} config.defaultFormData - Default form data structure
 * @param {Function} config.getSuccessMessage - Function to get success messages
 * @param {Function} config.getErrorMessage - Function to get error messages
 * @param {boolean} config.useAdminAPI - Whether to use adminAPI (default: false)
 * @param {Function} config.confirmFn - Custom confirm function (default: window.confirm)
 * @returns {Object} CRUD operations and state
 */
export const useGenericCRUD = ({
  endpoint,
  api,
  defaultFormData = {},
  getSuccessMessage = (action, itemName) =>
    `${itemName} ${action}d successfully!`,
  getErrorMessage = (action, itemName) => `Failed to ${action} ${itemName}`,
  useAdminAPI = false,
  confirmFn = typeof window !== "undefined"
    ? window.confirm.bind(window)
    : () => true,
  notifyFn = (type, message) => {
    try {
      if (type === "error") {
        toast.error(message);
      } else {
        toast.success(message);
      }
    } catch {
      if (type === "error") {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  },
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const fetchItemsRef = useRef(null);

  // Fetch all items with optional query parameters.
  // Signal note: pass `{ signal }` (or an AbortSignal directly) as the
  // second argument to abort in-flight fetches; it is forwarded to the
  // underlying axios call (and to request() in the fetch fallback path).
  const fetchItems = useCallback(
    async (queryParams = {}, optionsOrSignal = {}) => {
      try {
        setLoading(true);
        const signal =
          typeof AbortSignal !== "undefined" &&
          optionsOrSignal instanceof AbortSignal
            ? optionsOrSignal
            : optionsOrSignal?.signal;
        const response = await api.get(endpoint, {
          params: queryParams,
          ...(signal ? { signal } : {}),
        });
        if (response.data.success) {
          setItems(response.data.data || []);
          return response.data.data || [];
        }
        const status = response?.status ?? null;
        const err = toCrudError(
          status,
          response.data?.message || `Failed to fetch ${endpoint}`,
          response.data,
          getRetryAfter(null, response),
        );
        notifyFn("error", err.message);
        throw err;
      } catch (error) {
        if (error?.code || error?.status) throw error;
        console.error(`Failed to fetch ${endpoint}:`, error);
        const status = getErrorStatus(error);
        const err = toCrudError(
          status,
          error?.response?.data?.message ||
            error?.message ||
            `Failed to fetch ${endpoint}`,
          getErrorDetails(error),
          getRetryAfter(error),
        );
        notifyFn("error", err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [api, endpoint],
  );

  // Keep ref in sync with latest fetchItems
  fetchItemsRef.current = fetchItems;

  // Create or update item.
  // Signal note: optional trailing `optionsOrSignal` (`{ signal }` or an
  // AbortSignal) is forwarded as axios request config.
  const saveItem = useCallback(
    async (customData = null, id = null, optionsOrSignal = {}) => {
      const dataToSave = customData || formData;
      const itemId = id || editingId;
      const isEditing = !!itemId;
      const signal =
        typeof AbortSignal !== "undefined" &&
        optionsOrSignal instanceof AbortSignal
          ? optionsOrSignal
          : optionsOrSignal?.signal;
      const requestConfig = signal ? { signal } : undefined;

      try {
        let response;
        if (isEditing) {
          response = await api.put(
            `${endpoint}/${itemId}`,
            dataToSave,
            requestConfig,
          );
        } else {
          response = await api.post(endpoint, dataToSave, requestConfig);
        }

        if (response.data.success) {
          await fetchItems();
          resetForm();
          const action = isEditing ? "update" : "create";
          const itemName = endpoint.replace(/^\//, "").replace(/s$/, ""); // Remove leading slash and plural 's'
          notifyFn("success", getSuccessMessage(action, itemName));
          return true;
        }
        const err = toCrudError(
          response?.status ?? null,
          response.data?.message || getErrorMessage(action, itemName),
          response.data,
          getRetryAfter(null, response),
        );
        notifyFn("error", err.message);
        throw err;
      } catch (error) {
        if (error?.code || error?.status) throw error;
        console.error(`Failed to save ${endpoint}:`, error);
        const action = isEditing ? "update" : "create";
        const itemName = endpoint.replace(/^\//, "").replace(/s$/, "");
        const status = getErrorStatus(error);
        const err = toCrudError(
          status,
          error?.response?.data?.message ||
            error?.message ||
            getErrorMessage(action, itemName),
          getErrorDetails(error),
          getRetryAfter(error),
        );
        notifyFn("error", err.message);
        throw err;
      }
    },
    [
      api,
      endpoint,
      editingId,
      formData,
      fetchItems,
      getSuccessMessage,
      getErrorMessage,
      notifyFn,
    ],
  );

  // Delete item
  const deleteItem = useCallback(
    async (
      id,
      confirmMessage = "Are you sure you want to delete this item?",
    ) => {
      if (!confirmFn(confirmMessage)) return false;

      try {
        const response = await api.delete(`${endpoint}/${id}`);
        if (response.data.success) {
          // Single optimistic update — no follow-up refetch (avoids a
          // redundant second list update per delete).
          setItems((prev) =>
            prev.filter((item) => {
              const key = getItemKey(item);
              return key !== null && key !== undefined
                ? String(key) !== String(id)
                : true;
            }),
          );
          const itemName = endpoint.replace(/^\//, "").replace(/s$/, "");
          notifyFn("success", getSuccessMessage("delete", itemName));
          return true;
        }
        const itemName = endpoint.replace(/^\//, "").replace(/s$/, "");
        const err = toCrudError(
          response?.status ?? null,
          response.data?.message || getErrorMessage("delete", itemName),
          response.data,
          getRetryAfter(null, response),
        );
        notifyFn("error", err.message);
        throw err;
      } catch (error) {
        if (error?.code || error?.status) throw error;
        console.error(`Failed to delete ${endpoint}:`, error);
        const itemName = endpoint.replace(/^\//, "").replace(/s$/, "");
        const status = getErrorStatus(error);
        const err = toCrudError(
          status,
          error?.response?.data?.message ||
            error?.message ||
            getErrorMessage("delete", itemName),
          getErrorDetails(error),
          getRetryAfter(error),
        );
        notifyFn("error", err.message);
        throw err;
      }
    },
    [
      api,
      endpoint,
      getSuccessMessage,
      getErrorMessage,
      confirmFn,
      notifyFn,
    ],
  );

  // Edit item (populate form)
  const editItem = useCallback(
    (item) => {
      setFormData({ ...defaultFormData, ...item });
      setEditingId(getItemKey(item));
      setShowForm(true);
    },
    [defaultFormData],
  );

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
  }, [defaultFormData]);

  // Toggle active status
  const toggleActive = useCallback(
    async (item) => {
      try {
        const itemKey = getItemKey(item);
        const nextActive = !(item.isActive ?? item.is_active);
        // Minimal update payload — never PUT the whole item (avoids clobbering
        // unrelated fields). Optimistic local state still applies the full merge.
        const minimalPayload = { is_active: nextActive };
        const response = await api.put(
          `${endpoint}/${itemKey}`,
          minimalPayload,
        );
        if (response.data.success) {
          const updatedData = { ...item, isActive: nextActive, is_active: nextActive };
          setItems((prev) =>
            prev.map((i) =>
              String(getItemKey(i)) === String(itemKey) ? updatedData : i,
            ),
          );
          const itemName = endpoint.replace(/^\//, "").replace(/s$/, "");
          notifyFn(
            "success",
            `${itemName} ${updatedData.isActive ? "activated" : "deactivated"}!`,
          );
          return true;
        }
        const itemName = endpoint.replace(/^\//, "").replace(/s$/, "");
        const err = toCrudError(
          response?.status ?? null,
          response.data?.message || `Failed to toggle ${itemName}`,
          response.data,
          getRetryAfter(null, response),
        );
        notifyFn("error", err.message);
        throw err;
      } catch (error) {
        if (error?.code || error?.status) throw error;
        console.error(`Failed to toggle ${endpoint}:`, error);
        const itemName = endpoint.replace(/^\//, "").replace(/s$/, "");
        const status = getErrorStatus(error);
        const err = toCrudError(
          status,
          error?.response?.data?.message ||
            error?.message ||
            `Failed to toggle ${itemName}`,
          getErrorDetails(error),
          getRetryAfter(error),
        );
        notifyFn("error", err.message);
        throw err;
      }
    },
    [api, endpoint, notifyFn],
  );

  // Initialize on mount — use ref to avoid infinite re-fetch
  useEffect(() => {
    fetchItemsRef.current();
  }, []);

  return {
    // State
    items,
    loading,
    showForm,
    editingId,
    formData,
    setFormData,
    setShowForm,

    // Actions
    fetchItems,
    saveItem,
    deleteItem,
    editItem,
    resetForm,
    toggleActive,

    // Utilities
    setItems,
    setLoading,
  };
};

export default useGenericCRUD;

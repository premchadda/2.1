import { apiClient } from "./apiClient.js";

export const bookmarksAPI = {
  getAll: (page = 1, limit = 20, options = {}) => {
    const { includeDetails, ...requestConfig } = options || {};
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (includeDetails !== undefined)
      params.set("includeDetails", String(includeDetails));
    return apiClient
      .get(`/api/bookmarks?${params.toString()}`, requestConfig)
      .then((r) => r.data);
  },
  getCount: (options = {}) =>
    apiClient.get("/api/bookmarks/count", options).then((r) => r.data?.data),
  add: (data) => apiClient.post("/api/bookmarks", data).then((r) => r.data),
  remove: (id) => apiClient.delete(`/api/bookmarks/${id}`).then((r) => r.data),
  update: (id, data) =>
    apiClient.put(`/api/bookmarks/${id}`, data).then((r) => r.data),
  toggle: (data) =>
    apiClient.post("/api/bookmarks/toggle", data).then((r) => r.data),
  check: (itemType, itemId) =>
    apiClient
      .get(`/api/bookmarks/check/${itemType}/${itemId}`)
      .then((r) => r.data),
};

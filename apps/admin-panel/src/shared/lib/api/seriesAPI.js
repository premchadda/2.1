import { ValidationError } from "@trstprep/shared-config";
import { apiClient } from "../apiClient.js";

export const seriesAPI = {
  // Uses public endpoint which now includes calculated test counts
  getAll: (params) => apiClient.get("/series", { params }),
  getById: (id) => {
    if (id === undefined || id === null || String(id).trim() === "")
      throw new ValidationError("Test Series ID is required");
    return apiClient.get(`/series/${encodeURIComponent(String(id))}`);
  },
  create: (data) => {
    if (!data.title || !data.category) {
      throw new ValidationError("Title and category are required");
    }
    return apiClient.post("/admin/test-series", data);
  },
  update: (id, data) => {
    if (id === undefined || id === null || String(id).trim() === "")
      throw new ValidationError("Test Series ID is required");
    return apiClient.put(
      `/admin/test-series/${encodeURIComponent(String(id))}`,
      data,
    );
  },
  delete: (id) => {
    if (id === undefined || id === null || String(id).trim() === "")
      throw new ValidationError("Test Series ID is required");
    return apiClient.delete(
      `/admin/test-series/${encodeURIComponent(String(id))}`,
    );
  },
  getByCategory: (category) => {
    if (
      category === undefined ||
      category === null ||
      String(category).trim() === ""
    )
      throw new ValidationError("Category is required");
    return apiClient.get(
      `/series/category/${encodeURIComponent(String(category))}`,
    );
  },
  getTests: (seriesId) => {
    if (
      seriesId === undefined ||
      seriesId === null ||
      String(seriesId).trim() === ""
    )
      throw new ValidationError("Test Series ID is required");
    return apiClient.get(
      `/series/${encodeURIComponent(String(seriesId))}/tests`,
    );
  },
};

export default seriesAPI;

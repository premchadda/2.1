import { ValidationError } from "@trstprep/shared-config";
import { apiClient } from "../apiClient.js";

const enc = (v) => encodeURIComponent(String(v));
const need = (v, msg) => {
  if (v === undefined || v === null || String(v).trim() === "")
    throw new ValidationError(msg);
};
export const testsAPI = {
  getAll: (params) => apiClient.get("/admin/tests", { params }),
  getById: (id) => {
    need(id, "Test ID is required");
    return apiClient.get(`/tests/${enc(id)}`);
  },
  getByTag: (tag) => {
    need(tag, "Tag is required");
    return apiClient.get(`/tests/tag/${enc(tag)}`);
  },
  getBySeriesId: (seriesId) => {
    need(seriesId, "Test Series ID is required");
    return apiClient.get(`/tests/series/${enc(seriesId)}`);
  },
  getQuestions: (testId) => {
    need(testId, "Test ID is required");
    return apiClient.get(`/tests/${enc(testId)}/questions`);
  },
  create: (data) => {
    if (!data?.title || !String(data.title).trim()) {
      throw new ValidationError("title is required");
    }
    if (!data.testSeriesId && !data.seriesId) {
      throw new ValidationError("testSeriesId is required");
    }
    return apiClient.post("/admin/tests", data);
  },
  update: (id, data) => {
    need(id, "Test ID is required");
    return apiClient.put(`/admin/tests/${enc(id)}`, data);
  },
  delete: (id) => {
    need(id, "Test ID is required");
    return apiClient.delete(`/admin/tests/${enc(id)}`);
  },
};

export default testsAPI;

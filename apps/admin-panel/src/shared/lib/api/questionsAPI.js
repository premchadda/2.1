import { ValidationError } from "@trstprep/shared-config";
import { apiClient } from "../apiClient.js";

export const questionsAPI = {
  getAll: async ({
    page = 1,
    limit = 20,
    search,
    testId,
    category,
    seriesId,
  } = {}) => {
    const params = {
      limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
      page: Math.max(Number(page) || 1, 1),
    };
    if (search) params.search = String(search).trim();
    if (testId) {
      params.testId = String(testId);
    }
    if (category) params.category = category;
    if (seriesId) params.seriesId = seriesId;
    const res = await apiClient.get("/admin/questions", { params });
    return res;
  },
  getByTestId: (testId) => {
    if (testId === undefined || testId === null || String(testId).trim() === "")
      throw new ValidationError("Test ID is required");
    return apiClient.get(
      `/questions/test/${encodeURIComponent(String(testId))}`,
      { params: { limit: 100 } },
    );
  },
  create: (data) => {
    const required = ["text", "options", "correct", "testId"];
    for (const field of required) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ""
      ) {
        throw new ValidationError(`${field} is required`);
      }
    }
    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new ValidationError("At least 2 options are required");
    }
    const correctIdx = Number(data.correct);
    if (
      !Number.isInteger(correctIdx) ||
      correctIdx < 0 ||
      correctIdx >= data.options.length
    ) {
      throw new ValidationError("Invalid correct answer index");
    }
    return apiClient.post("/admin/questions", data);
  },
  update: (id, data) => {
    if (id === undefined || id === null || String(id).trim() === "")
      throw new ValidationError("Question ID is required");
    return apiClient.put(
      `/admin/questions/${encodeURIComponent(String(id))}`,
      data,
    );
  },
  delete: (id) => {
    if (id === undefined || id === null || String(id).trim() === "")
      throw new ValidationError("Question ID is required");
    return apiClient.delete(
      `/admin/questions/${encodeURIComponent(String(id))}`,
    );
  },
  bulkUpload: (data) => {
    if (!data || !Array.isArray(data.questions)) {
      throw new ValidationError("Questions array is required");
    }
    if (data.questions.length === 0) {
      throw new ValidationError("At least one question is required");
    }
    return apiClient.post("/admin/questions/bulk", data);
  },
};

export default questionsAPI;

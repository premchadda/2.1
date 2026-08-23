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
  startAttempt: (testId) => {
    need(testId, "Test ID is required");
    return apiClient.post(`/tests/${enc(testId)}/start`);
  },
  submitAttempt: (testId, data) => {
    need(testId, "Test ID is required");
    if (!data || !Array.isArray(data.answers)) {
      throw new ValidationError("Answers array is required");
    }
    return apiClient.put(`/tests/${enc(testId)}/submit`, data);
  },
  getResult: (testId, attemptId) => {
    need(testId, "Test ID is required");
    need(attemptId, "Attempt ID is required");
    return apiClient.get(`/tests/${enc(testId)}/result/${enc(attemptId)}`);
  },
  // Attempt management - pause/resume/save-progress
  attempt: {
    start: (testId, seriesId) => {
      need(testId, "Test ID is required");
      return apiClient.post(`/tests/${enc(testId)}/start`, {
        testSeriesId: seriesId,
      });
    },
    pause: (attemptId, data) => {
      need(attemptId, "Attempt ID is required");
      return apiClient.post("/attempt/pause", { attemptId, ...data });
    },
    resume: (attemptId) => {
      need(attemptId, "Attempt ID is required");
      return apiClient.post("/attempt/resume", { attemptId });
    },
    saveProgress: (attemptId, data) => {
      need(attemptId, "Attempt ID is required");
      return apiClient.post("/attempt/save-progress", { attemptId, ...data });
    },
    getState: (attemptId) => {
      need(attemptId, "Attempt ID is required");
      return apiClient.get(`/attempt/${enc(attemptId)}/state`);
    },
    logEvent: (attemptId, eventType, data = {}) => {
      need(attemptId, "Attempt ID is required");
      need(eventType, "Event type is required");
      return apiClient.post(`/attempt/${enc(attemptId)}/event`, {
        ...data,
        eventType,
        attemptId,
      });
    },
    getAnalytics: (attemptId) => {
      need(attemptId, "Attempt ID is required");
      return apiClient.get(`/attempt/${enc(attemptId)}/analytics`);
    },
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

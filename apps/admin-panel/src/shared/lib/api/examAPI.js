import { ValidationError } from "@trstprep/shared-config";
import { apiClient } from "../apiClient.js";

const need = (v, msg) => {
  if (v === undefined || v === null || String(v).trim() === "")
    throw new ValidationError(msg);
};
export const examAPI = {
  getCategories: () => apiClient.get("/admin/exam-categories"),
  getExams: () => apiClient.get("/exams"),
  getExamInfo: () => apiClient.get("/admin/exam-info"),
  getExamUpdates: (examId) => {
    need(examId, "examId required");
    return apiClient.get(
      `/exam-info/${encodeURIComponent(String(examId))}/updates`,
    );
  },
  getExamYearlyData: (examId) => {
    need(examId, "examId required");
    return apiClient.get(
      `/exam-info/${encodeURIComponent(String(examId))}/yearly-data`,
    );
  },
  getPublicStats: () => apiClient.get("/public-stats"),
  getTestimonials: () => apiClient.get("/testimonials"),
  getPromotions: () => apiClient.get("/promotions"),
};

export default examAPI;

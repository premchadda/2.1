import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAPI, apiClient } from "../lib/dataService.js";

const stableStringify = (obj) => {
  if (!obj || typeof obj !== "object") return String(obj ?? "");
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return JSON.stringify(sorted);
};

// Query keys standard hierarchy - stable serialization to avoid refetch loops from object identity
export const ADMIN_QUERY_KEYS = {
  stats: (range = "7d") => ["admin", "stats", String(range)],
  analytics: (range = "7d") => ["admin", "analytics", String(range)],
  recentActivity: ["admin", "recent-activity"],
  testSeries: (params = {}) => [
    "admin",
    "test-series",
    stableStringify({ includeInactive: true, ...params }),
  ],
  tests: (params = {}) => ["admin", "tests", stableStringify(params)],
  testCategories: (params = {}) => [
    "admin",
    "test-categories",
    stableStringify(params),
  ],
  stages: ["admin", "stages"],
  sections: (params = {}) => ["admin", "sections", stableStringify(params)],
  questionStats: ["admin", "question-stats"],
  questionsPage: (params = {}) => [
    "admin",
    "questions",
    stableStringify(params),
  ],
  sessions: (search = "") => ["admin", "sessions", String(search || "")],
  sessionStats: ["admin", "sessions", "stats"],
  users: (params = {}) => ["admin", "users", stableStringify(params)],
  examCategories: ["admin", "exam-categories"],
  exams: ["admin", "exams"],
};

// 1. Admin Overview Stats (30s staleTime)
export function useAdminStats(range = "7d", options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.stats(range),
    queryFn: async () => {
      const res = await apiClient.get("/admin/stats", { params: { range } });
      return res.data?.data || res.data || null;
    },
    staleTime: 1000 * 30, // 30 seconds
    ...options,
  });
}

// 2. Admin Analytics (30s staleTime)
export function useAdminAnalytics(range = "7d", options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.analytics(range),
    queryFn: async () => {
      const res = await apiClient.get("/admin/analytics", {
        params: { range },
      });
      return res.data?.data || res.data || null;
    },
    staleTime: 1000 * 30,
    ...options,
  });
}

// 3. Admin Recent Activity (15s staleTime)
export function useAdminRecentActivity(options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.recentActivity,
    queryFn: async () => {
      const res = await apiClient.get("/admin/recent-activity");
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 15,
    ...options,
  });
}

// 4. Admin Test Series (5m staleTime)
export function useAdminTestSeries(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.testSeries(params),
    queryFn: async () => {
      const res = await adminAPI.getTestSeries(params);
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}

// 5. Admin Tests (1m staleTime)
export function useAdminTests(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.tests(params),
    queryFn: async () => {
      const res = await adminAPI.getTests(params);
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 60 * 1, // 1 minute
    ...options,
  });
}

// 6. Admin Test Categories (10m staleTime)
export function useAdminTestCategories(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.testCategories(params),
    queryFn: async () => {
      const res = await adminAPI.getTestCategories(params);
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    ...options,
  });
}

// 7. Admin Stages (10m staleTime)
export function useAdminStages(options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.stages,
    queryFn: async () => {
      const res = await apiClient.get("/admin/stages");
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}

// 8. Admin Sections (10m staleTime)
export function useAdminSections(params = {}, options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.sections(params),
    queryFn: async () => {
      const res = await adminAPI.getSections(params);
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}

// 9. Admin Question Stats (2m staleTime)
export function useAdminQuestionStats(options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.questionStats,
    queryFn: async () => {
      const res = await apiClient.get("/admin/questions/stats");
      return res.data?.data || res.data || null;
    },
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

// 10. Admin Questions Paginated (30s staleTime)
export function useAdminQuestionsPage(params = {}, options = {}) {
  const rawLimit = params.limit ?? 50;
  const sanitizedParams = {
    ...params,
    limit: Math.min(Math.max(Number(rawLimit) || 50, 1), 100), // Enforce 1-100, fixes 0=>50 bug
  };

  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.questionsPage(sanitizedParams),
    queryFn: async () => {
      const res = await apiClient.get("/admin/questions", {
        params: sanitizedParams,
      });
      return {
        questions: res.data?.data || [],
        pagination: res.data?.pagination || {
          totalCount: (res.data?.data || []).length,
          page: 1,
          limit: 50,
        },
      };
    },
    staleTime: 1000 * 30,
    ...options,
  });
}

// 11. Admin Sessions (15s staleTime)
export function useAdminSessions(search = "", options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.sessions(search),
    queryFn: async () => {
      const params = search ? { search } : {};
      const res = await apiClient.get("/admin/sessions", { params });
      return res.data?.data?.sessions || res.data?.data || [];
    },
    staleTime: 1000 * 15,
    ...options,
  });
}

// 12. Admin Session Stats (30s staleTime)
export function useAdminSessionStats(options = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.sessionStats,
    queryFn: async () => {
      const res = await apiClient.get("/admin/sessions/stats");
      return res.data?.data || null;
    },
    staleTime: 1000 * 30,
    ...options,
  });
}

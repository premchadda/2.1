import { useState, useEffect, useCallback, useRef } from "react";
import { request } from "./apiClientConfig.js";

export function useExamCategories(options = {}) {
  const { apiClient = null } = options;
  const [categories, setCategories] = useState([]);
  const [examInfo, setExamInfo] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request("GET", "/exam-categories", null, {
        apiClient,
      });
      if (data.success) {
        // Filter out "All Exams" and active only
        const filteredCategories = data.data
          .filter((cat) => cat.id !== "all" && cat.isActive !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setCategories(filteredCategories);
      } else {
        setError(data.message || "Failed to fetch categories");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const fetchExamInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request("GET", "/exam-info", null, { apiClient });
      if (data.success) {
        // Filter active only and sort by display_order
        const filteredExamInfo = data.data
          .filter((exam) => exam.isActive !== false)
          .sort(
            (a, b) =>
              (a.display_order ?? a.displayOrder ?? 0) -
              (b.display_order ?? b.displayOrder ?? 0),
          );
        setExamInfo(filteredExamInfo);
        // Also populate exams from the same endpoint to avoid duplicate calls
        setExams(filteredExamInfo);
      } else {
        setError(data.message || "Failed to fetch exam info");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  // Fetch exams from the database (public API endpoint)
  // Removed: this was a duplicate of fetchExamInfo hitting the same /api/exam-info endpoint

  // Get exams for a specific category
  const getExamsByCategory = useCallback(
    (categoryId) => {
      if (!categoryId) return [];

      // Find the category to get its slug/id for matching
      const category = categories.find(
        (cat) =>
          cat.id === categoryId ||
          cat.label === categoryId ||
          cat.slug === categoryId ||
          cat.categoryId === categoryId,
      );

      // Try to match by multiple possible ID fields
      const categoryKey =
        category?.categoryId ||
        category?.slug ||
        String(categoryId).toLowerCase();

      return exams
        .filter(
          (exam) =>
            exam.parentCategoryId === categoryId ||
            exam.parentCategoryId === categoryKey ||
            exam.parentCategoryId === category?.slug ||
            exam.parentCategoryId?.toLowerCase() === categoryKey?.toLowerCase(),
        )
        .map((exam) => ({
          value: exam.id,
          label: exam.name,
          fullName: exam.description || exam.name,
        }));
    },
    [exams, categories],
  );

  // Get all exams as flat array
  const getAllExams = useCallback(() => {
    return exams.map((exam) => ({
      value: exam.id,
      label: exam.name,
      parentCategoryId: exam.parentCategoryId,
      fullName: exam.description || exam.name,
    }));
  }, [exams]);

  const getExamsFromExamInfo = useCallback(
    (categoryId) => {
      if (!categoryId) return [];

      const category = categories.find(
        (cat) =>
          String(cat.id) === String(categoryId) ||
          cat.label === categoryId ||
          cat.slug === categoryId ||
          cat.categoryId === categoryId,
      );

      const categoryKey =
        category?.categoryId ||
        category?.slug ||
        String(categoryId).toLowerCase();

      return examInfo
        .filter(
          (exam) =>
            exam.categoryId === categoryId ||
            exam.categoryId === categoryKey ||
            exam.categoryId?.toLowerCase() === categoryKey?.toLowerCase(),
        )
        .map((exam) => ({
          value: exam.examId,
          label: exam.title,
          fullName: exam.fullName,
        }));
    },
    [examInfo, categories],
  );

  const getAllExamsFromExamInfo = useCallback(() => {
    return examInfo.map((exam) => ({
      value: exam.examId,
      label: exam.title,
      categoryId: exam.categoryId,
      fullName: exam.fullName,
    }));
  }, [examInfo]);

  // Get category label by ID
  const getCategoryLabel = useCallback(
    (categoryId) => {
      const category = categories.find((cat) => cat.id === categoryId);
      return category ? category.label : categoryId;
    },
    [categories],
  );

  // Get exam info by category and exam ID
  const getExamInfo = useCallback(
    (categoryId, examId) => {
      return examInfo.find(
        (exam) => exam.categoryId === categoryId && exam.examId === examId,
      );
    },
    [examInfo],
  );

  // Get exam by ID
  const getExamById = useCallback(
    (examId) => {
      return exams.find((exam) => exam.id === examId);
    },
    [exams],
  );

  const getExamsFromExamInfoLegacy = getExamsFromExamInfo;
  const getAllExamsFromExamInfoLegacy = getAllExamsFromExamInfo;

  // Stable refresh helper — wrap in useCallback so consumers can pass it to memoized children
  const refresh = useCallback(() => {
    fetchCategories();
    fetchExamInfo();
  }, [fetchCategories, fetchExamInfo]);

  // Initial fetch with AbortController cleanup
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    fetchCategories();
    fetchExamInfo();
    // Removed duplicate fetchExams() — examInfo already populates exams state

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchCategories, fetchExamInfo]);

  return {
    categories,
    examInfo,
    exams,
    loading,
    error,
    fetchCategories,
    fetchExamInfo,
    fetchExams: fetchExamInfo,
    getExamsByCategory,
    getAllExams,
    getExamById,
    getExamsFromExamInfo,
    getAllExamsFromExamInfo,
    getCategoryLabel,
    getExamInfo,
    refresh,
  };
}

export default useExamCategories;

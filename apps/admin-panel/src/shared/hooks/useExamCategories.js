import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../lib/dataService";

let cachedCategories = null;
let cachedExamInfo = null;
let cachedExams = null;
let categoriesPromise = null;
let examInfoPromise = null;
let examsPromise = null;
let lastFetchedCategories = 0;
let lastFetchedExamInfo = 0;
let lastFetchedExams = 0;
const HOOK_CACHE_TTL = 60_000;

export function useExamCategories() {
  const [categories, setCategories] = useState(() => cachedCategories || []);
  const [examInfo, setExamInfo] = useState(() => cachedExamInfo || []);
  const [exams, setExams] = useState(() => cachedExams || []);
  const [loading, setLoading] = useState(
    () => !cachedCategories || !cachedExamInfo || !cachedExams,
  );
  const [error, setError] = useState(null);

  const fetchCategories = useCallback(async (force = false) => {
    if (
      !force &&
      cachedCategories &&
      Date.now() - lastFetchedCategories < HOOK_CACHE_TTL
    ) {
      setCategories(cachedCategories);
      return;
    }
    if (!force) setLoading(true);
    setError(null);
    try {
      if (!categoriesPromise || force) {
        categoriesPromise = apiClient
          .get("/exam-categories")
          .then((response) => {
            const data = response.data;
            const payload = data?.data || data;
            const arr = Array.isArray(payload)
              ? payload
              : Array.isArray(data?.data)
                ? data.data
                : [];
            if (Array.isArray(arr)) {
              const filtered = arr
                .filter((cat) => cat?.id !== "all" && cat?.isActive !== false)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
              cachedCategories = filtered;
              lastFetchedCategories = Date.now();
              return filtered;
            }
            if (data?.success === false)
              throw new Error(data.message || "Failed to fetch categories");
            return arr;
          })
          .finally(() => {
            categoriesPromise = null;
          });
      }
      const data = await categoriesPromise;
      setCategories(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExamInfo = useCallback(async (force = false) => {
    if (
      !force &&
      cachedExamInfo &&
      Date.now() - lastFetchedExamInfo < HOOK_CACHE_TTL
    ) {
      setExamInfo(cachedExamInfo);
      return;
    }
    if (!force) setLoading(true);
    setError(null);
    try {
      if (!examInfoPromise || force) {
        examInfoPromise = apiClient
          .get("/exam-info")
          .then((response) => {
            const data = response.data;
            const payload = data?.data || data;
            const arr = Array.isArray(payload) ? payload : [];
            const filtered = arr.filter((exam) => exam?.isActive !== false);
            cachedExamInfo = filtered;
            lastFetchedExamInfo = Date.now();
            if (data?.success === false)
              throw new Error(data.message || "Failed to fetch exam info");
            return filtered;
          })
          .finally(() => {
            examInfoPromise = null;
          });
      }
      const data = await examInfoPromise;
      setExamInfo(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExams = useCallback(async (force = false) => {
    if (
      !force &&
      cachedExams &&
      Date.now() - lastFetchedExams < HOOK_CACHE_TTL
    ) {
      setExams(cachedExams);
      return;
    }
    if (!force) setLoading(true);
    setError(null);
    try {
      if (!examsPromise || force) {
        examsPromise = apiClient
          .get("/exams")
          .then((response) => {
            const data = response.data;
            const payload = data?.data || data;
            const arr = Array.isArray(payload) ? payload : [];
            const filtered = arr
              .filter((exam) => exam?.isActive !== false)
              .map((exam) => ({
                ...exam,
                id: exam.id || exam._id,
                name: exam.name || exam.title,
                description: exam.description || exam.fullName || "",
                parentCategoryId: exam.parentCategoryId || exam.categoryId,
              }));
            cachedExams = filtered;
            lastFetchedExams = Date.now();
            if (data?.success === false)
              throw new Error(data.message || "Failed to fetch exams");
            return filtered;
          })
          .finally(() => {
            examsPromise = null;
          });
      }
      const data = await examsPromise;
      setExams(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getExamsByCategory = useCallback(
    (categoryId) => {
      if (!categoryId) return [];
      const category = categories.find(
        (cat) =>
          String(cat.id) === String(categoryId) ||
          String(cat.label) === String(categoryId) ||
          String(cat.slug) === String(categoryId) ||
          String(cat.categoryId) === String(categoryId),
      );
      const categoryKeys = [
        categoryId,
        category?.id,
        category?.categoryId,
        category?.slug,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      const normalizeKey = (str) =>
        String(str || "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "");

      const fromExams = exams
        .filter((exam) => {
          const examCategoryKeys = [exam.parentCategoryId, exam.categoryId]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase());
          return examCategoryKeys.some((k) => categoryKeys.includes(k));
        })
        .map((exam) => {
          const label = exam.name || exam.title || exam.fullName || "";
          if (!label) return null;
          return {
            value: exam.slug || exam.examId || exam.id,
            id: exam.id,
            label,
            fullName:
              exam.fullName ||
              exam.description ||
              exam.name ||
              exam.title ||
              "",
            slug: exam.slug || exam.examId,
            displayOrder: exam.displayOrder ?? exam.display_order ?? 0,
          };
        })
        .filter(Boolean);

      const fromExamInfo = examInfo
        .filter((exam) => {
          const key = String(exam.categoryId || "").toLowerCase();
          return key && categoryKeys.includes(key);
        })
        .map((exam) => {
          const label = exam.title || exam.fullName || "";
          if (!label) return null;
          return {
            value: exam.examId || exam.slug || exam.id,
            id: exam.id,
            label,
            fullName: exam.fullName || exam.title || "",
            slug: exam.slug || exam.examId,
            displayOrder: exam.displayOrder ?? exam.display_order ?? 0,
          };
        })
        .filter(Boolean);

      const merged = [...fromExams, ...fromExamInfo];
      const seen = new Set();
      const uniqueExams = [];

      for (const item of merged) {
        const normLabel = normalizeKey(item.label);
        const normValue = normalizeKey(item.value);
        const normSlug = normalizeKey(item.slug);
        if (
          (normLabel && seen.has(normLabel)) ||
          (normValue && seen.has(normValue)) ||
          (normSlug && seen.has(normSlug))
        ) {
          continue;
        }
        if (normLabel) seen.add(normLabel);
        if (normValue) seen.add(normValue);
        if (normSlug) seen.add(normSlug);
        uniqueExams.push(item);
      }

      return uniqueExams.sort((a, b) => {
        const aExam = exams.find(
          (e) =>
            String(e.id || e.examId || e.slug) === String(a.value) ||
            a.label === (e.name || e.title),
        );
        const bExam = exams.find(
          (e) =>
            String(e.id || e.examId || e.slug) === String(b.value) ||
            b.label === (e.name || e.title),
        );
        return (
          (aExam?.displayOrder ?? aExam?.display_order ?? a.displayOrder ?? 0) -
          (bExam?.displayOrder ?? bExam?.display_order ?? b.displayOrder ?? 0)
        );
      });
    },
    [exams, examInfo, categories],
  );

  const getAllExams = useCallback(() => {
    return exams
      .map((exam) => ({
        value: exam.id,
        label: exam.name,
        parentCategoryId: exam.parentCategoryId,
        fullName: exam.description || exam.name,
      }))
      .sort((a, b) => {
        const aExam = exams.find((e) => String(e.id) === String(a.value));
        const bExam = exams.find((e) => String(e.id) === String(b.value));
        return (
          (aExam?.displayOrder ?? aExam?.display_order ?? 0) -
          (bExam?.displayOrder ?? bExam?.display_order ?? 0)
        );
      });
  }, [exams]);

  const getCategoryLabel = useCallback(
    (categoryId) => {
      const category = categories.find((cat) => cat.id === categoryId);
      return category ? category.label : categoryId;
    },
    [categories],
  );

  const getExamInfo = useCallback(
    (categoryId, examId) => {
      return examInfo.find(
        (exam) => exam.categoryId === categoryId && exam.examId === examId,
      );
    },
    [examInfo],
  );

  const getExamById = useCallback(
    (examId) => {
      return exams.find((exam) => exam.id === examId);
    },
    [exams],
  );

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

  useEffect(() => {
    fetchCategories();
    fetchExamInfo();
    fetchExams();
  }, [fetchCategories, fetchExamInfo, fetchExams]);

  return {
    categories,
    examInfo,
    exams,
    examSubCategories: exams,
    loading,
    error,
    fetchCategories,
    fetchExamInfo,
    fetchExams,
    getExamsByCategory,
    getAllExams,
    getExamById,
    getExamsFromExamInfo,
    getAllExamsFromExamInfo,
    getCategoryLabel,
    getExamInfo,
    refresh: () => {
      fetchCategories(true);
      fetchExamInfo(true);
      fetchExams(true);
    },
  };
}

export default useExamCategories;

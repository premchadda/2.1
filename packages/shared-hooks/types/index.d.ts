import { RefObject } from "react";
import { Socket } from "socket.io-client";

// ─── useUndoRedo ────────────────────────────────────────────────────────────

interface UndoRedoEntry {
  doAction: () => Promise<any> | any;
  undoAction: () => void;
  label: string;
  timestamp: number;
}

interface UndoRedoResult {
  execute: <T = any>(
    doAction: () => T | Promise<T>,
    undoAction: () => void,
    label?: string,
  ) => Promise<T>;
  undo: () => Promise<{ result: any; label: string } | null>;
  redo: () => Promise<{ result: any; label: string } | null>;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  history: UndoRedoEntry[];
  currentIndex: number;
}

export function useUndoRedo(maxHistory?: number): UndoRedoResult;

// ─── useFormManager ──────────────────────────────────────────────────────────

interface ValidationRule {
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: (value: any, formData: Record<string, any>) => string | null;
}

interface FormManagerResult<
  T extends Record<string, any> = Record<string, any>,
> {
  formData: T;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  hasErrors: boolean;
  isDirty: boolean;

  updateField: (field: string, value: any) => void;
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  handleBlur: (field: string) => void;
  validateForm: () => boolean;
  resetForm: () => void;
  populateForm: (data: Partial<T>) => void;
  handleSubmit: <R = any>(
    submitFn: (data: T) => Promise<R> | R,
  ) => Promise<R | false>;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  setErrors: React.Dispatch<
    React.SetStateAction<Record<string, string | null>>
  >;
}

export function useFormManager<
  T extends Record<string, any> = Record<string, any>,
>(
  initialData?: T,
  validationRules?: Record<string, ValidationRule>,
): FormManagerResult<T>;

// ─── useStages ──────────────────────────────────────────────────────────────

interface Stage {
  id?: string;
  _id?: string;
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

interface StageOption {
  value: string | undefined;
  label: string;
  slug?: string;
  icon?: string;
  description?: string;
}

interface StagesOptions {
  apiClient?: {
    get: (url: string) => Promise<{ data: any }>;
    post: (url: string, data: any) => Promise<{ data: any }>;
    put: (url: string, data: any) => Promise<{ data: any }>;
    delete: (url: string) => Promise<{ data: any }>;
  } | null;
  preferAdminCounts?: boolean;
}

interface StagesResult {
  stages: Stage[];
  loading: boolean;
  error: string | null;

  fetchStages: () => Promise<void>;
  fetchStagesWithCategories: () => Promise<any[]>;
  fetchStagesWithTestCounts: () => Promise<any[]>;
  fetchStageById: (id: string) => Promise<Stage | null>;
  fetchStageBySlug: (slug: string) => Promise<Stage | null>;
  fetchCategoriesForStage: (stageId: string) => Promise<any[]>;
  fetchCategoryTreeForStage: (stageId: string) => Promise<any[]>;
  fetchTestsForStage: (stageId: string) => Promise<any[]>;
  fetchStageDetailsAdmin: (stageId: string) => Promise<any | null>;

  getStageName: (stageId: string) => string | null;
  getStageById: (stageId: string) => Stage | null;
  getStageOptions: () => StageOption[];
  getStageNames: () => string[];

  refresh: () => Promise<void>;
  createStage: (stageData: Partial<Stage>) => Promise<any>;
  updateStage: (id: string, stageData: Partial<Stage>) => Promise<any>;
  deleteStage: (id: string) => Promise<any>;
}

export function useStages(options?: StagesOptions): StagesResult;

// ─── useProPass ──────────────────────────────────────────────────────────────

type UrgencyLevel = "active" | "critical" | "warning" | "notice" | "expired";

interface ProPassResult {
  isProUser: boolean;
  isActive: boolean;
  isExpired: boolean;
  isAdmin: boolean;

  expiryDate: string | null;
  formattedExpiry: string | null;
  formattedStartDate: string | null;
  remainingDays: number | null;

  statusText: string;
  urgencyLevel: UrgencyLevel;
  isExpiringWithin: (days: number) => boolean;
  isExpiringSoon: boolean;

  hasProPass: boolean;
  user: any;
}

export function useProPass(): ProPassResult;
export function initProPassAuth(useAuthHook: () => { user: any }): void;
export function formatRemainingDays(days: number | null): string;
export function getUrgencyColors(urgencyLevel: UrgencyLevel): {
  bg: string;
  text: string;
  badge: string;
  border: string;
};

// ─── useExamCategories ──────────────────────────────────────────────────────

interface ExamCategory {
  id?: string;
  _id?: string;
  label?: string;
  slug?: string;
  categoryId?: string;
  name?: string;
  icon?: string;
  isActive?: boolean;
  order?: number;
  description?: string;
}

interface ExamInfo {
  examId?: string;
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  fullName?: string;
  categoryId?: string;
  parentCategoryId?: string;
  isActive?: boolean;
  display_order?: number;
  displayOrder?: number;
}

interface ExamOption {
  value: string | undefined;
  label: string | undefined;
  fullName?: string;
}

interface ExamCategoriesResult {
  categories: ExamCategory[];
  examInfo: ExamInfo[];
  exams: ExamInfo[];
  loading: boolean;
  error: string | null;

  fetchCategories: () => Promise<void>;
  fetchExamInfo: () => Promise<void>;
  fetchExams: () => Promise<void>;

  getExamsByCategory: (categoryId: string) => ExamOption[];
  getAllExams: () => ExamOption[];
  getExamById: (examId: string) => ExamInfo | undefined;

  getExamsFromExamInfo: (categoryId: string) => ExamOption[];
  getAllExamsFromExamInfo: () => ExamOption[];
  getCategoryLabel: (categoryId: string) => string;
  getExamInfo: (categoryId: string, examId: string) => ExamInfo | undefined;

  refresh: () => void;
}

export function useExamCategories(): ExamCategoriesResult;

// ─── useTestCategories ──────────────────────────────────────────────────────

interface TestCategory {
  _id?: string;
  id?: string;
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
  level?: number;
  parentId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

interface TestCategoryTreeNode extends TestCategory {
  children?: TestCategoryTreeNode[];
}

interface TestCategoryOption {
  value: string | undefined;
  label: string;
  id: string | undefined;
  slug?: string;
  icon?: string;
  level: number;
  parentId?: string | null;
}

interface FeaturedExam {
  id: string | undefined;
  title: string;
  icon: string;
  desc: string;
  color: string;
}

interface TestCategoriesResult {
  categories: TestCategory[];
  tree: TestCategoryTreeNode[];
  roots: TestCategory[];
  loading: boolean;
  error: string | null;

  fetchCategories: () => Promise<void>;
  fetchTree: () => Promise<void>;
  fetchRoots: () => Promise<void>;

  buildTree: (
    items: TestCategory[],
    parentId?: string | null,
  ) => TestCategoryTreeNode[];
  getCategoryOptions: () => TestCategoryOption[];
  getRootCategoryNames: () => string[];
  getFeaturedExams: () => FeaturedExam[];
  getCategoryEmoji: (categoryName: string) => string;
  getCategoryColor: (categoryName: string) => string;

  refresh: () => Promise<void>;
}

export function useTestCategories(): TestCategoriesResult;

// ─── useGenericCRUD ─────────────────────────────────────────────────────────

interface GenericCRUDConfig {
  endpoint: string;
  api: {
    get: (url: string, config?: any) => Promise<{ data: any }>;
    post: (url: string, data: any) => Promise<{ data: any }>;
    put: (url: string, data: any) => Promise<{ data: any }>;
    delete: (url: string) => Promise<{ data: any }>;
  };
  defaultFormData?: Record<string, any>;
  getSuccessMessage?: (action: string, itemName: string) => string;
  getErrorMessage?: (action: string, itemName: string) => string;
  useAdminAPI?: boolean;
  confirmFn?: (message: string) => boolean;
  notifyFn?: (type: "success" | "error", message: string) => Promise<void>;
}

interface GenericCRUDResult {
  items: any[];
  loading: boolean;
  showForm: boolean;
  editingId: string | null;
  formData: Record<string, any>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;

  fetchItems: (queryParams?: Record<string, any>) => Promise<any[]>;
  saveItem: (
    customData?: Record<string, any> | null,
    id?: string | null,
  ) => Promise<boolean>;
  deleteItem: (id: string, confirmMessage?: string) => Promise<boolean>;
  editItem: (item: Record<string, any>) => void;
  resetForm: () => void;
  toggleActive: (item: Record<string, any>) => Promise<boolean>;

  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useGenericCRUD(config: GenericCRUDConfig): GenericCRUDResult;

// ─── useDraggableScroll ─────────────────────────────────────────────────────

export function useDraggableScroll(): RefObject<HTMLElement>;

// ─── useWebSocket ───────────────────────────────────────────────────────────

interface WebSocketResult {
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  socketRef: React.MutableRefObject<Socket | null>;
}

export function useWebSocket(): WebSocketResult;

// ─── EmptyState ─────────────────────────────────────────────────────────────

import { ComponentType, ReactNode } from "react";

type IllustrationType = "search" | "empty" | "error" | "success";

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  illustration?: IllustrationType;
  customIllustration?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "primary" | "secondary";
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

declare const EmptyState: React.FC<EmptyStateProps>;
export default EmptyState;

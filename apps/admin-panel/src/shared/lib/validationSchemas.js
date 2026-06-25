import { z } from 'zod'

export const questionSchema = z.object({
  questionText: z.string().min(10, 'Question must be at least 10 characters'),
  type: z.enum(['mcq', 'msq', 'numeric', 'numerical', 'true-false', 'match', 'comprehension', 'descriptive']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  options: z.array(z.string()).min(2, 'At least 2 options required').optional(),
  correctOption: z.number().min(0).optional(),
  marks: z.number().min(0).default(2),
  negativeMarks: z.number().min(0).default(0),
  explanation: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  subject: z.string().optional(),
  chapter: z.string().optional(),
  topic: z.string().optional(),
  section: z.string().optional(),
  testId: z.string().nullable().optional(),
  passageId: z.string().nullable().optional()
})

export const testSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  totalQuestions: z.number().min(0).default(0),
  totalMarks: z.number().min(0),
  passingMarks: z.number().min(0),
  negativeMarking: z.number().min(0),
  difficulty: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(['draft', 'active', 'published', 'archived']).default('draft'),
  isPro: z.boolean().default(false)
})

export const examSchema = z.object({
  examId: z.string().min(2, 'Exam ID must be at least 2 characters'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  fullName: z.string().optional(),
  description: z.string().optional(),
  displayOrder: z.number().default(0),
  year: z.number().min(2000).max(2100),
  isActive: z.boolean().default(true)
})

export const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  icon: z.string().optional(),
  description: z.string().optional(),
  displayOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  parentId: z.string().optional().nullable()
})

export const stageSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().default(0),
  examIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true)
})

export const testSeriesSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  examId: z.string().min(1, 'Exam is required'),
  categoryId: z.string().optional(),
  price: z.number().min(0).default(0),
  originalPrice: z.number().min(0).optional(),
  discount: z.number().min(0).max(100).optional(),
  validity: z.number().min(1, 'Validity must be at least 1 day').optional(),
  isPro: z.boolean().default(false),
  image: z.string().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
})

export const sectionSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  testId: z.string().min(1, 'Test is required'),
  questionCount: z.number().min(0).default(0),
  marks: z.number().min(0).default(0),
  duration: z.number().min(0).optional(),
  order: z.number().default(0),
  status: z.enum(['draft', 'active']).default('draft')
})

export const quizSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  testId: z.string().optional(),
  sectionId: z.string().optional(),
  questionCount: z.number().min(0).default(0),
  timeLimit: z.number().min(0).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  isPro: z.boolean().default(false)
})

export const topicSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().regex(/^[a-z0-9-]*$/, 'Slug must be lowercase letters, numbers, and hyphens').optional(),
  subjectId: z.string().min(1, 'Subject is required'),
  chapterId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  order: z.number().default(0),
  isActive: z.boolean().default(true)
})

export const examSeasonSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  year: z.number().min(2000).max(2100, 'Year must be between 2000 and 2100'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
})

export const examInfoSchema = z.object({
  examId: z.string().min(2, 'Exam ID must be at least 2 characters'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  fullName: z.string().optional(),
  description: z.string().optional(),
  eligibility: z.string().optional(),
  syllabus: z.string().optional(),
  examDate: z.string().optional(),
  applicationDeadline: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  displayOrder: z.number().default(0),
  isActive: z.boolean().default(true)
})

export const couponSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  minPurchase: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  usageLimit: z.number().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
  applicablePlans: z.array(z.string()).optional()
})

export const subscriptionPlanSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  originalPrice: z.number().min(0).optional(),
  duration: z.number().min(1, 'Duration must be at least 1 day'),
  durationUnit: z.enum(['day', 'month', 'year']).default('month'),
  features: z.array(z.string()).optional(),
  isPro: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0)
})

export const notificationSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  type: z.enum(['info', 'warning', 'success', 'error']).default('info'),
  targetAudience: z.enum(['all', 'free', 'pro', 'custom']).default('all'),
  targetUsers: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
  actionUrl: z.string().url().optional().or(z.literal(''))
})

export const bannerSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  imageUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  linkUrl: z.string().url().optional().or(z.literal('')),
  position: z.enum(['home-top', 'home-bottom', 'dashboard', 'test-page']).default('home-top'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0)
})

export const faqSchema = z.object({
  question: z.string().min(10, 'Question must be at least 10 characters'),
  answer: z.string().min(10, 'Answer must be at least 10 characters'),
  category: z.string().optional(),
  order: z.number().default(0),
  isActive: z.boolean().default(true)
})

export const emailTemplateSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  type: z.string().min(1, 'Type is required'),
  htmlContent: z.string().min(10, 'Content must be at least 10 characters'),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true)
})

export const tagConfigSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  color: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
})

export const subjectRelationSchema = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  relatedSubjectId: z.string().min(1, 'Related subject is required'),
  relationType: z.enum(['prerequisite', 'related', 'continuation']),
  strength: z.number().min(0).max(1).optional()
})

export function validateForm(schema, data) {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated, errors: {} }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = {}
      error.issues.forEach((err) => {
        const path = err.path.join('.')
        errors[path] = err.message
      })
      return { success: false, data: null, errors }
    }
    return { success: false, data: null, errors: { _form: error.message } }
  }
}

export default {
  questionSchema,
  testSchema,
  examSchema,
  categorySchema,
  stageSchema,
  testSeriesSchema,
  sectionSchema,
  quizSchema,
  topicSchema,
  examSeasonSchema,
  examInfoSchema,
  couponSchema,
  subscriptionPlanSchema,
  notificationSchema,
  bannerSchema,
  faqSchema,
  emailTemplateSchema,
  tagConfigSchema,
  subjectRelationSchema,
  validateForm
}

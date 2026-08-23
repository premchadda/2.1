import { z } from 'zod'

export const questionSchema = z.object({
  questionText: z.string().min(10, 'Question must be at least 10 characters'),
  type: z.enum(['mcq', 'msq', 'numeric', 'true-false', 'match', 'comprehension', 'descriptive']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  options: z.array(z.string()).min(2, 'At least 2 options required'),
  correctOption: z.number().min(0).max(7, 'Maximum 8 options supported').optional(),
  marks: z.number().min(1, 'Marks must be at least 1').default(2),
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
  totalQuestions: z.number().min(1, 'Test must have at least 1 question').default(1),
  totalMarks: z.number().min(0),
  passingMarks: z.number().min(0),
  negativeMarking: z.number().min(0),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  type: z.enum(['full-test', 'sectional', 'topic-test', 'practice', 'quiz']).optional(),
  status: z.enum(['draft', 'active', 'published', 'archived']).default('draft'),
  isPro: z.boolean().default(false)
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




export const topicSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens').optional(),
  subjectId: z.string().min(1, 'Subject is required'),
  chapterId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  order: z.number().default(0),
  isActive: z.boolean().default(true)
})









.refine(data => data.subjectId !== data.relatedSubjectId, {
  message: 'A subject cannot be a prerequisite of itself',
  path: ['relatedSubjectId']
})

export function validateForm(schema, data) {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data, errors: {} }

  const errors = {}
  const issues = result.error?.errors ?? result.error?.issues ?? []
  issues.forEach((err) => {
    const path = Array.isArray(err.path) ? err.path.join('.') : String(err.path || '_error')
    const key = path || '_error'
    if (!errors[key]) errors[key] = []
    errors[key].push(err.message)
  })
  return { success: false, data: null, errors }
}

export default {
  questionSchema,
  testSchema,
  categorySchema,
  stageSchema,
  topicSchema,
  validateForm
}

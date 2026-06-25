import { describe, it, expect } from 'vitest'
import {
  questionSchema,
  testSchema,
  categorySchema,
  stageSchema,
  validateForm
} from '../shared/lib/validationSchemas'

describe('validateForm', () => {
  it('returns success for valid question data', () => {
    const result = validateForm(questionSchema, {
      questionText: 'What is the capital of France?',
      type: 'mcq',
      difficulty: 'medium',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correctOption: 1,
      marks: 2,
      negativeMarks: 0,
      status: 'draft'
    })
    expect(result.success).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('returns errors for missing required fields', () => {
    const result = validateForm(questionSchema, {
      questionText: 'Hi',
      type: 'mcq',
      difficulty: 'medium'
    })
    expect(result.success).toBe(false)
    expect(result.errors.questionText).toBeDefined()
  })

  it('returns errors for invalid enum values', () => {
    const result = validateForm(questionSchema, {
      questionText: 'What is the capital of France?',
      type: 'invalid',
      difficulty: 'medium'
    })
    expect(result.success).toBe(false)
    expect(result.errors.type).toBeDefined()
  })
})

describe('testSchema', () => {
  it('validates complete test data', () => {
    const result = validateForm(testSchema, {
      title: 'Mock Test 1',
      duration: 60,
      totalQuestions: 50,
      totalMarks: 100,
      passingMarks: 33,
      negativeMarking: 0.25,
      status: 'draft',
      isPro: false
    })
    expect(result.success).toBe(true)
  })

  it('rejects short titles', () => {
    const result = validateForm(testSchema, { title: 'AB', duration: 60 })
    expect(result.success).toBe(false)
    expect(result.errors.title).toBeDefined()
  })
})

describe('categorySchema', () => {
  it('validates valid category', () => {
    const result = validateForm(categorySchema, {
      name: 'Engineering',
      slug: 'engineering',
      displayOrder: 1,
      isActive: true
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid slug format', () => {
    const result = validateForm(categorySchema, {
      name: 'Test',
      slug: 'Invalid Slug!',
      displayOrder: 0
    })
    expect(result.success).toBe(false)
    expect(result.errors.slug).toBeDefined()
  })
})

describe('stageSchema', () => {
  it('validates valid stage', () => {
    const result = validateForm(stageSchema, {
      name: 'Prelims',
      slug: 'prelims',
      order: 1,
      isActive: true
    })
    expect(result.success).toBe(true)
  })
})

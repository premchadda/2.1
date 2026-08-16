import { createSchema } from '../../middleware/validation/inputValidation.js';

export const createTestSchema = createSchema()
  .field('title', { type: 'string', required: true, minLength: 3, maxLength: 255 })
  .field('description', { type: 'string', required: false, maxLength: 5000 })
  .field('duration', { type: 'integer', required: true, min: 1 })
  .field('total_questions', { type: 'integer', required: true, min: 1 })
  .field('total_marks', { type: 'integer', required: true, min: 1 })
  .field('negative_marking', { type: 'number', required: false })
  .field('difficulty', { type: 'string', required: false, custom: v => ['easy', 'medium', 'hard'].includes(v) })

export const submitAttemptSchema = createSchema()
  .field('answers', { type: 'array', required: true })
  .field('time_taken', { type: 'integer', required: true, min: 0 })

export default createSchema();

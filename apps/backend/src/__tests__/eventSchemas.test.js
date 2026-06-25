import { validateDomainEvent } from '../infrastructure/events/eventSchemas.js'

describe('Domain Event Zod Contract Schemas', () => {
  describe('test_started Event', () => {
    test('successfully validates a valid test_started payload', () => {
      const validPayload = {
        source: 'tests-engine',
        userId: 42,
        testId: 10,
        attemptId: 999
      }
      
      const validated = validateDomainEvent('test_started', validPayload)
      expect(validated.eventType).toBe('test_started')
      expect(validated.eventVersion).toBe(1)
      expect(validated.payload).toEqual(validPayload)
    })

    test('throws error for invalid test_started payload', () => {
      const invalidPayload = {
        source: 'tests-engine',
        userId: 42,
        testId: 10
        // missing attemptId
      }
      
      expect(() => validateDomainEvent('test_started', invalidPayload)).toThrow()
    })
  })

  describe('test_submitted Event', () => {
    test('successfully validates a valid test_submitted payload', () => {
      const validPayload = {
        source: 'tests',
        userId: 'user_abc',
        testId: 'test_xyz',
        attemptId: 1234,
        score: 95.5,
        totalMarks: 100
      }
      
      const validated = validateDomainEvent('test_submitted', validPayload)
      expect(validated.eventType).toBe('test_submitted')
      expect(validated.eventVersion).toBe(1)
      expect(validated.payload).toEqual(validPayload)
    })

    test('throws error for negative score or non-positive totalMarks', () => {
      const invalidPayload1 = {
        source: 'tests',
        userId: 42,
        testId: 10,
        attemptId: 999,
        score: -5, // invalid
        totalMarks: 100
      }

      const invalidPayload2 = {
        source: 'tests',
        userId: 42,
        testId: 10,
        attemptId: 999,
        score: 10,
        totalMarks: -50 // invalid
      }
      
      expect(() => validateDomainEvent('test_submitted', invalidPayload1)).toThrow()
      expect(() => validateDomainEvent('test_submitted', invalidPayload2)).toThrow()
    })
  })
})

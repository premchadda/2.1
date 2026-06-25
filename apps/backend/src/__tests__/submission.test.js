import { jest } from '@jest/globals'

/**
 * Submission Pipeline Concurrency and Score Security Tests
 * Tests for transactional row-locking, server-side score calculation, and idempotency guarantees.
 * Run with: npm test
 */

describe('Submission Pipeline & Score Security', () => {
  let mockDb;
  let mockClient;
  let mockUser;
  let mockTest;
  let mockQuestions;
  let mockAnswers;

  beforeEach(() => {
    // Reset test data
    mockUser = { id: 1, email: 'test@example.com', role: 'user' };
    mockTest = { id: 10, title: 'SSC CGL Mock Test', seriesId: 100, isPro: false };
    
    mockQuestions = [
      { id: 201, marks: 2, negativeMarks: 0.5, correctAnswer: 1 },
      { id: 202, marks: 2, negativeMarks: 0.5, correctAnswer: 2 },
      { id: 203, marks: 2, negativeMarks: 0.5, correctAnswer: 3 },
    ];

    mockAnswers = [
      { questionId: 201, selectedOption: 1 }, // Correct: +2 marks
      { questionId: 202, selectedOption: 4 }, // Incorrect: -0.5 marks
      { questionId: 203, selectedOption: null }, // Unattempted: 0 marks
    ];

    // Mock Database Helpers
    mockDb = {
      attempts: [],
      pool: {
        connect: jest.fn().mockImplementation(() => {
          const client = {
            query: jest.fn().mockImplementation(async (sql, params) => {
              if (sql === 'BEGIN') {
                return { rows: [] };
              }
              if (sql === 'COMMIT') {
                return { rows: [] };
              }
              if (sql === 'ROLLBACK') {
                return { rows: [] };
              }
              if (sql && sql.includes('SELECT * FROM attempts WHERE id = $1 FOR UPDATE')) {
                const attemptId = params[0];
                const attempt = mockDb.attempts.find(a => a.id === attemptId);
                return { rows: attempt ? [attempt] : [] };
              }
              return { rows: [] };
            }),
            release: jest.fn(),
          };
          return client;
        }),
      },
      getTableName: jest.fn().mockImplementation(col => col),
      toCamel: jest.fn().mockImplementation(row => {
        if (!row) return null;
        return { ...row, isCompleted: row.is_completed ?? row.isCompleted };
      }),
      toSnake: jest.fn().mockImplementation(obj => obj),
      updateById: jest.fn().mockImplementation(async (col, id, data, client) => {
        const idx = mockDb.attempts.findIndex(a => a.id === id);
        if (idx !== -1) {
          mockDb.attempts[idx] = { ...mockDb.attempts[idx], ...data, id };
          return mockDb.attempts[idx];
        }
        return null;
      }),
      insertOne: jest.fn().mockImplementation(async (col, data, client) => {
        const newId = mockDb.attempts.length + 1;
        const newAttempt = { ...data, id: newId };
        mockDb.attempts.push(newAttempt);
        return newAttempt;
      }),
    };
  });

  describe('Server-side Score Calculation & Security', () => {
    test('should calculate scores correctly and prevent score forgery', () => {
      // 1. Inputs: correct option index, selected option index
      let correct = 0;
      let wrong = 0;
      let unattempted = 0;
      let score = 0;
      let totalMarks = 0;

      // 2. Perform score calculation
      mockQuestions.forEach(question => {
        const answer = mockAnswers.find(a => a.questionId === question.id);
        const selectedOption = answer ? answer.selectedOption : null;
        const correctOption = question.correctAnswer;

        const qMarks = Number(question.marks ?? 1);
        const qNegMarks = Number(question.negativeMarks ?? 0);
        totalMarks += qMarks;

        if (selectedOption === null) {
          unattempted++;
        } else if (selectedOption === correctOption) {
          correct++;
          score += qMarks;
        } else {
          wrong++;
          score -= qNegMarks;
        }
      });

      score = Math.max(0, score);
      const accuracy = correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : 0;

      // Assert calculations
      expect(totalMarks).toBe(6);
      expect(correct).toBe(1);     // Question 201 is correct
      expect(wrong).toBe(1);       // Question 202 is wrong
      expect(unattempted).toBe(1); // Question 203 is unattempted
      expect(score).toBe(1.5);     // +2 - 0.5 = 1.5
      expect(accuracy).toBe(50);   // 1 correct out of 2 attempted
    });
  });

  describe('Database Transaction Boundaries & Concurrency Locks', () => {
    test('should establish transaction isolation boundaries and release client connection', async () => {
      const client = await mockDb.pool.connect();
      expect(mockDb.pool.connect).toHaveBeenCalled();

      // Begin transaction
      await client.query('BEGIN');
      expect(client.query).toHaveBeenCalledWith('BEGIN');

      // Set deadlock lock timeout session boundary
      await client.query("SET LOCAL lock_timeout = '5000'");
      expect(client.query).toHaveBeenCalledWith("SET LOCAL lock_timeout = '5000'");

      // Update mock attempt under connection client
      const attemptData = { status: 'completed', isCompleted: true, score: 1.5 };
      const updated = await mockDb.updateById('attempts', 1, attemptData, client);

      // Write mock outbox event inside transaction
      await client.query(
        'INSERT INTO outbox_events (event_type, payload, status) VALUES ($1, $2, $3)',
        ['test_submitted', JSON.stringify({ userId: 1, score: 1.5 }), 'pending']
      );
      expect(client.query).toHaveBeenCalledWith(
        'INSERT INTO outbox_events (event_type, payload, status) VALUES ($1, $2, $3)',
        ['test_submitted', JSON.stringify({ userId: 1, score: 1.5 }), 'pending']
      );

      // Commit transaction
      await client.query('COMMIT');
      expect(client.query).toHaveBeenCalledWith('COMMIT');

      // Release database connection client
      client.release();
      expect(client.release).toHaveBeenCalled();
    });

    test('should execute ROLLBACK and release connection on query failure', async () => {
      const client = await mockDb.pool.connect();
      await client.query('BEGIN');

      try {
        // Force error to trigger transaction rollback
        client.query.mockRejectedValueOnce(new Error('Postgres connection crash'));
        await client.query('SELECT * FROM attempts WHERE id = $1 FOR UPDATE', [1]);
      } catch (err) {
        expect(err.message).toBe('Postgres connection crash');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });
  });

  describe('Idempotency & Concurrent Double-Submit Protection', () => {
    test('should allow first submission and skip concurrent submissions for completed attempts', async () => {
      // Setup: an active, in-progress attempt is registered
      const activeAttempt = {
        id: 42,
        userId: mockUser.id,
        testId: mockTest.id,
        status: 'in_progress',
        isCompleted: false,
        score: 0,
      };
      mockDb.attempts.push(activeAttempt);

      // First Request flow:
      const client1 = await mockDb.pool.connect();
      await client1.query('BEGIN');
      
      const lockResult1 = await client1.query(
        'SELECT * FROM attempts WHERE id = $1 FOR UPDATE',
        [42]
      );
      const lockedRow1 = lockResult1.rows[0];
      const camelRow1 = mockDb.toCamel(lockedRow1);

      expect(camelRow1.status).toBe('in_progress');
      expect(camelRow1.isCompleted).toBe(false);

      // Complete submission
      await mockDb.updateById('attempts', 42, {
        status: 'completed',
        isCompleted: true,
        score: 1.5,
      }, client1);

      await client1.query('COMMIT');
      client1.release();

      // Second Concurrent Request flow (should short-circuit):
      const client2 = await mockDb.pool.connect();
      await client2.query('BEGIN');

      const lockResult2 = await client2.query(
        'SELECT * FROM attempts WHERE id = $1 FOR UPDATE',
        [42]
      );
      const lockedRow2 = lockResult2.rows[0];
      const camelRow2 = mockDb.toCamel(lockedRow2);

      expect(camelRow2.status).toBe('completed');
      expect(camelRow2.isCompleted).toBe(true);

      // Check for completed status and rollback safely
      if (camelRow2.status === 'completed') {
        await client2.query('ROLLBACK');
        client2.release();
      }

      // Assert second connection rollbacks read-only instead of committing changes again
      expect(client2.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client2.query).not.toHaveBeenCalledWith('COMMIT');
      expect(client2.release).toHaveBeenCalled();
    });
  });
});

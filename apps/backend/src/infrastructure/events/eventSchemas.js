import { z } from 'zod';

export const EVENT_VERSION = 1;

export const TestStartedSchema = z.object({
  source: z.string(),
  userId: z.union([z.number(), z.string()]),
  testId: z.union([z.number(), z.string()]),
  attemptId: z.union([z.number(), z.string()]),
});

export const TestSubmittedSchema = z.object({
  source: z.string(),
  userId: z.union([z.number(), z.string()]),
  testId: z.union([z.number(), z.string()]),
  attemptId: z.union([z.number(), z.string()]),
  score: z.number().nonnegative(),
  totalMarks: z.number().positive(),
});

export const QuestionAnsweredSchema = z.object({
  source: z.string(),
  userId: z.union([z.number(), z.string()]),
  testId: z.union([z.number(), z.string()]),
  attemptId: z.union([z.number(), z.string()]),
  questionId: z.union([z.number(), z.string()]),
  selectedOption: z.number().int().nonnegative(),
  isCorrect: z.boolean(),
});

export const SubscriptionPurchasedSchema = z.object({
  source: z.string(),
  userId: z.union([z.number(), z.string()]),
  planId: z.union([z.number(), z.string()]),
  amount: z.number().nonnegative(),
  currency: z.string().default('INR'),
});

export const LeaderboardUpdatedSchema = z.object({
  source: z.string(),
  leaderboardId: z.union([z.number(), z.string()]),
  entries: z.array(z.object({
    userId: z.union([z.number(), z.string()]),
    score: z.number(),
    rank: z.number().int().positive(),
  })).optional(),
});

export const NotificationSentSchema = z.object({
  source: z.string(),
  userId: z.union([z.number(), z.string()]),
  channel: z.enum(['in_app', 'email', 'push']),
  title: z.string(),
  message: z.string(),
});

export const DomainEventSchemas = {
  test_started: TestStartedSchema,
  test_submitted: TestSubmittedSchema,
  question_answered: QuestionAnsweredSchema,
  subscription_purchased: SubscriptionPurchasedSchema,
  leaderboard_updated: LeaderboardUpdatedSchema,
  notification_sent: NotificationSentSchema,
};

/**
 * Validates outbox event payload against schema contract.
 * Returns validated payload and contract event_version.
 */
export const validateDomainEvent = (eventType, payload) => {
  const schema = DomainEventSchemas[eventType];
  if (!schema) {
    throw new Error(`[Event Taxonomy] Unknown domain event type: ${eventType}`);
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`[Event Taxonomy] Invalid payload for event "${eventType}": ${result.error.message}`);
  }

  return {
    eventType,
    eventVersion: EVENT_VERSION,
    payload: result.data,
  };
};

import { describe, it, expect } from "vitest";
import {
  questionSchema,
  testSchema,
  categorySchema,
  stageSchema,
  topicSchema,
  subjectRelationSchema,
  paymentRefundSchema,
  moderationActionSchema,
  twoFactorSchema,
  enrollmentSchema,
  liveTestSchema,
  validateForm,
} from "../shared/lib/validationSchemas";

describe("validateForm", () => {
  it("returns success for valid question data", () => {
    const result = validateForm(questionSchema, {
      questionText: "What is the capital of France?",
      type: "mcq",
      difficulty: "medium",
      options: ["London", "Paris", "Berlin", "Madrid"],
      correctOption: 1,
      marks: 2,
      negativeMarks: 0,
      status: "draft",
    });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns errors for missing required fields", () => {
    const result = validateForm(questionSchema, {
      questionText: "Hi",
      type: "mcq",
      difficulty: "medium",
    });
    expect(result.success).toBe(false);
    expect(result.errors.questionText).toBeDefined();
  });

  it("returns errors for invalid enum values", () => {
    const result = validateForm(questionSchema, {
      questionText: "What is the capital of France?",
      type: "invalid",
      difficulty: "medium",
    });
    expect(result.success).toBe(false);
    expect(result.errors.type).toBeDefined();
  });
});

describe("testSchema", () => {
  it("validates complete test data", () => {
    const result = validateForm(testSchema, {
      title: "Mock Test 1",
      duration: 60,
      totalQuestions: 50,
      totalMarks: 100,
      passingMarks: 33,
      negativeMarking: 0.25,
      status: "draft",
      isPro: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects short titles", () => {
    const result = validateForm(testSchema, { title: "AB", duration: 60 });
    expect(result.success).toBe(false);
    expect(result.errors.title).toBeDefined();
  });
});

describe("categorySchema", () => {
  it("validates valid category", () => {
    const result = validateForm(categorySchema, {
      name: "Engineering",
      slug: "engineering",
      displayOrder: 1,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid slug format", () => {
    const result = validateForm(categorySchema, {
      name: "Test",
      slug: "Invalid Slug!",
      displayOrder: 0,
    });
    expect(result.success).toBe(false);
    expect(result.errors.slug).toBeDefined();
  });
});

describe("stageSchema", () => {
  it("validates valid stage", () => {
    const result = validateForm(stageSchema, {
      name: "Prelims",
      slug: "prelims",
      order: 1,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("topicSchema", () => {
  it("validates valid topic", () => {
    const result = validateForm(topicSchema, {
      name: "Algebra Basics",
      slug: "algebra-basics",
      subjectId: "subj-1",
      order: 0,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing subjectId", () => {
    const result = validateForm(topicSchema, { name: "Algebra Basics" });
    expect(result.success).toBe(false);
    expect(result.errors.subjectId).toBeDefined();
  });
});

describe("subjectRelationSchema", () => {
  it("validates valid relation", () => {
    const result = validateForm(subjectRelationSchema, {
      subjectId: "subj-1",
      relatedSubjectId: "subj-2",
      relationType: "prerequisite",
    });
    expect(result.success).toBe(true);
  });

  it("rejects self-referencing relation", () => {
    const result = validateForm(subjectRelationSchema, {
      subjectId: "subj-1",
      relatedSubjectId: "subj-1",
    });
    expect(result.success).toBe(false);
    expect(result.errors["relatedSubjectId"]).toBeDefined();
  });
});

describe("paymentRefundSchema", () => {
  it("validates refund with transaction id only", () => {
    const result = validateForm(paymentRefundSchema, {
      transactionId: "txn_123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing transaction id", () => {
    const result = validateForm(paymentRefundSchema, {});
    expect(result.success).toBe(false);
    expect(result.errors.transactionId).toBeDefined();
  });
});

describe("moderationActionSchema", () => {
  it("validates moderation approve action", () => {
    const result = validateForm(moderationActionSchema, {
      doubtId: "doubt-1",
      status: "approved",
      note: "Looks good",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = validateForm(moderationActionSchema, {
      doubtId: "doubt-1",
      status: "bogus",
    });
    expect(result.success).toBe(false);
    expect(result.errors.status).toBeDefined();
  });
});

describe("twoFactorSchema", () => {
  it("validates 6-digit code", () => {
    const result = validateForm(twoFactorSchema, { token: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects non-6-digit code", () => {
    const result = validateForm(twoFactorSchema, { token: "123" });
    expect(result.success).toBe(false);
    expect(result.errors.token).toBeDefined();
  });
});

describe("enrollmentSchema", () => {
  it("validates enrollment with series", () => {
    const result = validateForm(enrollmentSchema, {
      userId: "user-1",
      seriesId: "series-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects enrollment with neither series nor exam", () => {
    const result = validateForm(enrollmentSchema, { userId: "user-1" });
    expect(result.success).toBe(false);
  });
});

describe("liveTestSchema", () => {
  it("validates minimal live test", () => {
    const result = validateForm(liveTestSchema, { title: "Live Mock 1" });
    expect(result.success).toBe(true);
  });

  it("rejects short title", () => {
    const result = validateForm(liveTestSchema, { title: "AB" });
    expect(result.success).toBe(false);
    expect(result.errors.title).toBeDefined();
  });
});

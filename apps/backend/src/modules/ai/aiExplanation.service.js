/**
 * AI Explanation Service
 *
 * Generates explanations for questions using AI models.
 * Supports:
 * - Single question explanation generation
 * - Bulk explanation generation
 * - Explanation improvement/rewriting
 * - Multi-language explanations
 * - Cost tracking and rate limiting
 */

import { pool } from "../../infrastructure/database/postgres-helpers.js";
import AiGenerationLog from "../../data/models/ai/AiGenerationLog.js";
import { AI_CONFIG, callAIWithFallback } from "./aiClient.js";
import { sanitizeForPrompt } from "./aiMentor.service.js";

/**
 * Call AI API for text generation.
 */
async function callAI(prompt, options = {}) {
  const systemPrompt =
    options.systemPrompt ||
    "You are an expert educator creating clear, accurate explanations for exam questions.";
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];
  return callAIWithFallback(messages, {
    model: options.model,
    maxTokens: options.maxTokens || AI_CONFIG.maxTokens,
    temperature: options.temperature || AI_CONFIG.temperature,
  });
}

const aiExplanationService = {
  /**
   * Generate explanation for a single question.
   */
  async generateExplanation(questionId, options = {}) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      // Get question
      const questionResult = await client.query(
        `SELECT id, question_text, question_text_hi, options, options_hi, correct_answer, correct_option, explanation, explanation_hi, marks, negative_marks, difficulty, question_type, category, sub_category_id, tags, status, is_active, is_practice, question_number, test_id, series_id, section_id, subject, subject_id, chapter_id, topic_id, topic, quiz_id, study_material_id, image_asset_id, image_url, passage_id, created_by, category_id, external_question_id, language, solution_image_url, source, imported_from, is_deleted, deleted_by, deleted_at, created_at, updated_at FROM questions WHERE id = $1`,
        [questionId],
      );

      if (questionResult.rows.length === 0) {
        throw new Error("Question not found");
      }

      const question = questionResult.rows[0];

      // BUGFIX (first-option-marked-correct): NULL means the mark scheme is
      // unknown — never ask the AI to explain a fabricated "Option 1".
      if (
        question.correct_option === null ||
        question.correct_option === undefined
      ) {
        throw new Error(
          "Question has no correct answer set. Fix the mark scheme (Audit tab) before generating an explanation.",
        );
      }

      const feature = `explanation:${options.language || "en"}`;
      const modelName = options.model || AI_CONFIG.model;

      // practice_ai_cache (Practice↔Test bridge): reuse a fresh cached
      // explanation instead of re-billing the LLM for repeat generations.
      // Keyed by (question_id, feature, model); entries older than 24h are
      // regenerated so stale pedagogy doesn't stick around.
      try {
        const cached = await client.query(
          `SELECT content, model, generated_at FROM practice_ai_cache
           WHERE question_id = $1 AND feature = $2 AND model = $3
             AND generated_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
          [questionId, feature, modelName],
        );
        if (cached.rows.length > 0) {
          const content = cached.rows[0].content || {};
          return {
            questionId,
            explanation: content.explanation,
            model: cached.rows[0].model,
            tokens: 0,
            latencyMs: 0,
            cached: true,
          };
        }
      } catch {
        /* cache table missing/unavailable — fall through to generation */
      }

      // Build prompt
      const prompt = this.buildExplanationPrompt(question, options);

      // Call AI
      let aiResult;
      try {
        aiResult = await callAI(prompt, {
          model: options.model,
          maxTokens: options.maxTokens || 1500,
          systemPrompt:
            options.systemPrompt || this.getSystemPrompt(options.language),
        });
      } catch (genErr) {
        await AiGenerationLog.logFailure({
          entityType: "explanation",
          entityId: questionId,
          prompt: prompt.substring(0, 500),
          model: modelName,
          provider: AI_CONFIG.provider,
          errorMessage: genErr?.message || "Generation failed",
          metadata: { language: options.language || "en" },
          createdBy: options.userId || null,
        }).catch(() => {});
        throw genErr;
      }

      // Log the generation
      await AiGenerationLog.logSuccess({
        entityType: "explanation",
        entityId: questionId,
        prompt: prompt.substring(0, 1000),
        model: aiResult.model,
        provider: AI_CONFIG.provider,
        tokensInput: aiResult.tokensInput,
        tokensOutput: aiResult.tokensOutput,
        latencyMs: aiResult.latencyMs,
        metadata: {
          language: options.language || "en",
          questionType: question.question_type,
        },
        createdBy: options.userId || null,
      });

      // Update question explanation if requested
      if (options.saveToQuestion) {
        await client.query(
          `UPDATE questions SET explanation = $1, updated_at = NOW() WHERE id = $2`,
          [aiResult.text, questionId],
        );
      }

      // Store in practice_ai_cache for reuse (best-effort upsert).
      try {
        await client.query(
          `INSERT INTO practice_ai_cache (question_id, feature, content, model, generated_at)
           VALUES ($1, $2, $3::jsonb, $4, NOW())
           ON CONFLICT (question_id, feature)
           DO UPDATE SET content = EXCLUDED.content, model = EXCLUDED.model, generated_at = NOW()`,
          [
            questionId,
            feature,
            JSON.stringify({ explanation: aiResult.text }),
            aiResult.model || modelName,
          ],
        );
      } catch {
        /* cache write is best-effort */
      }

      return {
        questionId,
        explanation: aiResult.text,
        model: aiResult.model,
        tokens: aiResult.tokensInput + aiResult.tokensOutput,
        latencyMs: aiResult.latencyMs,
        cached: false,
      };
    } finally {
      client.release();
    }
  },

  /**
   * Generate explanations for multiple questions.
   * Bounded concurrency (pool of 3) so a 20-item bulk request cannot fan out
   * into 20 parallel LLM calls; input capped at 50 ids per call.
   * Cost bomb guard: >20 ids requires explicit confirmBulk:true alongside an
   * estimate the caller has seen (returned in the confirmation error).
   */
  async generateBulk(questionIds, options = {}) {
    const ids = Array.isArray(questionIds) ? questionIds.slice(0, 50) : [];
    const BULK_CONFIRM_THRESHOLD = 20;
    if (ids.length > BULK_CONFIRM_THRESHOLD && !options.confirmBulk) {
      const estTokens = ids.length * (options.maxTokens || 1500);
      const estCostUsd = ((estTokens * 0.002) / 1000).toFixed(2);
      const err = new Error(
        `Bulk generation of ${ids.length} explanations ≈ ${estTokens.toLocaleString()} tokens (≈ $${estCostUsd}). Resubmit with confirmBulk:true to proceed.`,
      );
      err.code = "BULK_CONFIRM_REQUIRED";
      err.estimatedTokens = estTokens;
      err.estimatedCostUsd = Number(estCostUsd);
      throw err;
    }
    const CONCURRENCY = 3;
    const results = {
      total: ids.length,
      generated: 0,
      failed: 0,
      errors: [],
    };

    let cursor = 0;
    const worker = async () => {
      while (cursor < ids.length) {
        const questionId = ids[cursor++];
        try {
          await this.generateExplanation(questionId, options);
          results.generated++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            questionId,
            message: error.message || "Generation failed",
          });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()),
    );

    return results;
  },

  /**
   * Improve an existing explanation.
   */
  async improveExplanation(questionId, instructions = "", options = {}) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const questionResult = await client.query(
        `SELECT id, question_text, question_text_hi, options, options_hi, correct_answer, correct_option, explanation, explanation_hi, marks, negative_marks, difficulty, question_type, category, sub_category_id, tags, status, is_active, is_practice, question_number, test_id, series_id, section_id, subject, subject_id, chapter_id, topic_id, topic, quiz_id, study_material_id, image_asset_id, image_url, passage_id, created_by, category_id, external_question_id, language, solution_image_url, source, imported_from, is_deleted, deleted_by, deleted_at, created_at, updated_at FROM questions WHERE id = $1`,
        [questionId],
      );

      if (questionResult.rows.length === 0) {
        throw new Error("Question not found");
      }

      const question = questionResult.rows[0];

      if (!question.explanation) {
        throw new Error("No existing explanation to improve");
      }

      // BUGFIX (first-option-marked-correct): never assert a fabricated
      // "Option 1" when the mark scheme is unknown (NULL).
      if (
        question.correct_option === null ||
        question.correct_option === undefined
      ) {
        throw new Error(
          "Question has no correct answer set. Fix the mark scheme (Audit tab) before improving the explanation.",
        );
      }

      const prompt = `
 Question: ${sanitizeForPrompt(question.question_text)}
 Options: ${sanitizeForPrompt(JSON.stringify(question.options))}
  Correct Answer: Option ${Number(question.correct_option) + 1}
  Current Explanation: ${sanitizeForPrompt(question.explanation)}

 Improvement Instructions: ${sanitizeForPrompt(instructions) || "Make the explanation clearer, more detailed, and easier to understand."}

 Please provide an improved explanation.
 `;

      const aiResult = await callAI(prompt, {
        model: options.model,
        maxTokens: options.maxTokens || 1500,
        systemPrompt:
          "You are an expert educator improving explanations to make them clearer and more helpful.",
      });

      await AiGenerationLog.logSuccess({
        entityType: "explanation_improve",
        entityId: questionId,
        prompt: prompt.substring(0, 1000),
        model: aiResult.model,
        provider: AI_CONFIG.provider,
        tokensInput: aiResult.tokensInput,
        tokensOutput: aiResult.tokensOutput,
        latencyMs: aiResult.latencyMs,
        metadata: {
          originalExplanation: question.explanation.substring(0, 500),
          instructions,
        },
        createdBy: options.userId || null,
      });

      return {
        questionId,
        originalExplanation: question.explanation,
        improvedExplanation: aiResult.text,
        model: aiResult.model,
      };
    } finally {
      client.release();
    }
  },

  /**
   * Generate explanation in Hindi.
   */
  async generateHindiExplanation(questionId, options = {}) {
    return this.generateExplanation(questionId, {
      ...options,
      language: "hi",
      systemPrompt: `You are an expert educator creating clear, accurate explanations for exam questions in Hindi.
The explanation should be in Hindi (Devanagari script) and easy to understand.
Use simple Hindi words and avoid complex technical terms where possible.`,
    });
  },

  /**
   * Build prompt for explanation generation.
   */
  buildExplanationPrompt(question, options = {}) {
    const optionsList = (
      Array.isArray(question.options) ? question.options : []
    )
      .map((opt, i) => `Option ${i + 1}: ${sanitizeForPrompt(String(opt))}`)
      .join("\n");

    return `
 Question: ${sanitizeForPrompt(question.question_text)}

 ${optionsList}

  Correct Answer: Option ${Number(question.correct_option) + 1}

  Please provide a detailed explanation for why Option ${Number(question.correct_option) + 1} is correct.
 ${options.includeSteps ? "Include step-by-step reasoning." : ""}
 ${options.includeRelatedConcepts ? "Also mention related concepts that might be useful." : ""}
 Keep the explanation clear and concise, suitable for exam preparation.
 `;
  },

  /**
   * Get system prompt for the AI.
   */
  getSystemPrompt(language = "en") {
    if (language === "hi") {
      return "You are an expert educator creating clear, accurate explanations for exam questions in Hindi.";
    }
    return "You are an expert educator creating clear, accurate explanations for exam questions. Your explanations should be easy to understand and help students learn the underlying concepts.";
  },

  /**
   * Get AI usage statistics.
   */
  async getUsageStats(startDate, endDate) {
    return AiGenerationLog.getCostSummary(startDate, endDate);
  },

  /**
   * Get model performance stats.
   */
  async getModelStats() {
    return AiGenerationLog.getStatsByModel();
  },
};

export default aiExplanationService;

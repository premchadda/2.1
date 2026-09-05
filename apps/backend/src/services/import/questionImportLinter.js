/**
 * Question Import Linter & Duplicate Detection Engine
 *
 * Inspects incoming question batches for:
 *   1. Structural & schema validation (stem text, options length, correct option bounds)
 *   2. Exact and near-duplicate question stems using normalized n-gram Dice similarity
 *   3. Pedagogical quality warnings (missing explanations, duplicate options, unusual marks)
 */

/**
 * Normalizes question stem text for canonical comparison.
 */
export function normalizeStem(text = "") {
  if (typeof text !== "string") return "";
  return text
    .replace(/^(\d+[\.\)]|\(?[a-zA-Z0-9]+\))\s*/, "") // Strip leading numbers/labels like "1.", "(a)", "Q1:"
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Strip punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Calculates Dice similarity coefficient between two strings based on character bigrams.
 */
export function calculateDiceSimilarity(str1 = "", str2 = "") {
  const s1 = normalizeStem(str1);
  const s2 = normalizeStem(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str) => {
    const bigrams = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const [bigram, count1] of bigrams1.entries()) {
    if (bigrams2.has(bigram)) {
      intersection += Math.min(count1, bigrams2.get(bigram));
    }
  }

  const total = s1.length - 1 + (s2.length - 1);
  return total > 0 ? Number(((2 * intersection) / total).toFixed(3)) : 0.0;
}

/**
 * Lints an array of questions for import readiness and deduplication.
 *
 * @param {Array} questions - Array of parsed question objects
 * @param {Array} existingQuestions - Optional array of existing questions in target test/DB
 * @param {Object} options - Configuration options (similarityThreshold)
 */
export function lintQuestionImport(
  questions = [],
  existingQuestions = [],
  { similarityThreshold = 0.85 } = {},
) {
  const duplicateStems = [];
  const validationErrors = [];
  const linterWarnings = [];

  const seenBatchStems = []; // Array of { norm, original, row }
  const existingStems = (existingQuestions || []).map((eq) => ({
    id: eq.id || eq._id,
    norm: normalizeStem(eq.question_text || eq.questionText || eq.text || ""),
    original: eq.question_text || eq.questionText || eq.text || "",
  }));

  const validQuestions = [];

  questions.forEach((q, idx) => {
    const rowNumber = idx + 1;
    const text = String(
      q.question_text || q.questionText || q.question || "",
    ).trim();
    const options = Array.isArray(q.options)
      ? q.options.filter(
          (o) => o !== null && o !== undefined && String(o).trim() !== "",
        )
      : [];
    const correctOpt = q.correct_option ?? q.correctOption ?? q.answer;

    let hasFatalError = false;

    // ── 1. Schema Validation ────────────────────────────────────────────────
    if (!text || text.length < 5) {
      validationErrors.push({
        row: rowNumber,
        field: "questionText",
        error: "Question text is required and must be at least 5 characters.",
      });
      hasFatalError = true;
    }

    if (options.length < 2) {
      validationErrors.push({
        row: rowNumber,
        field: "options",
        error: `Question has only ${options.length} valid option(s); at least 2 options are required.`,
      });
      hasFatalError = true;
    }

    const parsedCorrect = Number(correctOpt);
    if (
      correctOpt === null ||
      correctOpt === undefined ||
      isNaN(parsedCorrect) ||
      parsedCorrect < 0 ||
      parsedCorrect >= options.length
    ) {
      validationErrors.push({
        row: rowNumber,
        field: "correctOption",
        error: `Correct option index (${correctOpt}) is missing or outside the valid range [0 - ${Math.max(0, options.length - 1)}].`,
      });
      hasFatalError = true;
    }

    // ── 2. Quality Warnings ─────────────────────────────────────────────────
    const explanation = String(q.explanation || q.solution_text || "").trim();
    if (!explanation) {
      linterWarnings.push({
        row: rowNumber,
        field: "explanation",
        warning: "Missing explanation or step-by-step solution.",
        suggestion: "Provide solution rationale for candidate learning.",
      });
    }

    // Duplicate options check
    const normalizedOptions = options.map((opt) =>
      String(opt).toLowerCase().trim(),
    );
    const uniqueOptions = new Set(normalizedOptions);
    if (uniqueOptions.size < options.length) {
      linterWarnings.push({
        row: rowNumber,
        field: "options",
        warning: "Contains duplicate options with identical text.",
        suggestion: "Ensure all answer options provide distinct alternatives.",
      });
    }

    const marks = Number(q.marks);
    if (!isNaN(marks) && (marks <= 0 || marks > 20)) {
      linterWarnings.push({
        row: rowNumber,
        field: "marks",
        warning: `Unusual marks allocation (${marks}).`,
        suggestion: "Standard exam marks typically range from 1 to 4.",
      });
    }

    // ── 3. Duplicate Detection ──────────────────────────────────────────────
    if (text) {
      const norm = normalizeStem(text);

      // A. Check against previous rows in this same batch
      let matchedInBatch = false;
      for (const seen of seenBatchStems) {
        if (norm === seen.norm) {
          duplicateStems.push({
            row: rowNumber,
            type: "exact",
            similarity: 1.0,
            questionText: text,
            duplicateWithRow: seen.row,
            message: `Exact duplicate of row ${seen.row} in this import batch.`,
          });
          matchedInBatch = true;
          hasFatalError = true;
          break;
        }

        const sim = calculateDiceSimilarity(norm, seen.norm);
        if (sim >= similarityThreshold) {
          duplicateStems.push({
            row: rowNumber,
            type: "near_duplicate",
            similarity: sim,
            questionText: text,
            duplicateWithRow: seen.row,
            message: `Near-duplicate (${Math.round(sim * 100)}% match) of row ${seen.row}.`,
          });
          matchedInBatch = true;
          hasFatalError = true;
          break;
        }
      }

      // B. Check against existing database questions
      if (!matchedInBatch) {
        for (const existing of existingStems) {
          if (norm === existing.norm) {
            duplicateStems.push({
              row: rowNumber,
              type: "exact",
              similarity: 1.0,
              questionText: text,
              existingQuestionId: existing.id,
              message: `Exact duplicate of existing question #${existing.id} in database.`,
            });
            hasFatalError = true;
            break;
          }

          const sim = calculateDiceSimilarity(norm, existing.norm);
          if (sim >= similarityThreshold) {
            duplicateStems.push({
              row: rowNumber,
              type: "near_duplicate",
              similarity: sim,
              questionText: text,
              existingQuestionId: existing.id,
              message: `Near-duplicate (${Math.round(sim * 100)}% match) of existing question #${existing.id}.`,
            });
            hasFatalError = true;
            break;
          }
        }
      }

      seenBatchStems.push({ norm, original: text, row: rowNumber });
    }

    if (!hasFatalError) {
      validQuestions.push({
        ...q,
        questionText: text,
        options,
        correctOption: parsedCorrect,
        explanation: explanation || null,
      });
    }
  });

  return {
    valid: validationErrors.length === 0 && duplicateStems.length === 0,
    summary: {
      totalSubmitted: questions.length,
      readyToImport: validQuestions.length,
      duplicateCount: duplicateStems.length,
      errorCount: validationErrors.length,
      warningCount: linterWarnings.length,
    },
    duplicateStems,
    validationErrors,
    linterWarnings,
    preview: validQuestions.slice(0, 5),
  };
}

export default {
  normalizeStem,
  calculateDiceSimilarity,
  lintQuestionImport,
};

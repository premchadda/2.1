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
    .replace(/^(?:Q\d+[:.)]?|\d+[.)]|\(?[a-zA-Z0-9\p{L}]+\))\s*/iu, "") // Strip leading numbers/labels like "1.", "(a)", "Q1:"
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "") // Strip punctuation while preserving all Unicode letters, marks (Devanagari matras), and numbers
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Extracts a map of character bigrams with frequencies.
 */
export function getBigramsMap(str = "") {
  const bigrams = new Map();
  for (let i = 0; i < str.length - 1; i++) {
    const bigram = str.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }
  return bigrams;
}

/**
 * Calculates Dice similarity coefficient between two strings based on character bigrams.
 */
export function calculateDiceSimilarity(str1 = "", str2 = "") {
  const s1 = normalizeStem(str1);
  const s2 = normalizeStem(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const maxPossible = (2 * Math.min(len1, len2)) / (len1 + len2);
  if (maxPossible <= 0) return 0.0;

  const bigrams1 = getBigramsMap(s1);
  const bigrams2 = getBigramsMap(s2);

  let intersection = 0;
  for (const [bigram, count1] of bigrams1.entries()) {
    if (bigrams2.has(bigram)) {
      intersection += Math.min(count1, bigrams2.get(bigram));
    }
  }

  const total = len1 - 1 + (len2 - 1);
  return total > 0 ? Number(((2 * intersection) / total).toFixed(3)) : 0.0;
}

function compareStemEntries(entry1, entry2, similarityThreshold) {
  if (entry1.norm === entry2.norm) return 1.0;
  const len1 = entry1.len;
  const len2 = entry2.len;
  if (len1 < 2 || len2 < 2) return 0.0;

  // Theoretical upper bound: even if all bigrams match, similarity cannot exceed this
  const maxPossible = (2 * Math.min(len1, len2)) / (len1 + len2);
  if (maxPossible < similarityThreshold) return 0.0;

  if (!entry1.bigrams) entry1.bigrams = getBigramsMap(entry1.norm);
  if (!entry2.bigrams) entry2.bigrams = getBigramsMap(entry2.norm);

  let intersection = 0;
  for (const [bigram, count1] of entry1.bigrams.entries()) {
    const count2 = entry2.bigrams.get(bigram);
    if (count2) {
      intersection += Math.min(count1, count2);
    }
  }

  const total = len1 - 1 + (len2 - 1);
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

  const seenBatchStems = []; // Array of { norm, original, row, len, bigrams }
  const existingStems = (existingQuestions || []).map((eq) => {
    const norm = normalizeStem(
      eq.question_text || eq.questionText || eq.text || "",
    );
    return {
      id: eq.id || eq._id,
      norm,
      original: eq.question_text || eq.questionText || eq.text || "",
      len: norm.length,
      bigrams: null,
    };
  });

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
      const currStem = {
        norm,
        original: text,
        row: rowNumber,
        len: norm.length,
        bigrams: null,
      };

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

        const sim = compareStemEntries(currStem, seen, similarityThreshold);
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

          const sim = compareStemEntries(
            currStem,
            existing,
            similarityThreshold,
          );
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

      seenBatchStems.push(currStem);
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

/**
 * Asynchronously lints an array of questions, yielding to the Node.js event loop
 * via setImmediate every 50 questions to prevent blocking server threads on 1000+ item batches.
 */
export async function lintQuestionImportAsync(
  questions = [],
  existingQuestions = [],
  { similarityThreshold = 0.85 } = {},
) {
  if (questions.length <= 50) {
    return lintQuestionImport(questions, existingQuestions, {
      similarityThreshold,
    });
  }

  const duplicateStems = [];
  const validationErrors = [];
  const linterWarnings = [];

  const seenBatchStems = [];
  const existingStems = (existingQuestions || []).map((eq) => {
    const norm = normalizeStem(
      eq.question_text || eq.questionText || eq.text || "",
    );
    return {
      id: eq.id || eq._id,
      norm,
      original: eq.question_text || eq.questionText || eq.text || "",
      len: norm.length,
      bigrams: null,
    };
  });

  const validQuestions = [];
  const CHUNK_SIZE = 50;

  for (let idx = 0; idx < questions.length; idx++) {
    if (idx > 0 && idx % CHUNK_SIZE === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    const q = questions[idx];
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
      const currStem = {
        norm,
        original: text,
        row: rowNumber,
        len: norm.length,
        bigrams: null,
      };

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

        const sim = compareStemEntries(currStem, seen, similarityThreshold);
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

          const sim = compareStemEntries(
            currStem,
            existing,
            similarityThreshold,
          );
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

      seenBatchStems.push(currStem);
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
  }

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
  lintQuestionImportAsync,
};

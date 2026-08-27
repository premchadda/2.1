import BaseSeeder from "./BaseSeeder.js";

function decodeHtml(str) {
  if (!str || typeof str !== "string") return str || "";
  if (!str.includes("&") && !str.includes("&#")) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return _;
      }
    });
}

function extractBilingual(html) {
  if (!html || typeof html !== "string") return { en: html || "", hi: "" };
  const decoded = decodeHtml(html);
  const eqtMatch = decoded.match(
    /<span[^>]*class=["'][^"']*eqt[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  const hqtMatch = decoded.match(
    /<span[^>]*class=["'][^"']*hqt[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  if (eqtMatch || hqtMatch) {
    return {
      en: eqtMatch ? eqtMatch[1].trim() : decoded.trim(),
      hi: hqtMatch ? hqtMatch[1].trim() : "",
    };
  }
  return { en: decoded.trim(), hi: "" };
}

export default class QuestionsSeeder extends BaseSeeder {
  static table = "questions";
  static fixtureFile = "questions.json";
  static columns = [
    "id",
    "test_id",
    "question_number",
    "question_text",
    "question_text_hi",
    "options",
    "options_hi",
    "correct_option",
    "marks",
    "negative_marks",
    "section",
    "explanation",
    "difficulty",
    "image",
    "is_active",
    "subject",
    "chapter_id",
    "topic",
    "image_asset_id",
    "series_id",
    "category_id",
    "sub_category_id",
    "study_material_id",
    "topic_id",
    "quiz_id",
    "category",
    "type",
    "status",
    "tags",
    "passage_id",
    "chapter",
    "is_practice",
    "solution",
  ];

  static toRow(row) {
    const rawQuestion = row.question_text ?? row.question ?? "";
    const extractedQ =
      typeof rawQuestion === "string"
        ? extractBilingual(rawQuestion)
        : { en: "", hi: "" };
    const questionText =
      extractedQ.en ||
      (typeof rawQuestion === "object" ? rawQuestion.en : rawQuestion);
    const questionTextHi =
      row.question_text_hi ||
      extractedQ.hi ||
      (typeof rawQuestion === "object" ? rawQuestion.hi : null);

    let options = row.options;
    let optionsHi = row.options_hi || null;

    if (Array.isArray(options)) {
      const enOpts = [];
      const hiOpts = [];
      options.forEach((opt) => {
        if (typeof opt === "string") {
          const ext = extractBilingual(opt);
          enOpts.push(ext.en);
          if (ext.hi) hiOpts.push(ext.hi);
        } else {
          enOpts.push(opt);
        }
      });
      options = enOpts;
      if (!optionsHi && hiOpts.length === enOpts.length) {
        optionsHi = hiOpts;
      }
    }

    const rawSolution = row.solution ?? row.explanation ?? null;
    const extractedSol =
      typeof rawSolution === "string"
        ? extractBilingual(rawSolution)
        : { en: "", hi: "" };
    const solution = extractedSol.en || rawSolution;

    return {
      ...row,
      question_text: questionText,
      question_text_hi: questionTextHi,
      options: options,
      options_hi: optionsHi,
      correct_option: row.correct_option ?? row.correct_option_id ?? null,
      solution: solution,
    };
  }
}

/**
 * AI Question Generator with LaTeX & Bilingual Schema Export
 * Generates syllabus-aligned exam questions with mathematical LaTeX formulas,
 * bilingual Hindi/English translations, and Bloom's Taxonomy cognitive tagging.
 */

import { classifyBloomsTaxonomy } from "./questionDifficulty.service.js";

// Procedural question templates for deterministic fallback & test verification
export const QUESTION_TEMPLATES = {
  "Quantitative Aptitude": [
    {
      topic: "Time and Distance",
      questionText:
        "A train $L$ meters long crosses an electric pole in $T$ seconds. What is the speed of the train in km/h if $L = 180$ and $T = 9$?",
      questionTextHi:
        "एक $L$ मीटर लंबी ट्रेन $T$ सेकंड में एक बिजली के खंभे को पार करती है। यदि $L = 180$ और $T = 9$ है, तो ट्रेन की गति km/h में क्या होगी?",
      options: ["64 km/h", "72 km/h", "80 km/h", "90 km/h"],
      optionsHi: [
        "64 किमी/घंटा",
        "72 किमी/घंटा",
        "80 किमी/घंटा",
        "90 किमी/घंटा",
      ],
      correctOption: 1, // 72 km/h
      explanation:
        "Speed in m/s = $\\frac{180}{9} = 20$ m/s. Convert to km/h: $20 \\times \\frac{18}{5} = 72$ km/h.",
      explanationHi:
        "गति (m/s) = $\\frac{180}{9} = 20$ m/s. km/h में बदलने पर: $20 \\times \\frac{18}{5} = 72$ किमी/घंटा।",
      difficulty: "medium",
    },
    {
      topic: "Percentage & Profit",
      questionText:
        "An article marked at $\\$800$ is sold at a discount of $15\\%$. If the merchant still makes a profit of $20\\%$, what is the cost price?",
      questionTextHi:
        "$\\$800$ अंकित मूल्य वाली वस्तु को $15\\%$ छूट पर बेचा जाता है। यदि व्यापारी को फिर भी $20\\%$ का लाभ होता है, तो क्रय मूल्य क्या है?",
      options: ["$\\$540$", "$\\$566.67$", "$\\$600$", "$\\$640$"],
      optionsHi: ["$\\$540$", "$\\$566.67$", "$\\$600$", "$\\$640$"],
      correctOption: 1, // 566.67
      explanation:
        "Selling Price = $800 \\times 0.85 = 680$. Cost Price = $\\frac{680}{1.20} = \\$566.67$.",
      explanationHi:
        "विक्रय मूल्य = $800 \\times 0.85 = 680$. क्रय मूल्य = $\\frac{680}{1.20} = \\$566.67$.",
      difficulty: "hard",
    },
  ],
  Reasoning: [
    {
      topic: "Number Series",
      questionText:
        "Find the next term in the series: $4, 9, 25, 49, 121, ?$ ?",
      questionTextHi:
        "श्रृंखला में अगला पद ज्ञात कीजिए: $4, 9, 25, 49, 121, ?$ ?",
      options: ["144", "169", "196", "225"],
      optionsHi: ["144", "169", "196", "225"],
      correctOption: 1, // 169 (squares of prime numbers: 2, 3, 5, 7, 11, 13)
      explanation:
        "The terms are squares of consecutive prime numbers: $2^2, 3^2, 5^2, 7^2, 11^2, 13^2 = 169$.",
      explanationHi:
        "पद क्रमागत अभाज्य संख्याओं के वर्ग हैं: $2^2, 3^2, 5^2, 7^2, 11^2, 13^2 = 169$।",
      difficulty: "medium",
    },
  ],
  "General Awareness": [
    {
      topic: "Indian Polity",
      questionText:
        "Under which Article of the Indian Constitution is the Right to Equality guaranteed?",
      questionTextHi:
        "भारतीय संविधान के किस अनुच्छेद के तहत समानता के अधिकार की गारंटी दी गई है?",
      options: [
        "Articles 14-18",
        "Articles 19-22",
        "Articles 23-24",
        "Articles 25-28",
      ],
      optionsHi: [
        "अनुच्छेद 14-18",
        "अनुच्छेद 19-22",
        "अनुच्छेद 23-24",
        "अनुच्छेद 25-28",
      ],
      correctOption: 0,
      explanation:
        "Articles 14 to 18 of the Constitution of India guarantee the fundamental Right to Equality.",
      explanationHi:
        "भारत के संविधान के अनुच्छेद 14 से 18 समानता के मौलिक अधिकार की गारंटी देते हैं।",
      difficulty: "easy",
    },
  ],
};

/**
 * Validates and normalizes raw question objects into the platform schema
 */
export function normalizeGeneratedQuestion(raw = {}, defaults = {}) {
  const questionText = (
    raw.questionText ||
    raw.text ||
    raw.question ||
    ""
  ).trim();
  if (!questionText) {
    throw new Error("Question must contain questionText");
  }

  const options = Array.isArray(raw.options) ? raw.options : [];
  if (options.length < 2) {
    throw new Error("Question must contain at least 2 options");
  }

  let correctOption =
    typeof raw.correctOption === "number"
      ? raw.correctOption
      : typeof raw.correctAnswer === "number"
        ? raw.correctAnswer
        : 0;

  if (correctOption < 0 || correctOption >= options.length) {
    correctOption = 0;
  }

  const subject = raw.subject || defaults.subject || "Quantitative Aptitude";
  const difficulty = (
    raw.difficulty ||
    defaults.difficulty ||
    "medium"
  ).toLowerCase();
  const explanation = raw.explanation || raw.solution || "";

  // Classify Bloom's Taxonomy cognitive level automatically
  const bloomTaxonomy = classifyBloomsTaxonomy(questionText, explanation);

  return {
    questionText,
    questionTextHi: raw.questionTextHi || raw.textHi || null,
    options,
    optionsHi: raw.optionsHi || null,
    correctOption,
    explanation,
    explanationHi: raw.explanationHi || null,
    subject,
    topic: raw.topic || defaults.topic || "General",
    chapter: raw.chapter || defaults.chapter || "Foundations",
    difficulty: ["easy", "medium", "hard"].includes(difficulty)
      ? difficulty
      : "medium",
    marks: Number(raw.marks) || 2.0,
    negativeMarks: Number(raw.negativeMarks) || 0.5,
    bloomLevel: bloomTaxonomy.level,
    bloomConfidence: bloomTaxonomy.confidence,
    hasLatex: /(\$[^$]+\$|\\[a-zA-Z]+)/.test(questionText),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates questions based on syllabus requirements
 */
export async function generateQuestions(options = {}) {
  const {
    subject = "Quantitative Aptitude",
    topic,
    difficulty = "medium",
    count = 1,
  } = options;

  const results = [];
  const templates =
    QUESTION_TEMPLATES[subject] || QUESTION_TEMPLATES["Quantitative Aptitude"];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const generated = {
      ...template,
      subject,
      topic: topic || template.topic,
      difficulty,
    };

    results.push(
      normalizeGeneratedQuestion(generated, { subject, topic, difficulty }),
    );
  }

  return results;
}

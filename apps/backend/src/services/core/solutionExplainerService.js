/**
 * Automated Solution Explainer Generator & Bilingual Audio TTS Service
 * Structures complex questions into step-by-step pedagogical flashcards
 * and converts mathematical LaTeX into spoken phonetic scripts.
 */

/**
 * Converts LaTeX formulas and mathematical notations into natural spoken text
 * @param {string} text - Text containing LaTeX markup ($...$, \frac, \sqrt, etc.)
 * @param {'en'|'hi'} [language='en'] - Target spoken language
 * @returns {string} Plain text optimized for text-to-speech synthesis
 */
export function convertLatexToSpokenText(text = "", language = "en") {
  if (!text || typeof text !== "string") return "";

  let spoken = text;

  // Fractions: \frac{num}{den}
  if (language === "hi") {
    spoken = spoken.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 बटा $2");
  } else {
    spoken = spoken.replace(
      /\\frac\{([^}]+)\}\{([^}]+)\}/g,
      "$1 divided by $2",
    );
  }

  // Square roots: \sqrt{arg} or \sqrt[n]{arg}
  if (language === "hi") {
    spoken = spoken.replace(/\\sqrt\{([^}]+)\}/g, "$1 का स्क्वायर रूट");
    spoken = spoken.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, "$2 का $1 रूट");
  } else {
    spoken = spoken.replace(/\\sqrt\{([^}]+)\}/g, "square root of $1");
    spoken = spoken.replace(
      /\\sqrt\[([^\]]+)\]\{([^}]+)\}/g,
      "$1-th root of $2",
    );
  }

  // Powers and exponents
  spoken = spoken.replace(
    /([a-zA-Z0-9]+)\^2\b/g,
    language === "hi" ? "$1 स्क्वायर" : "$1 squared",
  );
  spoken = spoken.replace(
    /([a-zA-Z0-9]+)\^3\b/g,
    language === "hi" ? "$1 क्यूब" : "$1 cubed",
  );
  spoken = spoken.replace(
    /([a-zA-Z0-9]+)\^\{([^}]+)\}/g,
    language === "hi" ? "$1 की पॉवर $2" : "$1 to the power of $2",
  );
  spoken = spoken.replace(
    /([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)/g,
    language === "hi" ? "$1 की पॉver $2" : "$1 to the power of $2",
  );

  // Subscripts: x_1 -> x 1
  spoken = spoken.replace(/([a-zA-Z0-9]+)_\{([^}]+)\}/g, "$1 sub $2");
  spoken = spoken.replace(/([a-zA-Z0-9]+)_([a-zA-Z0-9])/g, "$1 sub $2");

  // Common Greek and Math Symbols
  const symbols = [
    { regex: /\\pi\b/g, en: "pi", hi: "पाई" },
    { regex: /\\theta\b/g, en: "theta", hi: "थीटा" },
    { regex: /\\alpha\b/g, en: "alpha", hi: "अल्फा" },
    { regex: /\\beta\b/g, en: "beta", hi: "बीटा" },
    { regex: /\\gamma\b/g, en: "gamma", hi: "गामा" },
    { regex: /\\times\b/g, en: "multiplied by", hi: "गुणा" },
    { regex: /\\div\b/g, en: "divided by", hi: "भाग" },
    { regex: /\\pm\b/g, en: "plus or minus", hi: "प्लस या माइनस" },
    {
      regex: /\\le\b|\\leq\b/g,
      en: "less than or equal to",
      hi: "छोटा या बराबर",
    },
    {
      regex: /\\ge\b|\\geq\b/g,
      en: "greater than or equal to",
      hi: "बड़ा या बराबर",
    },
    { regex: /\\neq\b/g, en: "is not equal to", hi: "बराबर नहीं है" },
    { regex: /\\approx\b/g, en: "approximately equals", hi: "लगभग बराबर है" },
    { regex: /\\infty\b/g, en: "infinity", hi: "अनंत" },
    { regex: /\\degree\b|\\circ\b/g, en: "degrees", hi: "डिग्री" },
    { regex: /%/g, en: " percent", hi: " प्रतिशत" },
    { regex: /=/g, en: " equals ", hi: " बराबर " },
  ];

  for (const sym of symbols) {
    spoken = spoken.replace(sym.regex, language === "hi" ? sym.hi : sym.en);
  }

  // Clean up LaTeX formatting syntax like \text{...}, \mathbf{...}
  spoken = spoken.replace(/\\text\{([^}]+)\}/g, "$1");
  spoken = spoken.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  spoken = spoken.replace(/\\mathit\{([^}]+)\}/g, "$1");
  spoken = spoken.replace(/\\mathrm\{([^}]+)\}/g, "$1");

  // Remove delimiter tags ($$, $, \[, \])
  spoken = spoken.replace(/\$\$|\$|\\\[|\\\]/g, " ");

  // Normalize excessive whitespaces and commas
  spoken = spoken.replace(/\s+/g, " ").trim();

  return spoken;
}

/**
 * Extracts and synthesizes a 4-stage structured pedagogical explainer
 */
export function generateStructuredExplainer(question = {}, options = {}) {
  const language = options.language === "hi" ? "hi" : "en";

  const questionText =
    question.questionText || question.text || question.stem || "";
  const explanation = question.explanation || question.solution || "";
  const questionOptions = question.options || [];
  const correctOptionIndex =
    typeof question.correctOption === "number"
      ? question.correctOption
      : typeof question.correctAnswer === "number"
        ? question.correctAnswer
        : 0;

  // 1. Core Concept Extraction
  let coreConcept = "";
  if (/formula|theorem|rule|identity|property|definition/i.test(explanation)) {
    const match = explanation.match(
      /(?:formula|theorem|rule|identity|property|definition)[^.\n]+[.\n]/i,
    );
    coreConcept = match
      ? match[0].trim()
      : "Core principle applied in this problem.";
  } else if (/(\$[^$]+\$|\\[a-z]+)/.test(explanation)) {
    coreConcept = "Mathematical identity and formula application.";
  } else {
    coreConcept =
      language === "hi"
        ? "मूल अवधारणा और विश्लेषण विधि।"
        : "Fundamental concept and systematic problem analysis.";
  }

  // 2. Given Conditions & Variables
  const givenConditions = [];
  const numberMatches = questionText.match(
    /(\b\d+(?:\.\d+)?(?:\s*%)?(?:\s*[a-zA-Z]+(?:\/[a-zA-Z]+)?)?\b)/g,
  );
  if (numberMatches && numberMatches.length > 0) {
    const uniqueNumbers = [...new Set(numberMatches)].slice(0, 4);
    for (const num of uniqueNumbers) {
      givenConditions.push(num);
    }
  } else {
    givenConditions.push(
      language === "hi"
        ? "प्रश्न में दी गई जानकारी"
        : "Problem parameters and constraints",
    );
  }

  // 3. Step-by-Step Deduction
  const sentences = explanation
    .split(/(?<=[.?!])\s+/)
    .filter((s) => s.trim().length > 5);

  const steps = [];
  if (sentences.length >= 2) {
    sentences.forEach((sentence, idx) => {
      steps.push({
        stepNumber: idx + 1,
        title: language === "hi" ? `चरण ${idx + 1}` : `Step ${idx + 1}`,
        description: sentence.trim(),
        spokenSnippet: convertLatexToSpokenText(sentence, language),
      });
    });
  } else {
    steps.push({
      stepNumber: 1,
      title: language === "hi" ? "चरण 1: हल" : "Step 1: Deduction",
      description: explanation || questionText,
      spokenSnippet: convertLatexToSpokenText(
        explanation || questionText,
        language,
      ),
    });
  }

  // 4. Distractor Analysis (Why incorrect options are wrong)
  const distractorAnalysis = [];
  questionOptions.forEach((opt, idx) => {
    const optText = typeof opt === "string" ? opt : opt.text || String(opt);
    const isCorrect = idx === correctOptionIndex;
    distractorAnalysis.push({
      optionIndex: idx,
      optionText: optText,
      isCorrect,
      reason: isCorrect
        ? language === "hi"
          ? "यह सही उत्तर है।"
          : "Matches the derived solution."
        : language === "hi"
          ? "गलत विकल्प (सामान्य गणना त्रुटि)।"
          : "Incorrect choice resulting from calculation pitfall or sign error.",
    });
  });

  // 5. Complete Spoken Audio Script Synthesis
  let audioScript = "";
  if (language === "hi") {
    audioScript = `आइए इस प्रश्न का चरणबद्ध हल समझें। ${convertLatexToSpokenText(questionText, "hi")}। `;
    audioScript += `मूल सिद्धांत: ${convertLatexToSpokenText(coreConcept, "hi")}। `;
    steps.forEach((st) => {
      audioScript += `${st.title}: ${st.spokenSnippet}। `;
    });
    audioScript += `अतः विकल्प ${correctOptionIndex + 1} सही उत्तर है।`;
  } else {
    audioScript = `Let's understand the step-by-step solution. ${convertLatexToSpokenText(questionText, "en")}. `;
    audioScript += `Core concept: ${convertLatexToSpokenText(coreConcept, "en")}. `;
    steps.forEach((st) => {
      audioScript += `${st.title}: ${st.spokenSnippet}. `;
    });
    audioScript += `Therefore, Option ${correctOptionIndex + 1} is the correct answer.`;
  }

  return {
    language,
    coreConcept,
    givenConditions,
    steps,
    distractorAnalysis,
    correctOptionIndex,
    audioScript: audioScript.trim(),
    estimatedAudioDurationSeconds: Math.ceil(
      audioScript.split(/\s+/).length / 2.5,
    ), // ~150 wpm
  };
}

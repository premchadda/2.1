/**
 * Socratic Hint Engine & Cognitive Friction Detector
 * Part of Node Engine V3 (Socratic AI Pedagogical Guidance).
 *
 * Provides progressive, non-spoiling 3-tier hints:
 * - Tier 1 (Concept/Formula Clue): Points to governing theorem/formula without working steps.
 * - Tier 2 (Approach/First-Step Clue): Provides problem setup and initial decomposition.
 * - Tier 3 (Distractor Elimination Clue): Exposes common misconception and eliminates 1-2 false options.
 *
 * Includes candidate cognitive friction telemetry analysis to detect stuck/hesitation states.
 */

export const HINT_TIERS = {
  CONCEPT: 1,
  APPROACH: 2,
  ELIMINATION: 3,
};

export const HINT_TIER_NAMES = {
  1: "CONCEPT_CLUE",
  2: "APPROACH_CLUE",
  3: "DISTRACTOR_ELIMINATION",
};

export const FRICTION_LEVELS = {
  NONE: "NONE",
  MILD: "MILD",
  HIGH_HESITATION: "HIGH_HESITATION",
  SEVERE_STUCK: "SEVERE_STUCK",
};

/**
 * Calibrated score penalties per hint tier
 */
export const HINT_PENALTIES = {
  1: 0.05, // 5% penalty
  2: 0.15, // 15% penalty
  3: 0.25, // 25% penalty
};

/**
 * Detects candidate cognitive friction based on interaction telemetry
 */
export const detectCognitiveFriction = ({
  timeSpentSeconds = 0,
  benchmarkTimeSeconds = 60,
  selectionChanges = 0,
  idleTimeSeconds = 0,
} = {}) => {
  const safeBenchmark = Math.max(15, Number(benchmarkTimeSeconds) || 60);
  const safeTime = Math.max(0, Number(timeSpentSeconds) || 0);
  const safeIdle = Math.max(0, Number(idleTimeSeconds) || 0);
  const safeChanges = Math.max(0, Number(selectionChanges) || 0);

  const ratio = safeTime / safeBenchmark;

  let frictionLevel = FRICTION_LEVELS.NONE;
  let recommendedTier = null;

  if (ratio >= 2.5 || (ratio >= 1.8 && safeIdle >= 45)) {
    frictionLevel = FRICTION_LEVELS.SEVERE_STUCK;
    recommendedTier = HINT_TIERS.APPROACH;
  } else if (
    ratio >= 1.5 ||
    safeChanges >= 3 ||
    (ratio >= 1.2 && safeIdle >= 30)
  ) {
    frictionLevel = FRICTION_LEVELS.HIGH_HESITATION;
    recommendedTier = HINT_TIERS.CONCEPT;
  } else if (ratio >= 1.1 || safeChanges >= 1) {
    frictionLevel = FRICTION_LEVELS.MILD;
    recommendedTier = null;
  }

  const rawScore = ratio * 0.35 + safeChanges * 0.1 + (safeIdle / 100) * 0.25;
  const frictionScore = Math.min(
    1.0,
    Math.max(0.0, Number(rawScore.toFixed(2))),
  );

  return {
    frictionLevel,
    frictionScore,
    isFrictionDetected: frictionLevel !== FRICTION_LEVELS.NONE,
    recommendedTier,
    metrics: {
      timeRatio: Number(ratio.toFixed(2)),
      timeSpentSeconds: safeTime,
      benchmarkTimeSeconds: safeBenchmark,
      selectionChanges: safeChanges,
      idleTimeSeconds: safeIdle,
    },
  };
};

/**
 * Calculate the score penalty factor for a revealed hint tier
 */
export const calculatePenaltyFactor = (tier) => {
  const numericTier = Number(tier) || 1;
  return HINT_PENALTIES[numericTier] ?? 0.05;
};

/**
 * Extract domain and concept clues from question text and explanation
 */
const inferDomainAndCoreConcept = (question) => {
  const text =
    `${question.questionText || question.question_text || ""} ${question.explanation || ""}`.toLowerCase();

  if (text.includes("ratio") || text.includes("proportion")) {
    return {
      domain: "Arithmetic",
      concept: "Ratio & Proportions",
      formula: "a/b = c/d \\implies ad = bc",
    };
  }
  if (
    text.includes("percent") ||
    text.includes("percentage") ||
    text.includes("%")
  ) {
    return {
      domain: "Arithmetic",
      concept: "Percentage Dynamics",
      formula:
        "\\Delta\\% = \\frac{\\text{New} - \\text{Old}}{\\text{Old}} \\times 100",
    };
  }
  if (
    text.includes("profit") ||
    text.includes("loss") ||
    text.includes("discount")
  ) {
    return {
      domain: "Commercial Math",
      concept: "Profit, Loss & Markup",
      formula: "\\text{Profit}\\% = \\frac{SP - CP}{CP} \\times 100",
    };
  }
  if (
    text.includes("speed") ||
    text.includes("distance") ||
    text.includes("train") ||
    text.includes("time and distance")
  ) {
    return {
      domain: "Kinematics",
      concept: "Speed, Time & Distance",
      formula:
        "\\text{Speed} = \\frac{\\text{Distance}}{\\text{Time}}, \\text{Relative Speed} = v_1 \\pm v_2",
    };
  }
  if (
    text.includes("work") ||
    text.includes("efficiency") ||
    text.includes("pipes") ||
    text.includes("cistern")
  ) {
    return {
      domain: "Work Rate",
      concept: "Unitary Work & Combined Efficiency",
      formula: "\\frac{1}{T_{total}} = \\sum \\frac{1}{t_i}",
    };
  }
  if (
    text.includes("triangle") ||
    text.includes("circle") ||
    text.includes("angle") ||
    text.includes("radius")
  ) {
    return {
      domain: "Geometry",
      concept: "Geometric Properties & Theorems",
      formula: "A = \\pi r^2, \\text{Pythagoras: } a^2 + b^2 = c^2",
    };
  }
  if (
    text.includes("syllogism") ||
    text.includes("premise") ||
    text.includes("conclusion") ||
    text.includes("statement")
  ) {
    return {
      domain: "Deductive Logic",
      concept: "Venn Diagram & Syllogistic Entailment",
      formula: "Valid deduction requires distributed middle terms",
    };
  }
  if (
    text.includes("constitution") ||
    text.includes("article") ||
    text.includes("amendment") ||
    text.includes("parliament")
  ) {
    return {
      domain: "Polity",
      concept: "Constitutional Articles & Jurisprudence",
      formula: "Fundamental rights vs Directive principles hierarchy",
    };
  }

  return {
    domain: "General Aptitude",
    concept: "Analytical Reasoning & Systematic Breakdown",
    formula: "Identify constraints, isolate variables, and eliminate outliers",
  };
};

/**
 * Generate progressive, non-spoiling Socratic hint
 */
export const generateSocraticHint = (
  question,
  { tier = 1, language = "en", telemetry = null } = {},
) => {
  if (!question) {
    throw new Error("Question object is required to generate Socratic hint");
  }

  const numericTier = Math.min(3, Math.max(1, Number(tier) || 1));
  const isHindi = String(language).toLowerCase().startsWith("hi");
  const domainInfo = inferDomainAndCoreConcept(question);

  const options = question.options || [];
  const correctIndex = Number(
    question.correctOptionIndex ?? question.correct_option_index ?? 0,
  );

  // Distractor elimination logic (Tier 3)
  const distractorIndices = [];
  if (Array.isArray(options) && options.length > 2) {
    for (let i = 0; i < options.length; i++) {
      if (i !== correctIndex) {
        distractorIndices.push(i);
      }
    }
  }

  // Select up to 2 distractor options to safely eliminate
  const eliminatedIndices = distractorIndices.slice(
    0,
    Math.min(2, Math.max(1, options.length - 2)),
  );

  let hintText = "";
  if (numericTier === HINT_TIERS.CONCEPT) {
    // Tier 1: Concept / Formula
    if (isHindi) {
      hintText = `💡 **अवधारणा संकेत**: यह प्रश्न **${domainInfo.concept}** पर आधारित है। मुख्य सूत्र या सिद्धांत याद करें: \`${domainInfo.formula}\`। प्रश्न में दिए गए मुख्य चरों को पहले पहचानें।`;
    } else {
      hintText = `💡 **Concept Clue**: This problem tests **${domainInfo.concept}** (${domainInfo.domain}). Recall the core governing identity: \`${domainInfo.formula}\`. Isolate the fixed invariants before calculating.`;
    }
  } else if (numericTier === HINT_TIERS.APPROACH) {
    // Tier 2: Setup / First Step
    if (isHindi) {
      hintText = `🪜 **दृष्टिकोण संकेत**: पहला कदम यह है कि दिए गए मानों को समान इकाई में लाएं और समीकरण स्थापित करें। मध्यवर्ती मान को $x$ मानकर ज्ञात स्थिति के साथ संतुलित करें।`;
    } else {
      hintText = `🪜 **Approach Clue**: First, align all given parameters into uniform units. Define the unknown invariant as a variable or ratio unit. Set up the baseline equality using the given condition before computing the final value.`;
    }
  } else {
    // Tier 3: Distractor Elimination
    const eliminatedLabels = eliminatedIndices
      .map(
        (idx) =>
          `Option ${idx + 1} ("${String(options[idx] || "").slice(0, 25)}")`,
      )
      .join(" and ");
    if (isHindi) {
      hintText = `🎯 **विकल्प निष्कासन संकेत**: गणना की सामान्य गलतियों के कारण ${eliminatedLabels} गलत हैं। इन विकल्पों को बाहर निकालें और शेष विकल्पों का मूल्यांकन करें।`;
    } else {
      hintText = `🎯 **Distractor Elimination Clue**: Candidates frequently fall into the trap that leads to ${eliminatedLabels}. You can safely eliminate these options and evaluate the remaining choices.`;
    }
  }

  const frictionAnalysis = telemetry
    ? detectCognitiveFriction(telemetry)
    : null;

  return {
    questionId: question.id || null,
    tier: numericTier,
    tierName: HINT_TIER_NAMES[numericTier],
    hintText,
    eliminatedOptionIndices:
      numericTier === HINT_TIERS.ELIMINATION ? eliminatedIndices : [],
    penaltyFactor: calculatePenaltyFactor(numericTier),
    friction: frictionAnalysis,
    language: isHindi ? "hi" : "en",
    domain: domainInfo.domain,
    concept: domainInfo.concept,
  };
};

export default {
  HINT_TIERS,
  HINT_TIER_NAMES,
  FRICTION_LEVELS,
  HINT_PENALTIES,
  detectCognitiveFriction,
  calculatePenaltyFactor,
  generateSocraticHint,
};

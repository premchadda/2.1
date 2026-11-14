/**
 * tests/e2e/fixtures/questionFixtures.js
 * Standardized question sets containing KaTeX math, formulas, options, explanations, and audit edge cases.
 */

export const SAMPLE_QUESTIONS = [
  {
    id: 101,
    questionText:
      "If $\\sin(\\theta) + \\cos(\\theta) = \\sqrt{2}$, find the value of $\\sin^4(\\theta) + \\cos^4(\\theta)$.",
    questionType: "mcq",
    difficulty: "medium",
    subjectId: 1,
    subjectName: "Quantitative Aptitude",
    topicName: "Trigonometry",
    options: [
      { id: 1, text: "$\\frac{1}{2}$", isCorrect: true },
      { id: 2, text: "$1$", isCorrect: false },
      { id: 3, text: "$\\frac{\\sqrt{2}}{2}$", isCorrect: false },
      { id: 4, text: "$\\frac{3}{4}$", isCorrect: false },
    ],
    explanation:
      "Squaring both sides: $(\\sin\\theta + \\cos\\theta)^2 = 2 \\implies 1 + 2\\sin\\theta\\cos\\theta = 2 \\implies \\sin\\theta\\cos\\theta = \\frac{1}{2}$. Then $\\sin^4\\theta + \\cos^4\\theta = (\\sin^2\\theta + \\cos^2\\theta)^2 - 2\\sin^2\\theta\\cos^2\\theta = 1 - 2(\\frac{1}{4}) = \\frac{1}{2}$.",
    correctOptionIndex: 0,
    tags: ["trigonometry", "algebraic-identities"],
    marks: 2,
    negativeMarks: 0.5,
  },
  {
    id: 102,
    questionText:
      "A train running at $72\\text{ km/h}$ crosses a pole in $15\\text{ seconds}$. What is the length of the train?",
    questionType: "mcq",
    difficulty: "easy",
    subjectId: 1,
    subjectName: "Quantitative Aptitude",
    topicName: "Speed, Time and Distance",
    options: [
      { id: 1, text: "$250\\text{ m}$", isCorrect: false },
      { id: 2, text: "$300\\text{ m}$", isCorrect: true },
      { id: 3, text: "$350\\text{ m}$", isCorrect: false },
      { id: 4, text: "$400\\text{ m}$", isCorrect: false },
    ],
    explanation:
      "Speed in $\\text{m/s} = 72 \\times \\frac{5}{18} = 20\\text{ m/s}$. Length = $\\text{Speed} \\times \\text{Time} = 20 \\times 15 = 300\\text{ m}$.",
    correctOptionIndex: 1,
    tags: ["trains", "speed-distance"],
    marks: 2,
    negativeMarks: 0.5,
  },
  {
    id: 103,
    questionText:
      "Select the option that is related to the third number in the same way as the second number is related to the first number: $12 : 144 :: 14 : ?$",
    questionType: "mcq",
    difficulty: "easy",
    subjectId: 2,
    subjectName: "General Intelligence & Reasoning",
    topicName: "Number Analogy",
    options: [
      { id: 1, text: "$196$", isCorrect: true },
      { id: 2, text: "$182$", isCorrect: false },
      { id: 3, text: "$210$", isCorrect: false },
      { id: 4, text: "$225$", isCorrect: false },
    ],
    explanation: "Pattern is $n : n^2$. Since $12^2 = 144$, $14^2 = 196$.",
    correctOptionIndex: 0,
    tags: ["analogy", "squares"],
    marks: 2,
    negativeMarks: 0.5,
  },
  {
    id: 104,
    questionText:
      "Which of the following Article of the Constitution of India deals with the 'Right to Constitutional Remedies'?",
    questionType: "mcq",
    difficulty: "medium",
    subjectId: 3,
    subjectName: "General Awareness",
    topicName: "Indian Polity",
    options: [
      { id: 1, text: "Article 21", isCorrect: false },
      { id: 2, text: "Article 32", isCorrect: true },
      { id: 3, text: "Article 44", isCorrect: false },
      { id: 4, text: "Article 14", isCorrect: false },
    ],
    explanation:
      "Article 32 provides the Right to Constitutional Remedies, famously referred to by Dr. B.R. Ambedkar as the 'Heart and Soul of the Constitution'.",
    correctOptionIndex: 1,
    tags: ["polity", "fundamental-rights"],
    marks: 2,
    negativeMarks: 0.5,
  },
  {
    id: 105,
    questionText: "Choose the correct antonym for the word: OMNIPOTENT",
    questionType: "mcq",
    difficulty: "hard",
    subjectId: 4,
    subjectName: "English Comprehension",
    topicName: "Vocabulary",
    options: [
      { id: 1, text: "Invincible", isCorrect: false },
      { id: 2, text: "Supreme", isCorrect: false },
      { id: 3, text: "Powerless", isCorrect: true },
      { id: 4, text: "Formidable", isCorrect: false },
    ],
    explanation:
      "Omnipotent means having unlimited power; the direct antonym is powerless (weak, impotent).",
    correctOptionIndex: 2,
    tags: ["vocabulary", "antonyms"],
    marks: 2,
    negativeMarks: 0.5,
  },
];

export const CORRUPTED_AUDIT_QUESTIONS = [
  {
    id: 901,
    questionText: "Incomplete Question without correct option set",
    questionType: "mcq",
    difficulty: "danger",
    options: [
      { id: 1, text: "Option A", isCorrect: false },
      { id: 2, text: "Option B", isCorrect: false },
    ],
    explanation: "",
    auditIssues: [
      {
        code: "NO_CORRECT_OPTION",
        severity: "danger",
        message: "Missing correct answer key",
      },
      {
        code: "NO_EXPLANATION",
        severity: "warning",
        message: "Missing solution explanation",
      },
    ],
  },
  {
    id: 902,
    questionText: "Question with broken KaTeX syntax: $\\frac{1}{0",
    questionType: "mcq",
    difficulty: "warning",
    options: [
      { id: 1, text: "Alpha", isCorrect: true },
      { id: 2, text: "Beta", isCorrect: false },
    ],
    explanation: "Standard explanation",
    auditIssues: [
      {
        code: "LATEX_UNCLOSED_BRACE",
        severity: "warning",
        message: "Unclosed LaTeX bracket in question body",
      },
    ],
  },
];

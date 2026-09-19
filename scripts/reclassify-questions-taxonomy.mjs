import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Load taxonomy cache
const taxonomy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "taxonomy-cache.json"), "utf-8")
);

// Pre-index chapters and topics by subject and title keywords
const chaptersBySubject = {};
for (const ch of taxonomy.chapters) {
  if (!chaptersBySubject[ch.subject_id]) chaptersBySubject[ch.subject_id] = [];
  chaptersBySubject[ch.subject_id].push(ch);
}

const topicsByChapter = {};
for (const t of taxonomy.topics) {
  if (!topicsByChapter[t.chapter_id]) topicsByChapter[t.chapter_id] = [];
  topicsByChapter[t.chapter_id].push(t);
}

// Canonical Chapter IDs for Reasoning (subject_id = 1)
const REASONING_CHAPTERS = {
  analogy: 5,               // Chapter 1: Analogy
  coding_decoding: 6,       // Chapter 2: Coding-Decoding
  classification: 96,       // Chapter 3: Classification
  series: 7,                // Chapter 4: Series
  number_series: 76,        // Chapter 11: Number Series
  blood_relations: 97,      // Chapter 5: Blood Relations
  direction_sense: 98,      // Chapter 6: Direction Sense
  seating_arrangement: 99,  // Chapter 7: Seating Arrangement
  non_verbal: 100,          // Chapter 8: Non-Verbal Reasoning
  syllogism: 74,            // Chapter 9: Syllogism
  logical_venn: 75,         // Chapter 10: Logical Venn Diagrams
  mirror_water_image: 78,   // Chapter 12: Mirror & Water Images
  paper_cutting: 79,        // Chapter 13: Paper Cutting & Folding
  ranking_order: 567,       // Chapter 22: Ranking & Order
  puzzle: 575,              // Chapter 28: Puzzle
  data_sufficiency: 576,    // Chapter 29: Data Sufficiency
  cube_dice: 586,           // Chapter 43: Cube & Dice
  mathematical_operations: 588, // Chapter 45: Mathematical Operations
  alphabet_test: 568,       // Chapter 23: Alphabet Test
  general: 526,             // Chapter 31: General Intelligence Misc
};

// Canonical Chapter IDs for Quant (subject_id = 2)
const QUANT_CHAPTERS = {
  number_system: 280,       // Chapter 1: Number System
  lcm_hcf: 281,             // Chapter 2: LCM & HCF
  simplification: 282,      // Chapter 3: Simplification
  surds_indices: 283,       // Chapter 4: Surds, Indices & Roots
  percentage: 288,          // Chapter 5: Percentage
  profit_loss: 289,         // Chapter 6: Profit & Loss
  discount: 290,            // Chapter 7: Discount
  simple_interest: 291,     // Chapter 8: Simple Interest
  compound_interest: 292,   // Chapter 9: Compound Interest
  ratio_proportion: 286,    // Chapter 10: Ratio & Proportion
  mixture_alligation: 287,  // Chapter 11: Mixture & Alligation
  average: 285,             // Chapter 12: Average
  time_work: 293,           // Chapter 13: Time & Work
  pipe_cistern: 294,        // Chapter 14: Pipe & Cistern
  time_distance: 295,       // Chapter 15: Time & Distance
  boat_stream: 296,         // Chapter 16: Boat & Stream
  algebra: 297,             // Chapter 21: Algebra
  trigonometry: 298,        // Chapter 17: Trigonometry
  geometry: 299,            // Chapter 23: Geometry
  mensuration: 300,         // Chapter 24: Mensuration
  data_interpretation: 301, // Chapter 18: Data Interpretation
  statistics_probability: 302, // Chapter 19: Statistics & Probability
  miscellaneous: 303,       // Chapter 20: Miscellaneous
};

// Canonical Chapter IDs for English (subject_id = 3)
const ENGLISH_CHAPTERS = {
  vocabulary: 8,            // Chapter 1: Vocabulary
  grammar: 9,               // Chapter 2: Grammar
  comprehension: 10,        // Chapter 3: Comprehension
  active_passive: 82,       // Chapter 7: Active & Passive Voice
  direct_indirect: 83,      // Chapter 8: Direct & Indirect Speech
  synonyms_antonyms: 84,    // Chapter 22: Synonyms & Antonyms
  idioms_phrases: 85,       // Chapter 23: Idioms & Phrases
  error_detection: 109,     // Chapter 4: Error Detection
  sentence_completion: 325, // Chapter 34: Sentence Completion
};

// Helper: Clean HTML
function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deep semantic classifier reading full question text and structure.
 * Returns { detectedSubjectId, detectedChapterId, detectedSubtype, confidence } or null if inconclusive.
 */
function classifyQuestion(fullQuestionText, rawOptions, rawExplanation) {
  const t = fullQuestionText.toLowerCase();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ENGLISH LANGUAGE (High precision syntactic & grammatical markers)
  // ─────────────────────────────────────────────────────────────────────────
  if (
    t.includes("select the most appropriate synonym") ||
    t.includes("select the option that is the most appropriate synonym") ||
    t.includes("synonym of the given word") ||
    t.includes("synonym of the underlined word")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.synonyms_antonyms, subtype: "synonyms", confidence: "high" };
  }

  if (
    t.includes("select the most appropriate antonym") ||
    t.includes("select the option that is the most appropriate antonym") ||
    t.includes("antonym of the given word") ||
    t.includes("antonym of the underlined word")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.synonyms_antonyms, subtype: "antonyms", confidence: "high" };
  }

  if (
    t.includes("passive voice") ||
    t.includes("active voice") ||
    t.includes("change the following from active to passive") ||
    t.includes("convert the sentence provided below from its passive voice") ||
    t.includes("expresses the given sentence in passive voice") ||
    t.includes("expresses the given sentence in active voice")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.active_passive, subtype: "active_passive", confidence: "high" };
  }

  if (
    t.includes("indirect speech") ||
    t.includes("direct speech") ||
    t.includes("expresses the given sentence in indirect speech") ||
    t.includes("expresses the given sentence in direct speech") ||
    t.includes("a sentence is provided in direct speech") ||
    t.includes("a sentence is provided in indirect speech")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.direct_indirect, subtype: "direct_indirect", confidence: "high" };
  }

  if (
    t.includes("most appropriate meaning of the given idiom") ||
    t.includes("meaning of the given idiom") ||
    t.includes("meaning of the underlined idiom") ||
    t.includes("idiom that means the following")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.idioms_phrases, subtype: "idioms", confidence: "high" };
  }

  if (
    t.includes("one-word substitute") ||
    t.includes("one-word substitution") ||
    t.includes("can be used as a one-word substitute") ||
    t.includes("substitute for the given group of words")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.vocabulary, subtype: "one_word", confidence: "high" };
  }

  if (
    t.includes("incorrectly spelt word") ||
    t.includes("correctly spelt word") ||
    t.includes("misspelt word") ||
    t.includes("spelling of") ||
    t.includes("select the word with correct spelling")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.vocabulary, subtype: "spelling", confidence: "high" };
  }

  if (
    t.includes("grammatical error") ||
    t.includes("contains a grammatical error") ||
    t.includes("contains an error") ||
    t.includes("spot the error") ||
    t.includes("identify the segment that contains a grammatical error") ||
    t.includes("improve the underlined part of the given sentence")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.error_detection, subtype: "error_detection", confidence: "high" };
  }

  if (
    t.includes("in the following passage, some words have been deleted") ||
    t.includes("read the following passage and fill in the blanks") ||
    t.includes("read the given passage and answer the questions") ||
    t.includes("read the passage and answer") ||
    t.includes("rearrange the following sentences to form a coherent paragraph")
  ) {
    return { subjectId: 3, chapterId: ENGLISH_CHAPTERS.comprehension, subtype: "comprehension", confidence: "high" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. GENERAL INTELLIGENCE & REASONING (Structural Puzzles & Logical Rules)
  // ─────────────────────────────────────────────────────────────────────────

  // Syllogisms & Statement-Conclusion Deductions
  if (
    ((t.includes("statement") || t.includes("statements") || t.includes("कथन")) &&
     (t.includes("conclusion") || t.includes("conclusions") || t.includes("निष्कर्ष"))) ||
    t.includes("logically follow") ||
    t.includes("तार्किक रूप से अनुसरण") ||
    t.includes("select a conclusion from the given alternatives") ||
    t.includes("read the statements and select a conclusion")
  ) {
    if (
      t.includes("all ") || t.includes("some ") || t.includes("no ") ||
      t.includes("सभी ") || t.includes("कुछ ") || t.includes("कोई ") ||
      t.includes("conclusion i") || t.includes("conclusion 1") || t.includes("निष्कर्ष i") ||
      t.includes("either conclusion") || t.includes("neither conclusion") ||
      t.includes("select a conclusion from the given alternatives") ||
      t.includes("read the statements and select a conclusion")
    ) {
      return { subjectId: 1, chapterId: REASONING_CHAPTERS.syllogism, subtype: "syllogism", confidence: "high" };
    }
  }

  // Blood Relations (Puzzles & Family Tree Deductions)
  if (
    (t.includes("pointing to") || t.includes("pointing towards") || t.includes("indicating to a woman") || t.includes("तस्वीर की ओर इशारा") || t.includes("इशारा करते हुए")) &&
    (t.includes("said") || t.includes("says") || t.includes("कहा") || t.includes("कहता") || t.includes("कहती"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.blood_relations, subtype: "blood_relations", confidence: "high" };
  }
  if (
    (t.includes("mother's only daughter") || t.includes("father's only son") || t.includes("uncle's only son") || t.includes("mother's husband's only son") || t.includes("father of your sister's brother") || t.includes("son of her grandfather") || t.includes("wife of the grandson of my mother") || t.includes("father of my son's father") || t.includes("only daughter of your father")) ||
    (t.includes("is the brother of") && (t.includes("is the father of") || t.includes("is the mother of") || t.includes("sister of") || t.includes("is the husband of") || t.includes("is the daughter of"))) ||
    (t.includes("is the husband of") && (t.includes("is the mother of") || t.includes("is the wife of") || t.includes("is the father of") || t.includes("is the daughter of"))) ||
    (t.includes("is the wife of") && (t.includes("daughters of") || t.includes("daughter of") || t.includes("sister of"))) ||
    (t.includes("daughter of") && t.includes("brother") && t.includes("sister") && t.includes("how is")) ||
    (t.includes("daughter of mohan who is the only son-in-law")) ||
    (t.includes("is daughter of b") || t.includes("is wife of b") || t.includes("is father of b") || t.includes("is sister of b")) ||
    (t.includes("a + b means") && (t.includes("sister") || t.includes("father") || t.includes("mother") || t.includes("brother") || t.includes("daughter") || t.includes("wife"))) ||
    (t.includes("how is") && t.includes("related to") && !t.includes("directive principles") && !t.includes("fundamental rights") && (t.includes("nephew") || t.includes("niece") || t.includes("cousin") || t.includes("maternal uncle") || t.includes("sister-in-law") || t.includes("brother-in-law") || t.includes("daughter-in-law") || t.includes("father-in-law") || t.includes("charu") || t.includes("eniya") || t.includes("ram's brother"))) ||
    (t.includes("who is ram to the girl"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.blood_relations, subtype: "blood_relations", confidence: "high" };
  }

  // Seating Arrangement & Floor Puzzles
  if (
    t.includes("sitting around a circular table") ||
    t.includes("sitting around a circle") ||
    t.includes("sitting around a square table") ||
    t.includes("sitting around a hexagon") ||
    t.includes("sitting in a straight line") ||
    t.includes("sitting in a row, facing north") ||
    t.includes("sitting in a row facing north") ||
    t.includes("sitting in a row, facing south") ||
    t.includes("sitting in a row facing south") ||
    t.includes("sitting in a row facing the north") ||
    t.includes("live on six different floors") ||
    t.includes("live on seven different floors") ||
    t.includes("live on eight different floors") ||
    t.includes("वृत्ताकार मेज के चारों ओर") ||
    t.includes("सीधी रेखा में उत्तर की ओर") ||
    (t.includes("seven people") && t.includes("sitting in a row")) ||
    (t.includes("sitting") && t.includes("facing the centre")) ||
    (t.includes("sitting in a circle") && t.includes("facing the centre")) ||
    (t.includes("बैठे हैं") && t.includes("केंद्र की ओर मुख") && t.includes("ठीक बाएं"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.seating_arrangement, subtype: "seating_arrangement", confidence: "high" };
  }

  // Direction & Distance
  if (
    (t.includes("walks") || t.includes("drives") || t.includes("travels") || t.includes("चलता है") || t.includes("चलती है") || t.includes("कार चलाता है")) &&
    (t.includes("turns left") || t.includes("turns right") || t.includes("takes a left turn") || t.includes("takes a right turn") || t.includes("बाएं मुड़ता") || t.includes("दाएं मुड़ता")) &&
    (t.includes("north") || t.includes("south") || t.includes("east") || t.includes("west") || t.includes("उत्तर") || t.includes("दक्षिण") || t.includes("पूर्व") || t.includes("पश्चिम"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.direction_sense, subtype: "direction_sense", confidence: "high" };
  }

  // Coding & Decoding
  if (
    t.includes("in a certain code language") ||
    t.includes("in a code language") ||
    (t.includes("in a certain language") && t.includes("coded as")) ||
    t.includes("coded using letter codes") ||
    t.includes("coded by using letters and symbols") ||
    t.includes("coded by using numbers and symbols") ||
    t.includes("एक निश्चित कूट भाषा में") ||
    t.includes("एक कूट भाषा में") ||
    (t.includes("coded as") && (t.includes("can be coded as") || t.includes("will be coded as") || t.includes("then how") || t.includes("written as") || t.includes("what is the code") || t.includes("how will") || t.includes("how can") || t.includes("how is"))) ||
    (t.includes("is coded as") && t.includes("be coded")) ||
    (t.includes("is written as") && (t.includes("how will") || t.includes("coded as") || t.includes("in that language"))) ||
    t.includes("के रूप में कूटबद्ध किया जाता है") ||
    t.includes("के रूप में लिखा जाता है")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.coding_decoding, subtype: "coding_decoding", confidence: "high" };
  }

  // Logical Venn Diagrams
  if (
    (t.includes("venn diagram") || t.includes("वेन आरेख")) &&
    (t.includes("best represents the relationship") || t.includes("best represents") || t.includes("दर्शाता है") || t.includes("संबंध को सबसे अच्छे तरीके से") || t.includes("triangle represents") || t.includes("circle represents") || t.includes("study the given venn diagram"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.logical_venn, subtype: "logical_venn", confidence: "high" };
  }

  // Non-verbal: Mirror/Water image, Paper folding/cutting, Embedded figures, Cube & Dice
  if (
    t.includes("mirror image of the given figure") ||
    t.includes("water image of the given figure") ||
    t.includes("दर्पण छवि") ||
    t.includes("जल प्रतिबिंब")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.mirror_water_image, subtype: "mirror_water_image", confidence: "high" };
  }

  if (
    t.includes("paper is folded and cut") ||
    t.includes("paper is folded") ||
    t.includes("translucent sheet appear when folded") ||
    t.includes("कागज को मोड़ा और काटा जाता है") ||
    t.includes("कागज को मोड़ा जाता है")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.paper_cutting, subtype: "paper_cutting", confidence: "high" };
  }

  if (
    t.includes("embedded in the given figure") ||
    t.includes("figure is embedded") ||
    t.includes("दी गई आकृति में अंतर्निहित") ||
    t.includes("figure completion") ||
    t.includes("complete the pattern")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.non_verbal, subtype: "embedded_figures", confidence: "high" };
  }

  if (
    t.includes("opposite to the face showing") ||
    t.includes("opposite to the face having") ||
    t.includes("opposite the face showing") ||
    t.includes("दिखाने वाले फलक के विपरीत") ||
    (t.includes("dice") && (t.includes("opposite") || t.includes("विपरीत"))) ||
    (t.includes("पासे") && t.includes("विपरीत"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.cube_dice, subtype: "cube_dice", confidence: "high" };
  }

  // Mathematical operations sign interchange
  if (
    (t.includes("interchanging the two signs") || t.includes("interchange of signs") || t.includes("चिह्नों को आपस में बदलने")) ||
    (t.includes("if ‘+’ means") || t.includes("if '+' means") || t.includes("if ‘-’ means") || t.includes("यदि '+' का अर्थ") || t.includes("यदि ‘+’ का अर्थ")) ||
    (t.includes("which two signs should be interchanged") || t.includes("किन दो चिह्नों को आपस में बदला जाना चाहिए"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.mathematical_operations, subtype: "mathematical_operations", confidence: "high" };
  }

  // Order & Ranking
  if (
    (t.includes("rank") || t.includes("स्थान") || t.includes("row of")) &&
    (t.includes("from the left") || t.includes("from the right") || t.includes("from the top") || t.includes("from the bottom") || t.includes("बाएं से") || t.includes("दाएं से") || t.includes("शीर्ष से") || t.includes("नीचे से")) &&
    (t.includes("position") || t.includes("how many") || t.includes("कुल कितने"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.ranking_order, subtype: "ranking_order", confidence: "high" };
  }

  // Letter & Word Analogies / Classification / Series
  if (
    t.includes("based on the english alphabetical order, three of the following four") ||
    t.includes("अंग्रेजी वर्णमाला क्रम के आधार पर, निम्नलिखित चार में से तीन") ||
    t.includes("select the letter-cluster that can replace the question mark") ||
    t.includes("letter-number clusters will replace the question mark") ||
    t.includes("उस अक्षर-समूह का चयन करें जो प्रश्न चिह्न")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.alphabet_test, subtype: "alphabet_analogy", confidence: "high" };
  }

  if (
    t.includes("select the option that is related to the third") ||
    t.includes("select the option that is related to the fifth") ||
    t.includes("तीसरे पद से उसी प्रकार संबंधित है") ||
    t.includes("पांचवीं संख्या से उसी प्रकार संबंधित है") ||
    t.includes("select the set in which the numbers are related in the same way") ||
    t.includes("उस समुच्चय का चयन करें जिसमें संख्याएं उसी तरह संबंधित हैं")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.analogy, subtype: "analogy", confidence: "high" };
  }

  if (
    t.includes("three of the following four are alike in a certain way") ||
    t.includes("निम्नलिखित चार में से तीन एक निश्चित तरीके से समान हैं") ||
    t.includes("select the odd one out") ||
    t.includes("select the odd word") ||
    t.includes("select the odd letter-cluster") ||
    t.includes("select the odd number-pair") ||
    t.includes("विषम शब्द का चयन करें") ||
    t.includes("विषम अक्षर-समूह का चयन करें") ||
    t.includes("विषम संख्या-युग्म का चयन करें")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.classification, subtype: "classification", confidence: "high" };
  }

  if (
    (t.includes("what should come in place of") && t.includes("series")) ||
    (t.includes("what will come in place of") && t.includes("series")) ||
    (t.includes("what will come in place of the question mark") && t.includes("series")) ||
    (t.includes("come in place of '?' in the given series")) ||
    (t.includes("come in place of the question mark (?) in the given series")) ||
    t.includes("replace the question mark (?) in the following series") ||
    t.includes("replace the question mark in the following series") ||
    t.includes("replace the question mark (?) in the given series") ||
    t.includes("निम्नलिखित श्रृंखला में प्रश्न चिह्न (?) के स्थान पर") ||
    t.includes("दी गई श्रृंखला में प्रश्न चिह्न (?) के स्थान पर") ||
    t.includes("what will come in place of the question mark (?) in the following series")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.series, subtype: "series", confidence: "high" };
  }

  if (
    t.includes("dictionary order") ||
    t.includes("शब्दकोश क्रम") ||
    t.includes("order in which they appear in an english dictionary") ||
    t.includes("arrange the following words in a logical and meaningful order") ||
    t.includes("तार्किक और सार्थक क्रम में व्यवस्थित करें")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.alphabet_test, subtype: "dictionary_order", confidence: "high" };
  }

  if (
    t.includes("data provided in the statements are sufficient to answer") ||
    t.includes("कथनों में दिया गया डेटा उत्तर देने के लिए पर्याप्त है") ||
    (t.includes("statements numbered (i) and (ii)") && t.includes("sufficient to answer the question"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.data_sufficiency, subtype: "data_sufficiency", confidence: "high" };
  }

  // Scheduling & Ordering Puzzles
  if (
    (t.includes("flight on a different day") || t.includes("different day of a week starting from monday")) ||
    (t.includes("boxes") && t.includes("stacked one above another")) ||
    (t.includes("floors") && (t.includes("ground floor is numbered 1") || t.includes("topmost floor"))) ||
    (t.includes("seven friends") && t.includes("different days of the week"))
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.puzzle, subtype: "puzzle", confidence: "high" };
  }

  // 3-digit Number Sets / Sequence Reasoning
  if (
    t.includes("question is based on the five, three-digit numbers given below") ||
    t.includes("question is based on the following three-digit numbers") ||
    t.includes("दी गई तीन अंकों की संख्याओं पर आधारित")
  ) {
    return { subjectId: 1, chapterId: REASONING_CHAPTERS.series, subtype: "number_set_reasoning", confidence: "high" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. QUANTITATIVE APTITUDE (Arithmetic, Commercial Math, Advanced Math)
  // ─────────────────────────────────────────────────────────────────────────

  // Simple & Compound Interest
  if (
    t.includes("compound interest") ||
    t.includes("compounded annually") ||
    t.includes("compounded half-yearly") ||
    t.includes("चक्रवृद्धि ब्याज")
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.compound_interest, subtype: "compound_interest", confidence: "high" };
  }
  if (
    t.includes("simple interest") || t.includes("साधारण ब्याज") ||
    (t.includes("interest") && (t.includes("maturity value") || t.includes("fetch an interest of") || t.includes("per paise per rupee") || t.includes("rate of 10 paise") || t.includes("rate of 6% per month") || t.includes("rate of 3% per month")))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.simple_interest, subtype: "simple_interest", confidence: "high" };
  }

  // Profit, Loss & Discount
  if (
    (t.includes("cost price") || t.includes("selling price") || t.includes("क्रय मूल्य") || t.includes("विक्रय मूल्य")) &&
    (t.includes("profit") || t.includes("loss") || t.includes("gain") || t.includes("लाभ") || t.includes("हानि") || t.includes("article") || t.includes("वस्तु"))
  ) {
    if (t.includes("discount") || t.includes("marked price") || t.includes("बट्टा") || t.includes("अंकित मूल्य")) {
      return { subjectId: 2, chapterId: QUANT_CHAPTERS.discount, subtype: "discount", confidence: "high" };
    }
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.profit_loss, subtype: "profit_loss", confidence: "high" };
  }
  if (t.includes("marked price") || t.includes("successive discount") || t.includes("अंकित मूल्य")) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.discount, subtype: "discount", confidence: "high" };
  }

  // Time & Work / Pipe & Cistern
  if (
    (t.includes("pipe a") && (t.includes("pipe b") || t.includes("fill the tank") || t.includes("empty the tank"))) ||
    (t.includes("नल a") && (t.includes("हौज") || t.includes("टंकी"))) ||
    (t.includes("can fill a tank") || t.includes("can fill the tank") || t.includes("pipe can empty") || t.includes("empty the filled tank") || t.includes("empty the completely filled tank"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.pipe_cistern, subtype: "pipe_cistern", confidence: "high" };
  }
  // Simplification & Basic Arithmetic
  if (
    t.includes("the simplified value of") ||
    t.includes("simplified value of") ||
    t.includes("का सरलीकृत मान") ||
    t.includes("find the simplified value") ||
    t.includes("simplfy:") ||
    t.includes("simplify:") ||
    t.includes("सरल कीजिए:")
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.simplification, subtype: "simplification", confidence: "high" };
  }

  if (
    (t.includes("can complete a work in") || t.includes("can do a piece of work in") || t.includes("can finish a task in") || t.includes("किसी कार्य को") || t.includes("एक काम को")) &&
    (t.includes("days") || t.includes("hours") || t.includes("दिनों में") || t.includes("घंटे में"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.time_work, subtype: "time_work", confidence: "high" };
  }
  if (
    (t.includes("machines can manufacture") && t.includes("hours")) ||
    (t.includes("men can complete a work in") && t.includes("women can do")) ||
    (t.includes("workers in 20 days, then how many days"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.time_work, subtype: "time_work", confidence: "high" };
  }

  // Time, Distance, Speed / Train / Boat & Stream
  if (
    (t.includes("boat") && (t.includes("upstream") || t.includes("downstream") || t.includes("still water"))) ||
    (t.includes("नाव") && (t.includes("शांत जल") || t.includes("धारा के अनुकूल") || t.includes("धारा के प्रतिकूल")))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.boat_stream, subtype: "boat_stream", confidence: "high" };
  }
  if (
    (t.includes("train") && (t.includes("crosses a pole") || t.includes("crosses a platform") || t.includes("crosses a man") || t.includes("speed of the train"))) ||
    (t.includes("ट्रेन") && (t.includes("खंभे को पार") || t.includes("प्लेटफॉर्म को पार"))) ||
    (t.includes("speed of") && t.includes("km/h") && t.includes("distance"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.time_distance, subtype: "time_distance", confidence: "high" };
  }

  // Trigonometry
  if (
    t.includes("sinθ") || t.includes("cosθ") || t.includes("tanθ") ||
    t.includes("sin θ") || t.includes("cos θ") || t.includes("tan θ") ||
    t.includes("tan\\theta") || t.includes("sin\\theta") || t.includes("cos\\theta") ||
    t.includes("tan\\\\theta") || t.includes("sin\\\\theta") || t.includes("cos\\\\theta") ||
    t.includes("sin2θ") || t.includes("cos2θ") || t.includes("cosec") ||
    t.includes("cot θ") || t.includes("sec θ") ||
    t.includes("angle of elevation") || t.includes("angle of depression") ||
    t.includes("उन्नयन कोण") || t.includes("अवनमन कोण") ||
    (t.includes("x = asinθ") || t.includes("y = acosθ"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.trigonometry, subtype: "trigonometry", confidence: "high" };
  }

  // Geometry
  if (
    (t.includes("tangent") && t.includes("circle")) ||
    (t.includes("chord") && t.includes("circle")) ||
    (t.includes("triangle abc") && (t.includes("angle") || t.includes("cm") || t.includes("perimeter"))) ||
    (t.includes("cyclic quadrilateral") || t.includes("चक्रीय चतुर्भुज")) ||
    (t.includes("incentre") || t.includes("orthocentre") || t.includes("circumcentre") || t.includes("centroid")) ||
    (t.includes("rhombus") && t.includes("diagonal"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.geometry, subtype: "geometry", confidence: "high" };
  }

  // Mensuration (2D & 3D)
  if (
    t.includes("volume of a sphere") ||
    t.includes("volume of a cone") ||
    t.includes("volume of a cylinder") ||
    t.includes("surface area of a cylinder") ||
    t.includes("surface area of a sphere") ||
    t.includes("curved surface area") ||
    t.includes("बेलन का आयतन") ||
    t.includes("शंकु का आयतन") ||
    t.includes("गोले का आयतन") ||
    t.includes("वक्र पृष्ठीय क्षेत्रफल") ||
    (t.includes("frustum of a cone") || t.includes("शंकु का छिन्नक"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.mensuration, subtype: "mensuration", confidence: "high" };
  }

  // Statistics & Probability
  if (
    (t.includes("mode") && t.includes("median") && t.includes("mean")) ||
    t.includes("बहुलक") && t.includes("माध्यिका") && t.includes("माध्य") ||
    t.includes("standard deviation") ||
    t.includes("मानक विचलन") ||
    (t.includes("probability of") && (t.includes("dice") || t.includes("cards") || t.includes("balls") || t.includes("deck")))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.statistics_probability, subtype: "statistics", confidence: "high" };
  }

  // LCM & HCF
  if (
    (t.includes("lcm and hcf") || t.includes("hcf and lcm") || t.includes("l.c.m. and h.c.f.")) ||
    (t.includes("ल.स.प. और म.स.प.") || t.includes("लघुत्तम समापवर्त्य और महत्तम समापवर्तक"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.lcm_hcf, subtype: "lcm_hcf", confidence: "high" };
  }

  // Surds & Indices / Powers
  if (
    (t.includes("find the value of m, satisfying equation") && t.includes("\\left(\\dfrac{")) ||
    (t.includes("surds") || t.includes("indices") || t.includes("करणी") || t.includes("घातांक"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.surds_indices, subtype: "surds_indices", confidence: "high" };
  }

  // Divisibility / Number System
  if (
    (t.includes("divisible by") || t.includes("विभाज्य है") || t.includes("विभाजित किया जाता है")) &&
    (t.includes("digit number") || t.includes("अंकों की संख्या") || t.includes("leaves a remainder") || t.includes("शेषफल बचता है") || t.includes("unit digit") || t.includes("इकाई का अंक"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.number_system, subtype: "number_system", confidence: "high" };
  }

  // Ratio, Proportion, Mixture, Average
  if (
    (t.includes("ratio of") || t.includes("अनुपात")) &&
    (t.includes("mixture") || t.includes("alligation") || t.includes("मिश्रण") || t.includes("milk and water") || t.includes("दूध और पानी"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.mixture_alligation, subtype: "mixture", confidence: "high" };
  }

  if (
    (t.includes("average of") || t.includes("औसत")) &&
    (t.includes("numbers is") || t.includes("students is") || t.includes("years ago from now, the average age"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.average, subtype: "average", confidence: "high" };
  }

  // Algebra (Polynomials, equations with unknowns)
  if (
    (t.includes("if a + b + c =") || t.includes("if x + 1/x =") || t.includes("if x + 1/x =")) ||
    (t.includes("how many solutions are possible for the given three unknowns") && t.includes("−3α + 2β"))
  ) {
    return { subjectId: 2, chapterId: QUANT_CHAPTERS.algebra, subtype: "algebra", confidence: "high" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. GENERAL STUDIES DISCIPLINE CLASSIFICATION (for GS questions)
  // ─────────────────────────────────────────────────────────────────────────

  // Computer Knowledge (subject_id = 13)
  if (
    t.includes("windows 11") || t.includes("windows 10") || t.includes("operating system") ||
    t.includes("file extension") || t.includes(".msi") || t.includes(".exe") || t.includes(".docx") ||
    t.includes("bios stands for") || t.includes("cache memory") || t.includes("ram and rom") ||
    t.includes("central processing unit") || t.includes("alu stands for") || t.includes("ip address") ||
    t.includes("http stands for") || t.includes("web browser") || t.includes("ms excel") ||
    t.includes("ms powerpoint") || t.includes("ms word") || t.includes("shortcut key") ||
    t.includes("ऑपरेटिंग सिस्टम") || t.includes("कंप्यूटर")
  ) {
    return { subjectId: 13, chapterId: 90, subtype: "computers", confidence: "high" };
  }

  // Polity (subject_id = 5)
  if (
    t.includes("constitution of india") || t.includes("भारतीय संविधान") ||
    t.includes("fundamental rights") || t.includes("मौलिक अधिकार") ||
    t.includes("directive principles") || t.includes("राज्य के नीति निर्देशक तत्व") ||
    t.includes("article of the constitution") || t.includes("संविधान के किस अनुच्छेद") ||
    t.includes("article 370") || t.includes("article 21") || t.includes("article 14") || t.includes("article 32") ||
    t.includes("constitutional amendment") || t.includes("संविधान संशोधन") ||
    t.includes("citizenship amendment act") ||
    t.includes("lok sabha") || t.includes("rajya sabha") || t.includes("लोकसभा") || t.includes("राज्यसभा") ||
    t.includes("president of india") || t.includes("भारत के राष्ट्रपति") ||
    t.includes("supreme court of india") || t.includes("सर्वोच्च न्यायालय") ||
    t.includes("panchayati raj") || t.includes("पंचायती राज") ||
    t.includes("preamble of the constitution") || t.includes("संविधान की प्रस्तावना")
  ) {
    return { subjectId: 5, chapterId: 69, subtype: "polity", confidence: "high" };
  }

  // History (subject_id = 4)
  if (
    t.includes("harappan") || t.includes("indus valley") || t.includes("हड़प्पा") || t.includes("सिंधु घाटी") ||
    t.includes("maurya empire") || t.includes("ashoka") || t.includes("मौर्य साम्राज्य") || t.includes("अशोक") ||
    t.includes("gupta dynasty") || t.includes("गुप्त वंश") ||
    t.includes("delhi sultanate") || t.includes("दिल्ली सल्तनत") ||
    t.includes("mughal empire") || t.includes("akbar") || t.includes("मुगल साम्राज्य") || t.includes("अकबर") ||
    t.includes("battle of plassey") || t.includes("battle of buxar") || t.includes("प्लासी का युद्ध") || t.includes("बक्सर का युद्ध") ||
    t.includes("revolt of 1857") || t.includes("1857 का विद्रोह") ||
    t.includes("indian national congress") || t.includes("भारतीय राष्ट्रीय कांग्रेस") ||
    t.includes("gandhiji") || t.includes("mahatma gandhi") || t.includes("गांधीजी") ||
    t.includes("non-cooperation movement") || t.includes("civil disobedience") || t.includes("quit india movement") ||
    t.includes("sufi movement") || t.includes("bhakti movement") || t.includes("सूफी आंदोलन") ||
    t.includes("bahishkrit hitakarini sabha") || t.includes("b.r. ambedkar") ||
    t.includes("poverty and un-british rule in india") || t.includes("dadabhai naoroji")
  ) {
    return { subjectId: 4, chapterId: 63, subtype: "history", confidence: "high" };
  }

  // Geography (subject_id = 6)
  if (
    t.includes("soil is most suitable for cotton") || t.includes("कपास की खेती के लिए कौन सी मिट्टी") ||
    t.includes("tropic of cancer") || t.includes("कर्क रेखा") ||
    t.includes("river flows into the arabian sea") || t.includes("river flows into the bay of bengal") ||
    t.includes("tributary of river") || t.includes("सहायक नदी") ||
    t.includes("western ghats") || t.includes("eastern ghats") || t.includes("पश्चिमी घाट") ||
    t.includes("taiga type region") || t.includes("tundra") || t.includes("tropical rainforest") ||
    t.includes("monsoon in india") || t.includes("मानसून") ||
    t.includes("solar system") || t.includes("planet closest to the sun") || t.includes("सौर मंडल") ||
    t.includes("highest peak in india") || t.includes("भारत की सबसे ऊंची चोटी")
  ) {
    return { subjectId: 6, chapterId: 147, subtype: "geography", confidence: "high" };
  }

  // Physics (subject_id = 8)
  if (
    t.includes("si unit of") || t.includes("का si मात्रक") ||
    t.includes("newton's law of motion") || t.includes("न्यूटन के गति का नियम") ||
    t.includes("kinetic energy") || t.includes("potential energy") || t.includes("गतिज ऊर्जा") || t.includes("स्थितिज ऊर्जा") ||
    t.includes("speed of light") || t.includes("प्रकाश की चाल") ||
    t.includes("refraction of light") || t.includes("reflection of light") || t.includes("प्रकाश का अपवर्तन") ||
    t.includes("electric current") || t.includes("resistance of a wire") || t.includes("विद्युत धारा") || t.includes("प्रतिरोध") ||
    t.includes("acceleration due to gravity") || t.includes("गुरुत्वीय त्वरण") ||
    t.includes("brightest star in our night sky")
  ) {
    return { subjectId: 8, chapterId: 71, subtype: "physics", confidence: "high" };
  }

  // Chemistry (subject_id = 9)
  if (
    t.includes("periodic table") || t.includes("आवर्त सारणी") ||
    t.includes("atomic number") || t.includes("परमाणु क्रमांक") ||
    t.includes("discovery of the electron") || t.includes("इलेक्ट्रॉन की खोज") ||
    t.includes("chemical formula of") || t.includes("का रासायनिक सूत्र") ||
    t.includes("ph value of") || t.includes("का ph मान") ||
    t.includes("baking soda") || t.includes("washing soda") || t.includes("bleaching powder") ||
    t.includes("बेकिंग सोडा") || t.includes("धावन सोडा") ||
    t.includes("oxidation and reduction") || t.includes("ऑक्सीकरण") ||
    t.includes("isotopes of") || t.includes("समस्थानिक")
  ) {
    return { subjectId: 9, chapterId: 72, subtype: "chemistry", confidence: "high" };
  }

  // Biology (subject_id = 10)
  if (
    t.includes("photosynthesis") || t.includes("प्रकाश संश्लेषण") ||
    t.includes("cellular respiration") || t.includes("atp") ||
    t.includes("characteristic of all living things") || t.includes("सजीवों की विशेषता") ||
    t.includes("deficiency of vitamin") || t.includes("विटामिन की कमी से") ||
    t.includes("red blood cells") || t.includes("white blood cells") || t.includes("लाल रक्त कणिकाएं") ||
    t.includes("human digestive system") || t.includes("पाचन तंत्र") ||
    t.includes("dna and rna") || t.includes("chromosome") || t.includes("गुणसूत्र") ||
    t.includes("powerhouse of the cell") || t.includes("माइटोकॉन्ड्रिया")
  ) {
    return { subjectId: 10, chapterId: 121, subtype: "biology", confidence: "high" };
  }

  // Economy (subject_id = 7)
  if (
    t.includes("gross domestic product") || t.includes("gdp") || t.includes("सकल घरेलू उत्पाद") ||
    t.includes("reserve bank of india") || t.includes("rbi") || t.includes("भारतीय रिज़र्व बैंक") ||
    t.includes("repo rate") || t.includes("reverse repo rate") || t.includes("रेपो दर") ||
    t.includes("inflation in india") || t.includes("मुद्रास्फीति") ||
    t.includes("fiscal deficit") || t.includes("राजकोषीय घाटा") ||
    t.includes("five year plan") || t.includes("पंचवर्षीय योजना") ||
    t.includes("monetary policy") || t.includes("मौद्रिक नीति")
  ) {
    return { subjectId: 7, chapterId: 171, subtype: "economy", confidence: "high" };
  }

  // Current Affairs (subject_id = 12)
  if (
    t.includes("employment linked incentive (eli) scheme") ||
    t.includes("viksit bharat") ||
    t.includes("pradhan mantri") && (t.includes("yojana") || t.includes("scheme")) ||
    t.includes("in december 2025") || t.includes("in 2025") || t.includes("in 2026") || t.includes("in 2024") ||
    t.includes("gfra 2025") ||
    t.includes("isro's human spaceflight") || t.includes("gaganyaan") ||
    t.includes("santosh trophy 2022-23") || t.includes("santosh trophy 2023-24") ||
    t.includes("icc men's t20 world cup 2024") ||
    t.includes("union budget 2025-26") || t.includes("union budget 2024-25")
  ) {
    return { subjectId: 12, chapterId: 11, subtype: "current_affairs", confidence: "high" };
  }

  // Static GK (subject_id = 11)
  if (
    t.includes("folk music form of uttar pradesh") ||
    t.includes("classical dance of") || t.includes("शास्त्रीय नृत्य") ||
    t.includes("folk dance of") || t.includes("लोक नृत्य") ||
    t.includes("national award") || t.includes("bharat ratna") || t.includes("भारत रत्न") ||
    t.includes("unesco world heritage site") || t.includes("यूनेस्को विश्व धरोहर स्थल") ||
    t.includes("world cup in football") || t.includes("फीफा विश्व कप") ||
    t.includes("national symbol of india") || t.includes("राष्ट्रीय प्रतीक")
  ) {
    return { subjectId: 11, chapterId: 189, subtype: "static_gk", confidence: "high" };
  }

  return null;
}

/**
 * Get canonical section name for a subject_id.
 */
function getCanonicalSection(subjectId) {
  switch (subjectId) {
    case 1:
      return "General Intelligence & Reasoning";
    case 2:
      return "Quantitative Aptitude";
    case 3:
      return "English Language";
    default:
      return "General Awareness";
  }
}

/**
 * Find the best topic_id under a chapter_id.
 */
function getBestTopicId(chapterId, subjectId) {
  const chTopics = topicsByChapter[chapterId];
  if (chTopics && chTopics.length > 0) {
    return chTopics[0].id;
  }
  // Fallback: any topic for the subject
  for (const t of taxonomy.topics) {
    if (t.subject_id === subjectId) return t.id;
  }
  return null;
}

async function run() {
  const isApply = process.argv.includes("--apply");
  console.log(`=== RECLASSIFICATION ENGINE (${isApply ? "APPLY MODE - LIVE UPDATES" : "DRY RUN MODE"}) ===\n`);

  const batchSize = 2500;
  let offset = 0;
  let totalProcessed = 0;

  const plannedChanges = [];
  const changeStats = {
    reasoningFixedFromGs: 0,
    quantFixedFromGs: 0,
    englishFixedFromGs: 0,
    reasoningFixedFromQuant: 0,
    quantFixedFromReasoning: 0,
    gsReclassified: 0,
    totalChanges: 0,
  };

  while (true) {
    const res = await pool.query(`
      SELECT id, test_id, question_number, section, subject_id, chapter_id, topic_id,
             question_text, options, explanation
      FROM questions
      ORDER BY id
      LIMIT $1 OFFSET $2;
    `, [batchSize, offset]);

    if (res.rows.length === 0) break;

    for (const q of res.rows) {
      const fullText = cleanText(q.question_text);
      const optText = cleanText(JSON.stringify(q.options || ""));
      const expText = cleanText(q.explanation || "");

      const classification = classifyQuestion(fullText, optText, expText);

      if (classification && classification.confidence === "high") {
        const { subjectId: newSubjId, chapterId: newChapId, subtype } = classification;
        const currentSubjId = q.subject_id;

        // Check if subject is different OR if it was a Reasoning/Quant in GS
        const isMajorSubjectMismatch =
          (newSubjId === 1 && currentSubjId !== 1) ||
          (newSubjId === 2 && currentSubjId !== 2) ||
          (newSubjId === 3 && currentSubjId !== 3) ||
          (newSubjId >= 4 && newSubjId <= 13 && currentSubjId <= 3);

        const isGsDisciplineCorrection =
          newSubjId >= 4 && newSubjId <= 13 &&
          currentSubjId >= 4 && currentSubjId <= 13 &&
          newSubjId !== currentSubjId;

        if (isMajorSubjectMismatch || isGsDisciplineCorrection) {
          const newSection = getCanonicalSection(newSubjId);
          const newTopicId = getBestTopicId(newChapId, newSubjId);

          if (newSubjId === 1 && currentSubjId >= 4) changeStats.reasoningFixedFromGs++;
          else if (newSubjId === 2 && currentSubjId >= 4) changeStats.quantFixedFromGs++;
          else if (newSubjId === 3 && currentSubjId >= 4) changeStats.englishFixedFromGs++;
          else if (newSubjId === 1 && currentSubjId === 2) changeStats.reasoningFixedFromQuant++;
          else if (newSubjId === 2 && currentSubjId === 1) changeStats.quantFixedFromReasoning++;
          else if (isGsDisciplineCorrection) changeStats.gsReclassified++;

          changeStats.totalChanges++;

          plannedChanges.push({
            id: q.id,
            test_id: q.test_id,
            question_number: q.question_number,
            old: {
              subject_id: currentSubjId,
              chapter_id: q.chapter_id,
              topic_id: q.topic_id,
              section: q.section,
            },
            new: {
              subject_id: newSubjId,
              chapter_id: newChapId,
              topic_id: newTopicId,
              section: newSection,
            },
            subtype,
            textSnippet: fullText.slice(0, 110),
          });
        }
      }

      totalProcessed++;
    }

    offset += batchSize;
    process.stdout.write(`Scanned ${totalProcessed} questions...\r`);
  }

  console.log(`\nScan Complete! Total questions analyzed: ${totalProcessed}\n`);

  console.log("================ PLANNED CHANGES SUMMARY ================");
  console.log(`1. Reasoning questions restored from GS (subjects 4..13 -> 1): ${changeStats.reasoningFixedFromGs}`);
  console.log(`2. Quant questions restored from GS (subjects 4..13 -> 2):      ${changeStats.quantFixedFromGs}`);
  console.log(`3. English questions restored from GS (subjects 4..13 -> 3):    ${changeStats.englishFixedFromGs}`);
  console.log(`4. Reasoning questions restored from Quant (subject 2 -> 1):    ${changeStats.reasoningFixedFromQuant}`);
  console.log(`5. Quant questions restored from Reasoning (subject 1 -> 2):    ${changeStats.quantFixedFromReasoning}`);
  console.log(`6. GS questions corrected to true discipline (e.g. 5 -> 8):    ${changeStats.gsReclassified}`);
  console.log(`---------------------------------------------------------`);
  console.log(`TOTAL TAXONOMY CORRECTIONS PLANNED: ${changeStats.totalChanges}`);

  console.log("\n--- Sample Corrections (first 15) ---");
  for (const c of plannedChanges.slice(0, 15)) {
    console.log(`Q ID ${c.id} (Test ${c.test_id} #${c.question_number}) [${c.subtype}]:`);
    console.log(`  Text: "${c.textSnippet}..."`);
    console.log(`  OLD: Subject ${c.old.subject_id} | Ch ${c.old.chapter_id} | Section: "${c.old.section}"`);
    console.log(`  NEW: Subject ${c.new.subject_id} | Ch ${c.new.chapter_id} | Section: "${c.new.section}"\n`);
  }

  // Save report
  fs.writeFileSync(
    path.join(__dirname, "reclassification-report.json"),
    JSON.stringify({
      totalProcessed,
      changeStats,
      plannedChanges: plannedChanges.slice(0, 200),
    }, null, 2)
  );
  console.log("Detailed report saved to scripts/reclassification-report.json");

  // If apply mode, execute changes inside a transaction
  if (isApply && plannedChanges.length > 0) {
    console.log("\nApplying corrections to the database inside a transaction...");
    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      const updateSql = `
        UPDATE questions
        SET subject_id = $1,
            chapter_id = $2,
            topic_id = $3,
            section = $4,
            updated_at = NOW()
        WHERE id = $5;
      `;

      let appliedCount = 0;
      for (const item of plannedChanges) {
        await client.query(updateSql, [
          item.new.subject_id,
          item.new.chapter_id,
          item.new.topic_id,
          item.new.section,
          item.id,
        ]);
        appliedCount++;
        if (appliedCount % 200 === 0 || appliedCount === plannedChanges.length) {
          process.stdout.write(`Applied ${appliedCount}/${plannedChanges.length} updates...\r`);
        }
      }

      await client.query("COMMIT;");
      console.log(`\n\n✅ SUCCESS! All ${appliedCount} questions have been reclassified and taxonomy-aligned.`);
    } catch (e) {
      await client.query("ROLLBACK;");
      console.error("\n❌ Transaction failed! Rolled back all changes.", e);
    } finally {
      client.release();
    }
  } else if (!isApply) {
    console.log("\n[DRY RUN COMPLETE] To apply these updates to the database, run with `--apply`.");
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

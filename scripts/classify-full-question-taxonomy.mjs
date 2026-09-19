import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Load full taxonomy map
const taxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, "full-taxonomy.json"), "utf8"));

// Pre-index taxonomy
const subjectsById = {};
for (const s of taxonomy.subjects) subjectsById[s.id] = s;

const chaptersById = {};
for (const c of taxonomy.chapters) chaptersById[c.id] = c;

const topicsById = {};
for (const t of taxonomy.topics) topicsById[t.id] = t;

const subtopicsById = {};
for (const st of taxonomy.subtopics) subtopicsById[st.id] = st;

const chaptersBySubject = {};
for (const ch of taxonomy.chapters) {
  if (!chaptersBySubject[ch.subject_id]) chaptersBySubject[ch.subject_id] = [];
  chaptersBySubject[ch.subject_id].push(ch);
}

const topicsByChapter = {};
for (const top of taxonomy.topics) {
  if (!topicsByChapter[top.chapter_id]) topicsByChapter[top.chapter_id] = [];
  topicsByChapter[top.chapter_id].push(top);
}

const subtopicsByTopic = {};
for (const sub of taxonomy.subtopics) {
  if (!subtopicsByTopic[sub.topic_id]) subtopicsByTopic[sub.topic_id] = [];
  subtopicsByTopic[sub.topic_id].push(sub);
}

// Clean HTML & special chars
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
    .replace(/\s+/g, " ")
    .trim();
}

// Canonical Chapter/Topic map
const CANONICAL_MAP = {
  // 1: REASONING
  1: {
    analogy: { chap: 5, top: 9 },
    coding_decoding: { chap: 6, top: 10 },
    classification: { chap: 96, top: 47 },
    number_series: { chap: 76, top: 3223 },
    series: { chap: 7, top: 11 },
    blood_relations: { chap: 97, top: 48 },
    direction_sense: { chap: 98, top: 49 },
    seating_arrangement: { chap: 99, top: 50 },
    puzzle: { chap: 575, top: 766 },
    syllogism: { chap: 74, top: 24 },
    logical_venn: { chap: 75, top: 25 },
    mirror_water_image: { chap: 78, top: 3224 },
    paper_cutting: { chap: 79, top: 32 },
    cube_dice: { chap: 586, top: 777 },
    mathematical_operations: { chap: 588, top: 779 },
    ranking_order: { chap: 567, top: 758 },
    data_sufficiency: { chap: 576, top: 767 },
    non_verbal: { chap: 100, top: 53 },
    alphabet_test: { chap: 568, top: 759 },
    statement_assumption: { chap: 574, top: 765 },
    general: { chap: 526, top: 717 }
  },
  // 2: QUANT
  2: {
    number_system: { chap: 280, top: 725 },
    lcm_hcf: { chap: 281, top: 726 },
    simplification: { chap: 282, top: 727 },
    surds_indices: { chap: 283, top: 728 },
    percentage: { chap: 288, top: 733 },
    profit_loss: { chap: 289, top: 734 },
    discount: { chap: 290, top: 735 },
    simple_interest: { chap: 291, top: 736 },
    compound_interest: { chap: 292, top: 737 },
    ratio_proportion: { chap: 286, top: 731 },
    mixture_alligation: { chap: 287, top: 732 },
    average: { chap: 285, top: 730 },
    time_work: { chap: 293, top: 738 },
    pipe_cistern: { chap: 294, top: 739 },
    time_distance: { chap: 295, top: 740 },
    boat_stream: { chap: 296, top: 741 },
    algebra: { chap: 297, top: 742 },
    trigonometry: { chap: 298, top: 743 },
    geometry: { chap: 299, top: 744 },
    mensuration: { chap: 300, top: 745 },
    data_interpretation: { chap: 301, top: 746 },
    statistics_probability: { chap: 302, top: 747 },
    general: { chap: 303, top: 748 }
  },
  // 3: ENGLISH
  3: {
    vocabulary: { chap: 8, top: 12 },
    error_detection: { chap: 109, top: 56 },
    parts_of_speech: { chap: 591, top: 782 },
    active_passive: { chap: 82, top: 35 },
    direct_indirect: { chap: 83, top: 36 },
    idioms_phrases: { chap: 85, top: 38 },
    one_word: { chap: 598, top: 3235 },
    fill_blanks: { chap: 605, top: 796 },
    comprehension: { chap: 10, top: 14 },
    sentence_rearrangement: { chap: 606, top: 797 },
    spelling: { chap: 599, top: 790 },
    general: { chap: 9, top: 13 }
  },
  // 4: HISTORY
  4: {
    harappan: { chap: 59, top: 61 },
    vedic: { chap: 61, top: 63 },
    delhi_sultanate: { chap: 64, top: 66 },
    mughals: { chap: 62, top: 64 },
    revolt_1857: { chap: 65, top: 67 },
    gandhian_era: { chap: 63, top: 3222 },
    general: { chap: 12, top: 16 }
  },
  // 5: POLITY
  5: {
    preamble: { chap: 69, top: 71 },
    fundamental_rights: { chap: 167, top: 172 },
    parliament: { chap: 70, top: 72 },
    amendments: { chap: 709, top: 3166 },
    judiciary: { chap: 737, top: 2445 },
    local_government: { chap: 701, top: 2372 },
    general: { chap: 698, top: 3189 }
  },
  // 6: GEOGRAPHY
  6: {
    drainage: { chap: 132, top: 178 },
    agriculture: { chap: 135, top: 181 },
    physical: { chap: 146, top: 196 },
    indian_geography: { chap: 147, top: 197 },
    general: { chap: 663, top: 2252 }
  },
  // 7: ECONOMY
  7: {
    basic: { chap: 171, top: 221 },
    banking: { chap: 173, top: 223 },
    budget: { chap: 174, top: 224 },
    national_income: { chap: 778, top: 2515 },
    general: { chap: 172, top: 222 }
  },
  // 8: PHYSICS
  8: {
    units: { chap: 86, top: 39 },
    motion: { chap: 71, top: 73 },
    work_energy: { chap: 87, top: 40 },
    optics: { chap: 110, top: 128 },
    heat: { chap: 111, top: 129 },
    electricity: { chap: 112, top: 130 },
    general: { chap: 110, top: 128 }
  },
  // 9: CHEMISTRY
  9: {
    atoms: { chap: 72, top: 74 },
    bonding: { chap: 116, top: 134 },
    acids_bases: { chap: 117, top: 135 },
    metals: { chap: 118, top: 136 },
    carbon: { chap: 119, top: 137 },
    reactions: { chap: 120, top: 138 },
    general: { chap: 72, top: 74 }
  },
  // 10: BIOLOGY
  10: {
    cell: { chap: 121, top: 139 },
    photosynthesis: { chap: 89, top: 3225 },
    human_body: { chap: 73, top: 75 },
    diseases: { chap: 124, top: 142 },
    genetics: { chap: 125, top: 143 },
    ecology: { chap: 126, top: 144 },
    general: { chap: 121, top: 139 }
  },
  // 11: STATIC GK
  11: {
    art_culture: { chap: 189, top: 239 },
    monuments: { chap: 190, top: 240 },
    books_awards: { chap: 192, top: 242 },
    sports: { chap: 872, top: 2824 },
    first_in_india: { chap: 878, top: 2842 },
    national_days: { chap: 874, top: 2830 },
    general: { chap: 883, top: 2857 }
  },
  // 12: CURRENT AFFAIRS
  12: {
    schemes: { chap: 901, top: 2911 },
    space_tech: { chap: 907, top: 2929 },
    sports_updates: { chap: 910, top: 2938 },
    national: { chap: 127, top: 145 },
    general: { chap: 912, top: 2944 }
  },
  // 13: COMPUTER KNOWLEDGE
  13: {
    input_output: { chap: 90, top: 43 },
    cpu_storage: { chap: 91, top: 44 },
    os: { chap: 92, top: 45 },
    software: { chap: 93, top: 46 },
    networking: { chap: 94, top: 3226 },
    general: { chap: 613, top: 804 }
  }
};

function getCanonicalTaxonomy(subjectId, subtype) {
  const subMap = CANONICAL_MAP[subjectId] || {};
  const target = subMap[subtype] || subMap["general"];
  if (target) return target;

  const chs = chaptersBySubject[subjectId] || [];
  if (chs.length > 0) {
    const ch = chs[0];
    const tops = topicsByChapter[ch.id] || [];
    return { chap: ch.id, top: tops[0]?.id || null };
  }
  return { chap: null, top: null };
}

// Full-question semantic classifier
function classifyQuestion(q) {
  const text = cleanText(q.question_text).toLowerCase();
  const expl = cleanText(q.explanation).toLowerCase();
  const full = `${text} ${expl}`;

  // ─────────────────────────────────────────
  // 1. HIGH-CONFIDENCE REASONING DETECTIONS
  // ─────────────────────────────────────────
  if ((text.includes("pointing to") || text.includes("introducing a") || (text.includes("how is") && text.includes("related to"))) &&
      (text.includes("father") || text.includes("mother") || text.includes("sister") || text.includes("brother") || text.includes("daughter") || text.includes("son") || text.includes("uncle") || text.includes("aunt") || text.includes("nephew") || text.includes("niece") || text.includes("wife") || text.includes("husband") || text.includes("paternal") || text.includes("maternal"))) {
    return { subject_id: 1, subtype: "blood_relations", reason: "Blood relation question" };
  }

  if ((text.includes("sitting around a") || text.includes("sitting in a circle") || text.includes("facing north") || text.includes("facing the center") || text.includes("seated in a row") || text.includes("sitting in a straight line") || text.includes("circular table")) &&
      (text.includes("immediate left") || text.includes("immediate right") || text.includes("third to the left") || text.includes("second to the right") || text.includes("between") || text.includes("opposite") || text.includes("extremes"))) {
    return { subject_id: 1, subtype: "seating_arrangement", reason: "Seating arrangement problem" };
  }

  if (text.includes("working together, all having different vehicles") || text.includes("floor puzzle") || text.includes("lives on an odd-numbered floor") || (text.includes("five friends") && text.includes("different"))) {
    return { subject_id: 1, subtype: "puzzle", reason: "Logic puzzle" };
  }

  if ((text.includes("in a certain code") || text.includes("code language") || text.includes("is written as") || text.includes("is coded as")) &&
      (text.includes("how will") || text.includes("how is") || text.includes("what is the code") || text.includes("code for") || text.includes("then how is") || text.includes("then what will be the code"))) {
    return { subject_id: 1, subtype: "coding_decoding", reason: "Coding-decoding problem" };
  }

  if ((text.includes("statements:") || text.includes("statement:") || text.includes("कथन:")) && 
      (text.includes("conclusions:") || text.includes("conclusion:") || text.includes("निष्कर्ष:")) && 
      (text.includes("all ") || text.includes("some ") || text.includes("no ") || text.includes("सभी ") || text.includes("कुछ ")) &&
      (text.includes("logically follow") || text.includes("तार्किक रूप से"))) {
    return { subject_id: 1, subtype: "syllogism", reason: "Syllogism deduction" };
  }

  if ((text.includes("venn diagram") || text.includes("वेन आरेख")) && 
      (text.includes("represents") || text.includes("relationship") || text.includes("classes") || text.includes("triangles") || text.includes("circles"))) {
    return { subject_id: 1, subtype: "logical_venn", reason: "Venn diagram classification" };
  }

  if (text.includes("opposite to the face") || text.includes("opposite the face") || text.includes("two different positions of the same dice") || text.includes("three positions of the same dice") || text.includes("folded to form a cube") || text.includes("positions of a dice")) {
    return { subject_id: 1, subtype: "cube_dice", reason: "Cube and dice problem" };
  }

  if ((text.includes("walks") || text.includes("starts walking") || text.includes("drives") || text.includes("travels")) &&
      (text.includes("turns left") || text.includes("turns right") || text.includes("towards north") || text.includes("towards east") || text.includes("towards south") || text.includes("towards west")) &&
      (text.includes("in which direction") || text.includes("how far") || text.includes("starting point"))) {
    return { subject_id: 1, subtype: "direction_sense", reason: "Direction sense problem" };
  }

  if ((text.includes("if '+' means") || text.includes("if '+' stands for") || text.includes("interchanging the signs") || text.includes("which two signs should be interchanged")) && (text.includes("equation") || text.includes("correct"))) {
    return { subject_id: 1, subtype: "mathematical_operations", reason: "Mathematical operations substitution" };
  }

  if (text.includes("complete figure x") || text.includes("embedded figure") || text.includes("figure that will replace the question mark") || text.includes("paper is folded and cut")) {
    return { subject_id: 1, subtype: "non_verbal", reason: "Non-verbal reasoning figure" };
  }

  if ((text.includes("replace the question mark (?) in the following series") || text.includes("what should come in place of '?' in the given series") || text.includes("wrong number in the following series") || text.includes("next term in the series")) && !text.includes("sum of the series")) {
    return { subject_id: 1, subtype: "number_series", reason: "Number/Letter series" };
  }

  if ((text.includes("select the option that is related to the third") || text.includes("select the set in which the numbers are related") || text.includes("select the related word/letters/number")) && 
      (text.includes("same way as") || text.includes("in the same way"))) {
    return { subject_id: 1, subtype: "analogy", reason: "Analogy/Classification" };
  }

  // ─────────────────────────────────────────
  // 2. HIGH-CONFIDENCE QUANTITATIVE DETECTIONS
  // ─────────────────────────────────────────
  if (text.startsWith("compute (") || text.startsWith("compute of ") || text.startsWith("the value of 0.") || text.includes("find the value of:") || text.includes("simplify the following expression") || text.includes("simplify: 7")) {
    return { subject_id: 2, subtype: "simplification", reason: "Arithmetic computation" };
  }

  if ((text.includes("least common multiple") || text.includes("highest common factor") || text.includes("lcm of") || text.includes("hcf of") || text.includes("lcm and hcf")) && (text.includes("number") || text.includes("fractions") || text.includes("product"))) {
    return { subject_id: 2, subtype: "lcm_hcf", reason: "LCM and HCF math problem" };
  }

  if ((text.includes("pipe a") || text.includes("pipe b") || text.includes("pipes a and b") || text.includes("inlet pipe") || text.includes("outlet pipe")) && (text.includes("cistern") || text.includes("tank") || text.includes("fill"))) {
    return { subject_id: 2, subtype: "pipe_cistern", reason: "Pipes and cistern problem" };
  }

  if ((text.includes("can do a piece of work") || text.includes("can complete a work") || text.includes("working together")) && (text.includes("days") || text.includes("efficiency"))) {
    return { subject_id: 2, subtype: "time_work", reason: "Time and work problem" };
  }

  if ((text.includes("cost price") || text.includes("selling price") || text.includes("marked price") || text.includes("sold it at a loss") || text.includes("sold it at a profit") || text.includes("profit percentage") || text.includes("single discount equivalent")) && !text.includes("constitution")) {
    return { subject_id: 2, subtype: "profit_loss", reason: "Profit, loss and discount" };
  }

  if (text.includes("simple interest") || text.includes("compound interest") || text.includes("compounded annually") || text.includes("compounded half-yearly")) {
    return { subject_id: 2, subtype: text.includes("compound") ? "compound_interest" : "simple_interest", reason: "Interest calculation" };
  }

  if (text.includes("right circular cone") || text.includes("hemispherical tank") || text.includes("volume of the cone") || text.includes("volume of the cylinder") || text.includes("radius of the sphere") || text.includes("slant height") || text.includes("total surface area") || text.includes("ring-shaped disc has outer radius")) {
    return { subject_id: 2, subtype: "mensuration", reason: "Mensuration 2D/3D geometry" };
  }

  if (text.includes("speed of the train") || text.includes("train running at") || text.includes("crosses a platform") || text.includes("crosses a pole") || (text.includes("upstream") && text.includes("downstream"))) {
    return { subject_id: 2, subtype: text.includes("upstream") ? "boat_stream" : "time_distance", reason: "Time, speed, distance and boats" };
  }

  // ─────────────────────────────────────────
  // 3. HIGH-CONFIDENCE SCIENCE & GS DETECTIONS
  // ─────────────────────────────────────────
  if (text.includes("refraction") || text.includes("convex lens") || text.includes("concave mirror") || text.includes("focal length") || (text.includes("inverted image") && text.includes("lens"))) {
    return { subject_id: 8, subtype: "optics", reason: "Physics Optics" };
  }

  if (text.includes("kinetic energy") || text.includes("potential energy") || text.includes("work done") || text.includes("newton's second law") || text.includes("x rays which are now used") || text.includes("mass and weight")) {
    return { subject_id: 8, subtype: "work_energy", reason: "Physics Mechanics" };
  }

  if (text.includes("dry ice") || text.includes("esters have") || text.includes("periodic table") || text.includes("atomic number") || text.includes("chemical formula") || text.includes("acids and bases")) {
    return { subject_id: 9, subtype: "acids_bases", reason: "Chemistry" };
  }

  if (text.includes("birth control pills") || text.includes("monoecious") || text.includes("mitochondria") || text.includes("photosynthesis") || text.includes("chlorophyll") || text.includes("digestive enzyme") || text.includes("deficiency of vitamin")) {
    return { subject_id: 10, subtype: "human_body", reason: "Biology" };
  }

  if (text.includes("fundamental duties") || text.includes("article 51a") || text.includes("article 14") || text.includes("article 21") || text.includes("article 32") || text.includes("writ jurisdiction") || text.includes("constituent assembly") || text.includes("preamble") || text.includes("74th amendment") || text.includes("73rd amendment") || text.includes("part ix-a") || text.includes("salaries and allowances of members of parliament")) {
    return { subject_id: 5, subtype: text.includes("amendment") ? "amendments" : text.includes("article 51a") || text.includes("fundamental duties") ? "fundamental_rights" : "general", reason: "Polity and Constitution" };
  }

  if (text.includes("qutub-ud-din aibak") || text.includes("slave dynasty") || text.includes("battle of talikota") || text.includes("harappan") || text.includes("indus valley") || text.includes("rana sanga") || text.includes("jihad against rana sanga") || text.includes("nana sahib") || text.includes("revolt of 1857") || text.includes("dholavira") || text.includes("bahishkrit hitakarini") || text.includes("battle of plassey")) {
    return { subject_id: 4, subtype: text.includes("harappan") || text.includes("dholavira") ? "harappan" : text.includes("slave dynasty") ? "delhi_sultanate" : text.includes("1857") ? "revolt_1857" : "general", reason: "History" };
  }

  if (text.includes("glacial landforms") || text.includes("cotton cultivation in india") || text.includes("type of soil") || text.includes("hanging valleys") || text.includes("tributary of river") || text.includes("cheruthoni dam") || text.includes("rabi crops") || text.includes("earth's crust via")) {
    return { subject_id: 6, subtype: text.includes("soil") || text.includes("dam") ? "indian_geography" : text.includes("rabi") ? "agriculture" : "physical", reason: "Geography" };
  }

  if (text.includes("multidimensional poverty index") || text.includes("operation twist is a monetary policy") || text.includes("fiscal deficit") || text.includes("gross domestic product") || text.includes("reserve bank of india")) {
    return { subject_id: 7, subtype: "basic", reason: "Economy" };
  }

  if (text.includes("pm e-drive") || text.includes("pm-yuva") || text.includes("one nation one subscription") || text.includes("un80 initiative") || text.includes("in 2024") || text.includes("in 2025") || text.includes("in 2026") || text.includes("glowcas9") || text.includes("sslv-d2") || text.includes("national mission on natural farming")) {
    return { subject_id: 12, subtype: text.includes("pm") || text.includes("initiative") ? "schemes" : "general", reason: "Current Affairs" };
  }

  if (text.includes("kalbelia dance") || text.includes("sultan johor cup") || text.includes("kalamandalam") || text.includes("sangeet natak") || text.includes("international kite festival") || text.includes("dhyan chand khel ratna") || text.includes("first female president of africa") || text.includes("first gasoline-run car engine")) {
    return { subject_id: 11, subtype: text.includes("dance") ? "art_culture" : text.includes("cup") ? "sports" : "general", reason: "Static GK" };
  }

  if (text.includes("select the option that contains a grammatical error") || text.includes("sentence has been divided into parts") || text.includes("passive voice") || text.includes("indirect speech") || text.includes("most appropriate synonym") || text.includes("most appropriate antonym") || text.includes("select the correctly spelt word") || text.includes("provided in direct speech")) {
    return { subject_id: 3, subtype: "error_detection", reason: "English Language" };
  }

  // ─────────────────────────────────────────
  // 4. SUBJECT-INTERNAL CHAPTER REFINEMENTS
  // ─────────────────────────────────────────
  // If subject is Reasoning (1), fix chapter dump-bucket issues (e.g. Analogy / Embedded Figures)
  if (q.subject_id === 1) {
    if (text.includes("dice") || text.includes("cube")) return { subject_id: 1, subtype: "cube_dice", reason: "Dice in wrong reasoning chapter" };
    if (text.includes("code") && text.includes("written as")) return { subject_id: 1, subtype: "coding_decoding", reason: "Coding in wrong reasoning chapter" };
    if (text.includes("photograph") || text.includes("related to")) return { subject_id: 1, subtype: "blood_relations", reason: "Blood relation in wrong reasoning chapter" };
    if (text.includes("sitting") && (text.includes("left") || text.includes("right"))) return { subject_id: 1, subtype: "seating_arrangement", reason: "Seating in wrong reasoning chapter" };
    if (text.includes("conclusions:") && text.includes("logically follow")) return { subject_id: 1, subtype: "syllogism", reason: "Syllogism in wrong reasoning chapter" };
    if (text.includes("venn diagram")) return { subject_id: 1, subtype: "logical_venn", reason: "Venn diagram in wrong reasoning chapter" };
  }

  // If subject is Quant (2), fix Surds/Indices dump bucket (Chapter 283)
  if (q.subject_id === 2 && q.chapter_id === 283) {
    if (text.includes("lcm") || text.includes("hcf") || text.includes("least common multiple") || text.includes("highest common factor")) {
      return { subject_id: 2, subtype: "lcm_hcf", reason: "LCM/HCF dumped in Surds" };
    }
    if (text.includes("cone") || text.includes("cylinder") || text.includes("sphere") || text.includes("volume") || text.includes("surface area")) {
      return { subject_id: 2, subtype: "mensuration", reason: "Mensuration dumped in Surds" };
    }
  }

  // If subject is History (4), fix Gandhian Era dump bucket (Chapter 63)
  if (q.subject_id === 4 && q.chapter_id === 63) {
    if (text.includes("harappan") || text.includes("citadel") || text.includes("indus valley") || text.includes("great bath") || text.includes("copper from")) {
      return { subject_id: 4, subtype: "harappan", reason: "Harappan civilization dumped in Gandhian Era" };
    }
    if (text.includes("nana sahib") || text.includes("revolt of 1857")) {
      return { subject_id: 4, subtype: "revolt_1857", reason: "1857 Revolt dumped in Gandhian Era" };
    }
  }

  // Retain current subject
  return { subject_id: q.subject_id, subtype: null, reason: "Retain current classification" };
}

async function execute() {
  console.log("=== EXECUTING COMPLETE QUESTION RECLASSIFICATION & TAXONOMY ALIGNMENT ===");

  const BATCH_SIZE = 2000;
  let offset = 0;
  let totalProcessed = 0;
  let totalChanges = 0;
  let crossSubjectFixes = 0;
  let subtopicMismatchFixes = 0;
  let topicMismatchFixes = 0;
  let chapterDumpFixes = 0;

  const sampleChanges = [];

  while (true) {
    const batch = await pool.query(`
      SELECT q.id, q.test_id, q.question_number, q.section,
             q.subject_id, q.chapter_id, q.topic_id, q.subtopic_id,
             q.question_text, q.explanation, q.options
      FROM questions q
      ORDER BY q.id
      LIMIT $1 OFFSET $2;
    `, [BATCH_SIZE, offset]);

    if (batch.rows.length === 0) break;

    const updates = [];

    for (const q of batch.rows) {
      totalProcessed++;
      const res = classifyQuestion(q);

      let newSubjectId = res.subject_id;
      let newChapterId = q.chapter_id;
      let newTopicId = q.topic_id;
      let newSubtopicId = q.subtopic_id;
      let changed = false;
      let changeType = "";

      // 1. Subject changed
      if (newSubjectId !== q.subject_id) {
        const canTax = getCanonicalTaxonomy(newSubjectId, res.subtype);
        newChapterId = canTax.chap;
        newTopicId = canTax.top;
        const subs = subtopicsByTopic[newTopicId] || [];
        newSubtopicId = subs[0]?.id || null;
        changed = true;
        changeType = `Subject changed: ${q.subject_id} -> ${newSubjectId} (${res.reason})`;
        crossSubjectFixes++;
      }
      // 2. Subtype refinement within same subject (e.g. dump bucket in Surds, Analogy, Gandhian Era)
      else if (res.subtype !== null) {
        const canTax = getCanonicalTaxonomy(newSubjectId, res.subtype);
        if (canTax.chap && canTax.chap !== q.chapter_id) {
          newChapterId = canTax.chap;
          newTopicId = canTax.top;
          const subs = subtopicsByTopic[newTopicId] || [];
          newSubtopicId = subs[0]?.id || null;
          changed = true;
          changeType = `Chapter refined: ${q.chapter_id} -> ${newChapterId} (${res.reason})`;
          chapterDumpFixes++;
        }
      }

      // 3. Enforce Chapter belongs to Subject
      const chapObj = chaptersById[newChapterId];
      if (!chapObj || chapObj.subject_id !== newSubjectId) {
        const chs = chaptersBySubject[newSubjectId] || [];
        newChapterId = chs[0]?.id || null;
        const tops = topicsByChapter[newChapterId] || [];
        newTopicId = tops[0]?.id || null;
        const subs = subtopicsByTopic[newTopicId] || [];
        newSubtopicId = subs[0]?.id || null;
        changed = true;
        changeType = changeType || "Fixed chapter-subject mismatch";
      }

      // 4. Enforce Topic belongs to Chapter
      const topObj = topicsById[newTopicId];
      if (!topObj || topObj.chapter_id !== newChapterId) {
        const tops = topicsByChapter[newChapterId] || [];
        newTopicId = tops[0]?.id || null;
        const subs = subtopicsByTopic[newTopicId] || [];
        newSubtopicId = subs[0]?.id || null;
        changed = true;
        changeType = changeType || "Fixed topic-chapter mismatch";
        topicMismatchFixes++;
      }

      // 5. Enforce Subtopic belongs to Topic (Fixes the 2,667 cross-subject subtopic links)
      const subObj = subtopicsById[newSubtopicId];
      if (!subObj || subObj.topic_id !== newTopicId) {
        const subs = subtopicsByTopic[newTopicId] || [];
        newSubtopicId = subs[0]?.id || null;
        changed = true;
        changeType = changeType || "Fixed subtopic-topic cross-link";
        subtopicMismatchFixes++;
      }

      if (changed) {
        totalChanges++;
        const subjName = subjectsById[newSubjectId]?.name || null;
        const chapTitle = chaptersById[newChapterId]?.title || null;
        const topName = topicsById[newTopicId]?.name || null;

        updates.push({
          id: q.id,
          subject_id: newSubjectId,
          chapter_id: newChapterId,
          topic_id: newTopicId,
          subtopic_id: newSubtopicId,
          subject: newSubjectId,
          chapter: chapTitle,
          topic: topName,
          changeType
        });

        if (sampleChanges.length < 50) {
          sampleChanges.push({
            id: q.id,
            test_id: q.test_id,
            q_num: q.question_number,
            changeType,
            old: { sub: q.subject_id, ch: q.chapter_id, top: q.topic_id, subtop: q.subtopic_id },
            new: { sub: newSubjectId, ch: newChapterId, top: newTopicId, subtop: newSubtopicId },
            snippet: cleanText(q.question_text).slice(0, 80)
          });
        }
      }
    }

    // Apply batch updates
    if (updates.length > 0) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const u of updates) {
          await client.query(`
            UPDATE questions
            SET 
              subject_id = $1,
              chapter_id = $2,
              topic_id = $3,
              subtopic_id = $4,
              subject = $5,
              chapter = $6,
              topic = $7,
              updated_at = NOW()
            WHERE id = $8;
          `, [
            u.subject_id,
            u.chapter_id,
            u.topic_id,
            u.subtopic_id,
            u.subject,
            u.chapter,
            u.topic,
            u.id
          ]);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
      client.release();
    }

    offset += BATCH_SIZE;
    console.log(`Processed ${totalProcessed} / 45,178 questions (Updated ${totalChanges} so far)...`);
  }

  console.log("\n=== EXECUTION SUMMARY ===");
  console.log(`Total questions processed: ${totalProcessed}`);
  console.log(`Total questions updated: ${totalChanges}`);
  console.log(`- Cross-subject corrections: ${crossSubjectFixes}`);
  console.log(`- Chapter dump-bucket refinements: ${chapterDumpFixes}`);
  console.log(`- Topic-chapter hierarchy fixes: ${topicMismatchFixes}`);
  console.log(`- Subtopic cross-link & alignment fixes: ${subtopicMismatchFixes}`);

  fs.writeFileSync(
    path.join(__dirname, "full-classification-execution-report.json"),
    JSON.stringify({
      totalProcessed,
      totalChanges,
      crossSubjectFixes,
      chapterDumpFixes,
      topicMismatchFixes,
      subtopicMismatchFixes,
      sampleChanges
    }, null, 2)
  );
  console.log("Saved execution report to scripts/full-classification-execution-report.json");

  await pool.end();
}

execute().catch(console.error);

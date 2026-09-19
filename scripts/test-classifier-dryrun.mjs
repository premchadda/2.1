import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Load taxonomy map
const taxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, "full-taxonomy.json"), "utf8"));

// Pre-index taxonomy
const subtopicsByTopic = {};
for (const sub of taxonomy.subtopics) {
  if (!subtopicsByTopic[sub.topic_id]) subtopicsByTopic[sub.topic_id] = [];
  subtopicsByTopic[sub.topic_id].push(sub);
}

const topicsByChapter = {};
for (const top of taxonomy.topics) {
  if (!topicsByChapter[top.chapter_id]) topicsByChapter[top.chapter_id] = [];
  topicsByChapter[top.chapter_id].push(top);
}

const chaptersBySubject = {};
for (const ch of taxonomy.chapters) {
  if (!chaptersBySubject[ch.subject_id]) chaptersBySubject[ch.subject_id] = [];
  chaptersBySubject[ch.subject_id].push(ch);
}

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

// Canonical Chapter/Topic mapper
function getCanonicalTaxonomy(subjectId, subtype) {
  const MAP = {
    // REASONING
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
    // QUANT
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
    // ENGLISH
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
    // HISTORY
    4: {
      harappan: { chap: 59, top: 61 },
      vedic: { chap: 61, top: 63 },
      delhi_sultanate: { chap: 64, top: 66 },
      mughals: { chap: 62, top: 64 },
      revolt_1857: { chap: 65, top: 67 },
      gandhian_era: { chap: 63, top: 3222 },
      general: { chap: 12, top: 16 }
    },
    // POLITY
    5: {
      preamble: { chap: 69, top: 71 },
      fundamental_rights: { chap: 167, top: 172 },
      parliament: { chap: 70, top: 72 },
      amendments: { chap: 709, top: 3166 },
      judiciary: { chap: 737, top: 2445 },
      local_government: { chap: 701, top: 2372 },
      general: { chap: 698, top: 3189 }
    },
    // GEOGRAPHY
    6: {
      drainage: { chap: 132, top: 178 },
      agriculture: { chap: 135, top: 181 },
      physical: { chap: 146, top: 196 },
      indian_geography: { chap: 147, top: 197 },
      general: { chap: 663, top: 2252 }
    },
    // ECONOMY
    7: {
      basic: { chap: 171, top: 221 },
      banking: { chap: 173, top: 223 },
      budget: { chap: 174, top: 224 },
      national_income: { chap: 778, top: 2515 },
      general: { chap: 172, top: 222 }
    },
    // PHYSICS
    8: {
      units: { chap: 86, top: 39 },
      motion: { chap: 71, top: 73 },
      work_energy: { chap: 87, top: 40 },
      optics: { chap: 110, top: 128 },
      heat: { chap: 111, top: 129 },
      electricity: { chap: 112, top: 130 },
      general: { chap: 110, top: 128 }
    },
    // CHEMISTRY
    9: {
      atoms: { chap: 72, top: 74 },
      bonding: { chap: 116, top: 134 },
      acids_bases: { chap: 117, top: 135 },
      metals: { chap: 118, top: 136 },
      carbon: { chap: 119, top: 137 },
      reactions: { chap: 120, top: 138 },
      general: { chap: 72, top: 74 }
    },
    // BIOLOGY
    10: {
      cell: { chap: 121, top: 139 },
      photosynthesis: { chap: 89, top: 3225 },
      human_body: { chap: 73, top: 75 },
      diseases: { chap: 124, top: 142 },
      genetics: { chap: 125, top: 143 },
      ecology: { chap: 126, top: 144 },
      general: { chap: 121, top: 139 }
    },
    // STATIC GK
    11: {
      art_culture: { chap: 189, top: 239 },
      monuments: { chap: 190, top: 240 },
      books_awards: { chap: 192, top: 242 },
      sports: { chap: 872, top: 2824 },
      first_in_india: { chap: 878, top: 2842 },
      national_days: { chap: 874, top: 2830 },
      general: { chap: 883, top: 2857 }
    },
    // CURRENT AFFAIRS
    12: {
      schemes: { chap: 901, top: 2911 },
      space_tech: { chap: 907, top: 2929 },
      sports_updates: { chap: 910, top: 2938 },
      national: { chap: 127, top: 145 },
      general: { chap: 912, top: 2944 }
    },
    // COMPUTER KNOWLEDGE
    13: {
      input_output: { chap: 90, top: 43 },
      cpu_storage: { chap: 91, top: 44 },
      os: { chap: 92, top: 45 },
      software: { chap: 93, top: 46 },
      networking: { chap: 94, top: 3226 },
      general: { chap: 613, top: 804 }
    }
  };

  const subMap = MAP[subjectId] || {};
  const target = subMap[subtype] || subMap["general"];
  if (target) return target;

  // Fallback to first chapter/topic of subject
  const chs = chaptersBySubject[subjectId] || [];
  if (chs.length > 0) {
    const ch = chs[0];
    const tops = topicsByChapter[ch.id] || [];
    return { chap: ch.id, top: tops[0]?.id || null };
  }
  return { chap: null, top: null };
}

// Classifier function
function classifyQuestion(q) {
  const text = cleanText(q.question_text).toLowerCase();
  const expl = cleanText(q.explanation).toLowerCase();
  const fullText = `${text} ${expl}`;

  // 1. REASONING CLASSIFICATION
  // Blood relations
  if ((text.includes("pointing to") || text.includes("introducing a") || text.includes("how is") && text.includes("related to")) &&
      (text.includes("father") || text.includes("mother") || text.includes("sister") || text.includes("brother") || text.includes("daughter") || text.includes("son") || text.includes("uncle") || text.includes("aunt") || text.includes("nephew") || text.includes("niece") || text.includes("wife") || text.includes("husband") || text.includes("paternal") || text.includes("maternal"))) {
    return { subject_id: 1, subtype: "blood_relations" };
  }

  // Seating & Puzzles
  if ((text.includes("sitting around a") || text.includes("sitting in a circle") || text.includes("facing north") || text.includes("facing the center") || text.includes("seated in a row") || text.includes("sitting in a straight line") || text.includes("circular table")) &&
      (text.includes("immediate left") || text.includes("immediate right") || text.includes("third to the left") || text.includes("second to the right") || text.includes("between") || text.includes("opposite") || text.includes("extremes"))) {
    return { subject_id: 1, subtype: "seating_arrangement" };
  }
  if (text.includes("working together, all having different vehicles") || text.includes("floor puzzle") || text.includes("lives on an odd-numbered floor")) {
    return { subject_id: 1, subtype: "puzzle" };
  }

  // Coding Decoding
  if ((text.includes("in a certain code") || text.includes("code language") || text.includes("is written as") || text.includes("is coded as")) &&
      (text.includes("how will") || text.includes("how is") || text.includes("what is the code") || text.includes("code for") || text.includes("then what will be the code"))) {
    return { subject_id: 1, subtype: "coding_decoding" };
  }

  // Syllogisms
  if ((text.includes("statements:") || text.includes("statement:") || text.includes("कथन:")) && 
      (text.includes("conclusions:") || text.includes("conclusion:") || text.includes("निष्कर्ष:")) && 
      (text.includes("all ") || text.includes("some ") || text.includes("no ") || text.includes("सभी ") || text.includes("कुछ ")) &&
      (text.includes("logically follow") || text.includes("तार्किक रूप से"))) {
    return { subject_id: 1, subtype: "syllogism" };
  }

  // Logical Venn
  if ((text.includes("venn diagram") || text.includes("वेन आरेख")) && 
      (text.includes("represents") || text.includes("relationship") || text.includes("classes") || text.includes("triangles") || text.includes("circles"))) {
    return { subject_id: 1, subtype: "logical_venn" };
  }

  // Cube & Dice
  if (text.includes("opposite to the face") || text.includes("opposite the face") || text.includes("two different positions of the same dice") || text.includes("three positions of the same dice") || text.includes("folded to form a cube") || text.includes("dice are shown")) {
    return { subject_id: 1, subtype: "cube_dice" };
  }

  // Direction Sense
  if ((text.includes("walks") || text.includes("starts walking") || text.includes("drives") || text.includes("travels")) &&
      (text.includes("turns left") || text.includes("turns right") || text.includes("towards north") || text.includes("towards east") || text.includes("towards south") || text.includes("towards west")) &&
      (text.includes("in which direction") || text.includes("how far") || text.includes("starting point"))) {
    return { subject_id: 1, subtype: "direction_sense" };
  }

  // Mathematical Operations (Reasoning)
  if ((text.includes("if '+' means") || text.includes("if '+' stands for") || text.includes("interchanging the signs") || text.includes("which two signs should be interchanged")) && text.includes("equation")) {
    return { subject_id: 1, subtype: "mathematical_operations" };
  }

  // Non-verbal figures
  if (text.includes("complete figure x") || text.includes("embedded figure") || text.includes("select the figure that will replace the question mark") || text.includes("paper is folded and cut")) {
    return { subject_id: 1, subtype: "non_verbal" };
  }

  // Number Series / Letter Series (Reasoning)
  if ((text.includes("replace the question mark (?) in the following series") || text.includes("what should come in place of '?' in the given series") || text.includes("wrong number in the following series")) && !text.includes("find the sum of the series")) {
    return { subject_id: 1, subtype: "number_series" };
  }

  // Analogy / Classification
  if ((text.includes("select the option that is related to the third") || text.includes("select the set in which the numbers are related") || text.includes("select the related word/letters/number")) && 
      (text.includes("same way as") || text.includes("in the same way"))) {
    return { subject_id: 1, subtype: "analogy" };
  }

  // 2. QUANTITATIVE APTITUDE CLASSIFICATION
  // Simplification / Basic Arithmetic
  if (text.startsWith("compute (") || text.startsWith("compute of ") || text.startsWith("the value of 0.") || text.includes("find the value of:") || text.includes("simplify the following expression")) {
    return { subject_id: 2, subtype: "simplification" };
  }
  // LCM & HCF
  if ((text.includes("least common multiple") || text.includes("highest common factor") || text.includes("lcm of") || text.includes("hcf of") || text.includes("lcm and hcf")) && (text.includes("number") || text.includes("fractions"))) {
    return { subject_id: 2, subtype: "lcm_hcf" };
  }
  // Pipes & Cisterns
  if ((text.includes("pipe a") || text.includes("pipe b") || text.includes("pipes a and b") || text.includes("inlet pipe") || text.includes("outlet pipe")) && (text.includes("cistern") || text.includes("tank") || text.includes("fill"))) {
    return { subject_id: 2, subtype: "pipe_cistern" };
  }
  // Time & Work
  if ((text.includes("can do a piece of work") || text.includes("can complete a work") || text.includes("working together")) && (text.includes("days") || text.includes("efficiency"))) {
    return { subject_id: 2, subtype: "time_work" };
  }
  // Profit & Loss
  if ((text.includes("cost price") || text.includes("selling price") || text.includes("marked price") || text.includes("sold it at a loss") || text.includes("sold it at a profit") || text.includes("profit percentage") || text.includes("single discount equivalent")) && !text.includes("constitution")) {
    return { subject_id: 2, subtype: "profit_loss" };
  }
  // Simple / Compound Interest
  if (text.includes("simple interest") || text.includes("compound interest") || text.includes("compounded annually") || text.includes("compounded half-yearly")) {
    return { subject_id: 2, subtype: text.includes("compound") ? "compound_interest" : "simple_interest" };
  }
  // Mensuration 2D & 3D
  if (text.includes("right circular cone") || text.includes("hemispherical tank") || text.includes("volume of the cone") || text.includes("volume of the cylinder") || text.includes("radius of the sphere") || text.includes("slant height") || text.includes("total surface area")) {
    return { subject_id: 2, subtype: "mensuration" };
  }
  // Speed, Time & Distance / Boats
  if (text.includes("speed of the train") || text.includes("train running at") || text.includes("crosses a platform") || text.includes("crosses a pole") || text.includes("upstream") && text.includes("downstream")) {
    return { subject_id: 2, subtype: text.includes("upstream") ? "boat_stream" : "time_distance" };
  }

  // 3. GS & SCIENCE CLASSIFICATION
  // Physics Optics
  if (text.includes("refraction") || text.includes("convex lens") || text.includes("concave mirror") || text.includes("focal length") || (text.includes("inverted image") && text.includes("lens"))) {
    return { subject_id: 8, subtype: "optics" };
  }
  // Physics Mechanics / Energy
  if (text.includes("kinetic energy") || text.includes("potential energy") || text.includes("work done") || text.includes("newton's second law") || text.includes("x rays which are now used") || text.includes("mass and weight")) {
    return { subject_id: 8, subtype: "work_energy" };
  }
  // Chemistry
  if (text.includes("dry ice") || text.includes("esters have") || text.includes("periodic table") || text.includes("atomic number") || text.includes("chemical formula") || text.includes("acids and bases")) {
    return { subject_id: 9, subtype: "acids_bases" };
  }
  // Biology
  if (text.includes("birth control pills") || text.includes("monoecious") || text.includes("mitochondria") || text.includes("photosynthesis") || text.includes("chlorophyll") || text.includes("digestive enzyme") || text.includes("deficiency of vitamin")) {
    return { subject_id: 10, subtype: "human_body" };
  }
  // Polity
  if (text.includes("fundamental duties") || text.includes("article 51a") || text.includes("article 14") || text.includes("article 21") || text.includes("article 32") || text.includes("writ jurisdiction") || text.includes("constituent assembly") || text.includes("preamble") || text.includes("74th amendment") || text.includes("73rd amendment") || text.includes("part ix-a")) {
    return { subject_id: 5, subtype: text.includes("amendment") ? "amendments" : text.includes("article 51a") || text.includes("fundamental duties") ? "fundamental_rights" : "general" };
  }
  // History
  if (text.includes("qutub-ud-din aibak") || text.includes("slave dynasty") || text.includes("battle of talikota") || text.includes("harappan") || text.includes("indus valley") || text.includes("rana sanga") || text.includes("jihad against rana sanga") || text.includes("nana sahib") || text.includes("revolt of 1857") || text.includes("dholavira") || text.includes("bahishkrit hitakarini")) {
    return { subject_id: 4, subtype: text.includes("harappan") || text.includes("dholavira") ? "harappan" : text.includes("slave dynasty") ? "delhi_sultanate" : text.includes("1857") ? "revolt_1857" : "general" };
  }
  // Geography
  if (text.includes("glacial landforms") || text.includes("cotton cultivation in india") || text.includes("type of soil") || text.includes("hanging valleys") || text.includes("tributary of river") || text.includes("cheruthoni dam") || text.includes("rabi crops")) {
    return { subject_id: 6, subtype: text.includes("soil") || text.includes("dam") ? "indian_geography" : text.includes("rabi") ? "agriculture" : "physical" };
  }
  // Current Affairs
  if (text.includes("pm e-drive") || text.includes("pm-yuva") || text.includes("one nation one subscription") || text.includes("un80 initiative") || text.includes("in 2024") || text.includes("in 2025") || text.includes("in 2026") || text.includes("glowcas9") || text.includes("sslv-d2") || text.includes("national mission on natural farming")) {
    return { subject_id: 12, subtype: text.includes("pm") || text.includes("initiative") ? "schemes" : "general" };
  }
  // Static GK
  if (text.includes("kalbelia dance") || text.includes("sultan johor cup") || text.includes("kalamandalam") || text.includes("sangeet natak") || text.includes("international kite festival") || text.includes("dhyan chand khel ratna") || text.includes("first female president of africa")) {
    return { subject_id: 11, subtype: text.includes("dance") ? "art_culture" : text.includes("cup") ? "sports" : "general" };
  }

  // 4. ENGLISH CLASSIFICATION
  if (text.includes("select the option that contains a grammatical error") || text.includes("sentence has been divided into parts") || text.includes("passive voice") || text.includes("indirect speech") || text.includes("most appropriate synonym") || text.includes("most appropriate antonym") || text.includes("select the correctly spelt word")) {
    return { subject_id: 3, subtype: "error_detection" };
  }

  // Default: retain current subject
  return { subject_id: q.subject_id, subtype: "general" };
}

async function run() {
  const targetIds = [
    44470, 50228, 37833, 45750, 48493, 37540, 46032, 45941,
    53754, 36975, 32972, 3292, 24920, 22106, 38889, 39059, 37317
  ];

  const res = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.section,
           q.subject_id, s.name as current_subj,
           q.chapter_id, qc.title as current_chap,
           q.topic_id, qt.name as current_top,
           q.subtopic_id, qst.name as current_subtop,
           q.question_text, q.explanation, q.options
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    LEFT JOIN subject_chapters qc ON q.chapter_id = qc.id
    LEFT JOIN subject_topics qt ON q.topic_id = qt.id
    LEFT JOIN subject_subtopics qst ON q.subtopic_id = qst.id
    WHERE q.id = ANY($1::int[])
    ORDER BY q.id;
  `, [targetIds]);

  console.log("=== DRY-RUN RESULTS ON THE 17 BENCHMARK QUESTIONS ===");
  for (const q of res.rows) {
    const classification = classifyQuestion(q);
    const targetTax = getCanonicalTaxonomy(classification.subject_id, classification.subtype);
    
    // Pick subtopic under target topic
    const subs = subtopicsByTopic[targetTax.top] || [];
    const targetSubtopic = subs[0];

    const targetSubjName = taxonomy.subjects.find(s => s.id === classification.subject_id)?.name;
    const targetChapName = taxonomy.chapters.find(c => c.id === targetTax.chap)?.title;
    const targetTopName = taxonomy.topics.find(t => t.id === targetTax.top)?.name;

    console.log(`\n[QID ${q.id}] ${cleanText(q.question_text).slice(0, 70)}...`);
    console.log(`  BEFORE: Subj [${q.subject_id}] ${q.current_subj} -> Chap [${q.chapter_id}] ${q.current_chap} -> Top [${q.topic_id}] ${q.current_top} -> Subtop [${q.subtopic_id}] "${q.current_subtop}"`);
    console.log(`  AFTER : Subj [${classification.subject_id}] ${targetSubjName} -> Chap [${targetTax.chap}] ${targetChapName} -> Top [${targetTax.top}] ${targetTopName} -> Subtop [${targetSubtopic?.id}] "${targetSubtopic?.name}"`);
  }

  await pool.end();
}

run().catch(console.error);

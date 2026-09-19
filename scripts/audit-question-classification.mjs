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

// Helper to strip HTML tags and normalize text
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

// Check if text is Reasoning
function detectReasoning(text, optionsStr) {
  const t = text.toLowerCase();
  
  // 1. Syllogisms
  if (
    ((t.includes("statement") || t.includes("कथन")) && (t.includes("conclusion") || t.includes("निष्कर्ष"))) ||
    t.includes("logically follow") ||
    t.includes("तार्किक रूप से अनुसरण") ||
    t.includes("conclusions:") ||
    t.includes("statements:")
  ) {
    if (t.includes("all ") || t.includes("some ") || t.includes("no ") || t.includes("सभी ") || t.includes("कुछ ")) {
      return { match: true, pattern: "syllogism" };
    }
    if (t.includes("statement (i)") || t.includes("statement 1") || t.includes("कथन 1")) {
      return { match: true, pattern: "statement_conclusion" };
    }
  }

  // 2. Seating arrangement & Floor puzzle
  if (
    t.includes("sitting around a") ||
    t.includes("sitting in a straight line") ||
    t.includes("sitting in a row") ||
    t.includes("facing north") ||
    t.includes("facing south") ||
    t.includes("facing the centre") ||
    t.includes("circular table") ||
    t.includes("live on six different floors") ||
    t.includes("live on eight different floors") ||
    t.includes("एक सीधी रेखा में बैठे") ||
    t.includes("वृत्ताकार मेज के चारों ओर") ||
    t.includes("उत्तर की ओर मुख करके बैठे")
  ) {
    return { match: true, pattern: "seating_arrangement" };
  }

  // 3. Blood relations
  if (
    (t.includes("pointing to a") || t.includes("pointing towards a") || t.includes("तस्वीर की ओर इशारा") || t.includes("इशारा करते हुए")) &&
    (t.includes("said") || t.includes("says") || t.includes("कहा"))
  ) {
    return { match: true, pattern: "blood_relations_pointing" };
  }
  if (
    (t.includes("mother's only daughter") || t.includes("father's only son") || t.includes("brother of my father") || t.includes("sister of my mother")) ||
    (t.includes("is the brother of") && t.includes("is the father of")) ||
    (t.includes("is the sister of") && t.includes("is the mother of")) ||
    (t.includes("a + b means a is the father") || t.includes("a - b means a is the sister") || t.includes("a × b means a is the brother")) ||
    (t.includes("how is") && t.includes("related to") && (t.includes("uncle") || t.includes("nephew") || t.includes("niece") || t.includes("cousin") || t.includes("brother-in-law") || t.includes("sister-in-law") || t.includes("daughter-in-law") || t.includes("father-in-law") || t.includes("mother-in-law")))
  ) {
    return { match: true, pattern: "blood_relations" };
  }

  // 4. Direction Sense
  if (
    (t.includes("walks") || t.includes("travels") || t.includes("drives") || t.includes("चलता है") || t.includes("चलती है")) &&
    (t.includes("turns left") || t.includes("turns right") || t.includes("बाएं मुड़ता") || t.includes("दाएं मुड़ता")) &&
    (t.includes("north") || t.includes("south") || t.includes("east") || t.includes("west") || t.includes("उत्तर") || t.includes("दक्षिण") || t.includes("पूर्व") || t.includes("पश्चिम"))
  ) {
    return { match: true, pattern: "direction_sense" };
  }

  // 5. Coding-Decoding
  if (
    t.includes("in a certain code language") ||
    t.includes("in a code language") ||
    t.includes("एक निश्चित कूट भाषा में") ||
    t.includes("एक कूट भाषा में") ||
    (t.includes("coded as") && (t.includes("then how") || t.includes("written as"))) ||
    (t.includes("is written as") && (t.includes("how will") || t.includes("coded as"))) ||
    t.includes("के रूप में कूटबद्ध किया जाता है") ||
    t.includes("के रूप में लिखा जाता है")
  ) {
    return { match: true, pattern: "coding_decoding" };
  }

  // 6. Series & Analogies & Classification
  if (
    t.includes("replace the question mark (?) in the following series") ||
    t.includes("select the number that can replace the question mark (?)") ||
    t.includes("select the letter-cluster that can replace the question mark") ||
    t.includes("निम्नलिखित श्रृंखला में प्रश्न चिह्न (?) के स्थान पर") ||
    t.includes("उस संख्या का चयन करें जो प्रश्न चिह्न (?)") ||
    t.includes("उस अक्षर-समूह का चयन करें जो प्रश्न चिह्न (?)") ||
    t.includes("select the figure from among the given options that can replace the question mark") ||
    t.includes("उस विकल्प का चयन करें जो तीसरे पद से उसी प्रकार संबंधित है") ||
    t.includes("select the option that is related to the third word in the same way") ||
    t.includes("select the option that is related to the fifth number in the same way") ||
    t.includes("select the set in which the numbers are related in the same way") ||
    t.includes("उस समुच्चय का चयन करें जिसमें संख्याएं उसी तरह संबंधित हैं") ||
    t.includes("three of the following four are alike in a certain way and thus form a group") ||
    t.includes("चार में से तीन एक निश्चित तरीके से समान हैं और इस प्रकार एक समूह बनाते हैं") ||
    t.includes("select the odd letter-cluster") ||
    t.includes("select the odd number-pair") ||
    t.includes("select the odd word") ||
    t.includes("विषम अक्षर-समूह का चयन करें") ||
    t.includes("विषम संख्या-युग्म का चयन करें") ||
    t.includes("विषम शब्द का चयन करें")
  ) {
    return { match: true, pattern: "analogy_series_classification" };
  }

  // 7. Non-verbal, Dice, Mirror/Water image, Paper folding
  if (
    t.includes("mirror image of the given figure") ||
    t.includes("water image") ||
    t.includes("दर्पण छवि") ||
    t.includes("जल प्रतिबिंब") ||
    t.includes("paper is folded and cut") ||
    t.includes("कागज को मोड़ा और काटा जाता है") ||
    t.includes("embedded in the given figure") ||
    t.includes("दी गई आकृति में अंतर्निहित") ||
    t.includes("pattern would the given translucent sheet appear when folded") ||
    t.includes("opposite to the face showing") ||
    t.includes("opposite to the face having") ||
    t.includes("दिखाने वाले फलक के विपरीत") ||
    t.includes("फलक के विपरीत फलक पर") ||
    (t.includes("dice") && t.includes("opposite"))
  ) {
    return { match: true, pattern: "non_verbal" };
  }

  // 8. Venn diagram (logical)
  if (
    t.includes("venn diagram") ||
    t.includes("वेन आरेख")
  ) {
    if (t.includes("represents") || t.includes("relationship between") || t.includes("दर्शाता है") || t.includes("संबंध को सबसे अच्छे तरीके से")) {
      return { match: true, pattern: "logical_venn_diagram" };
    }
  }

  // 9. Mathematical operations interchange
  if (
    (t.includes("interchanging the two signs") || t.includes("interchange of signs") || t.includes("चिह्नों को आपस में बदलने")) ||
    (t.includes("if '+' means") || t.includes("if ‘+’ means") || t.includes("यदि '+' का अर्थ")) ||
    (t.includes("signs should be interchanged") || t.includes("को संतुलित करने के लिए"))
  ) {
    return { match: true, pattern: "mathematical_operations" };
  }

  // 10. Order & Ranking
  if (
    (t.includes("rank") || t.includes("स्थान")) &&
    (t.includes("from the top") || t.includes("from the bottom") || t.includes("from the left") || t.includes("from the right") || t.includes("शीर्ष से") || t.includes("नीचे से") || t.includes("बाएं से") || t.includes("दाएं से"))
  ) {
    return { match: true, pattern: "order_and_ranking" };
  }

  // 11. Word arrangement / Dictionary order
  if (
    t.includes("dictionary order") ||
    t.includes("शब्दकोश क्रम") ||
    t.includes("arrange the following words in a logical and meaningful order") ||
    t.includes("तार्किक और सार्थक क्रम में व्यवस्थित करें")
  ) {
    return { match: true, pattern: "dictionary_word_order" };
  }

  return { match: false };
}

// Check if text is English Language
function detectEnglish(text) {
  const t = text.toLowerCase();

  if (
    t.includes("select the most appropriate synonym") ||
    t.includes("select the most appropriate antonym") ||
    t.includes("select the option that is the most appropriate synonym") ||
    t.includes("select the option that is the most appropriate antonym") ||
    t.includes("select the incorrectly spelt word") ||
    t.includes("select the correctly spelt word") ||
    t.includes("identify the misspelt word") ||
    t.includes("select the option that can be used as a one-word substitute") ||
    t.includes("one-word substitution") ||
    t.includes("select the most appropriate meaning of the given idiom") ||
    t.includes("meaning of the idiom") ||
    t.includes("select the option that expresses the given sentence in passive voice") ||
    t.includes("select the option that expresses the given sentence in active voice") ||
    t.includes("change the following from active to passive") ||
    t.includes("select the option that expresses the given sentence in indirect speech") ||
    t.includes("select the option that expresses the given sentence in direct speech") ||
    t.includes("parts of the following sentence have been given as options. one of them may contain an error") ||
    t.includes("the following sentence has been split into four segments. identify the segment that contains a grammatical error") ||
    t.includes("select the option that will improve the underlined part of the given sentence") ||
    t.includes("rearrange the parts of the sentence in correct order") ||
    t.includes("sentences of a paragraph are given below in jumbled order") ||
    t.includes("fill in the blank with the most appropriate option") ||
    t.includes("fill in the blank with the most appropriate word") ||
    t.includes("select the most appropriate option to fill in the blank") ||
    t.includes("in the following passage, some words have been deleted. read the passage carefully and select the most appropriate option to fill in each blank") ||
    t.includes("read the given passage and answer the questions that follow")
  ) {
    return { match: true };
  }

  return { match: false };
}

// Check if text is Quantitative Aptitude
function detectQuant(text) {
  const t = text.toLowerCase();

  if (
    t.includes("compound interest") ||
    t.includes("simple interest") ||
    t.includes("चक्रवृद्धि ब्याज") ||
    t.includes("साधारण ब्याज") ||
    t.includes("marked price") ||
    t.includes("cost price") ||
    t.includes("selling price") ||
    t.includes("क्रय मूल्य") ||
    t.includes("विक्रय मूल्य") ||
    t.includes("अंकित मूल्य") ||
    t.includes("pipe a and pipe b") ||
    t.includes("pipes a, b and c") ||
    t.includes("नल a और नल b") ||
    (t.includes("boat") && (t.includes("upstream") || t.includes("downstream"))) ||
    (t.includes("नाव") && (t.includes("धारा के अनुकूल") || t.includes("धारा के प्रतिकूल"))) ||
    t.includes("train crosses a platform") ||
    t.includes("train crosses a pole") ||
    t.includes("ट्रेन एक खंभे को पार") ||
    (t.includes("hypotenuse") && t.includes("triangle")) ||
    (t.includes("sin θ") || t.includes("cos θ") || t.includes("tan θ") || t.includes("sinθ") || t.includes("cosθ") || t.includes("tanθ")) ||
    t.includes("curved surface area of a cylinder") ||
    t.includes("total surface area of a cone") ||
    t.includes("volume of a sphere") ||
    t.includes("बेलन का वक्र पृष्ठीय क्षेत्रफल") ||
    t.includes("शंकु का आयतन") ||
    t.includes("गोले का आयतन") ||
    t.includes("find the value of (a + b + c)") ||
    (t.includes("hcf and lcm") || t.includes("म.स.प. और ल.स.प.")) ||
    (t.includes("can complete a work in") && t.includes("days") && t.includes("together")) ||
    (t.includes("किसी कार्य को") && t.includes("दिनों में पूरा कर सकता है"))
  ) {
    return { match: true };
  }

  return { match: false };
}

async function run() {
  console.log("=== AUDITING ALL 45,178 QUESTIONS ACROSS THE DATABASE ===");

  const batchSize = 2500;
  let offset = 0;
  let totalProcessed = 0;

  let gsWithReasoning = [];
  let gsWithEnglish = [];
  let gsWithQuant = [];

  let quantWithReasoning = [];
  let quantWithGs = [];

  let reasoningWithGs = [];
  let reasoningWithQuant = [];

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
      const isReasoning = detectReasoning(fullText, optText);
      const isEnglish = detectEnglish(fullText);
      const isQuant = detectQuant(fullText);

      // GS subjects are 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
      if (q.subject_id >= 4 && q.subject_id <= 13) {
        if (isReasoning.match) {
          gsWithReasoning.push({ id: q.id, test_id: q.test_id, subject_id: q.subject_id, pattern: isReasoning.pattern, text: fullText.slice(0, 100) });
        } else if (isEnglish.match) {
          gsWithEnglish.push({ id: q.id, test_id: q.test_id, subject_id: q.subject_id, text: fullText.slice(0, 100) });
        } else if (isQuant.match) {
          gsWithQuant.push({ id: q.id, test_id: q.test_id, subject_id: q.subject_id, text: fullText.slice(0, 100) });
        }
      } else if (q.subject_id === 2) {
        // Quant subject
        if (isReasoning.match) {
          quantWithReasoning.push({ id: q.id, test_id: q.test_id, subject_id: q.subject_id, pattern: isReasoning.pattern, text: fullText.slice(0, 100) });
        }
      } else if (q.subject_id === 1) {
        // Reasoning subject
        if (isQuant.match) {
          reasoningWithQuant.push({ id: q.id, test_id: q.test_id, subject_id: q.subject_id, text: fullText.slice(0, 100) });
        }
      }

      totalProcessed++;
    }

    offset += batchSize;
    process.stdout.write(`Processed ${totalProcessed} questions...\r`);
  }

  console.log(`\nAudit Complete! Total questions analyzed: ${totalProcessed}\n`);

  console.log("================ RESULTS ================");
  console.log(`1. Reasoning questions inside GS (subject 4..13): ${gsWithReasoning.length}`);
  console.log(`2. English questions inside GS (subject 4..13): ${gsWithEnglish.length}`);
  console.log(`3. Quant questions inside GS (subject 4..13): ${gsWithQuant.length}`);
  console.log(`4. Reasoning questions inside Quant (subject 2): ${quantWithReasoning.length}`);
  console.log(`5. Quant questions inside Reasoning (subject 1): ${reasoningWithQuant.length}`);

  console.log("\n--- Sample Reasoning in GS ---");
  console.log(gsWithReasoning.slice(0, 10));

  console.log("\n--- Sample English in GS ---");
  console.log(gsWithEnglish.slice(0, 10));

  console.log("\n--- Sample Quant in GS ---");
  console.log(gsWithQuant.slice(0, 10));

  console.log("\n--- Sample Reasoning in Quant ---");
  console.log(quantWithReasoning.slice(0, 10));

  // Save audit log to file
  fs.writeFileSync(
    path.join(__dirname, "audit-results.json"),
    JSON.stringify({
      totalProcessed,
      counts: {
        gsWithReasoning: gsWithReasoning.length,
        gsWithEnglish: gsWithEnglish.length,
        gsWithQuant: gsWithQuant.length,
        quantWithReasoning: quantWithReasoning.length,
        reasoningWithQuant: reasoningWithQuant.length,
      },
      gsWithReasoningSample: gsWithReasoning.slice(0, 50),
      gsWithEnglishSample: gsWithEnglish.slice(0, 50),
      gsWithQuantSample: gsWithQuant.slice(0, 50),
      quantWithReasoningSample: quantWithReasoning.slice(0, 50),
    }, null, 2)
  );
  console.log("\nDetailed results saved to scripts/audit-results.json");

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

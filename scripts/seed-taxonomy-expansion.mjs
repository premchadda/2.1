/**
 * Taxonomy Expansion Seed Script
 * ===============================
 * Phase 1: Adds new topics to 28 single-topic chapters (>50 Qs)
 * Phase 2: Adds new subtopics to 51 single-subtopic topics (>50 Qs)
 * Phase 3: Builds full syllabi for Statistics (18) & Finance & Economics (19)
 *
 * All operations in a single transaction. No questions are re-classified here.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config({ path: 'apps/backend/.env' });

function slug(name, parentId) {
  return name
    .toLowerCase()
    .replace(/[()&,.'":;!?]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) + (parentId ? `-${parentId}` : '');
}

function uuid() { return crypto.randomUUID(); }

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();

  let topicsInserted = 0;
  let subtopicsInserted = 0;
  let chaptersInserted = 0;

  try {
    await client.query('BEGIN');

    // ============================================================================
    // HELPER: Load subject name map
    // ============================================================================
    const subjectNames = {};
    const sn = await client.query(`SELECT id, name FROM subjects`);
    for (const r of sn.rows) subjectNames[r.id] = r.name;

    // ============================================================================
    // HELPER: Insert a topic, return its ID
    // ============================================================================
    async function insertTopic(chapterId, subjectId, name, orderIndex) {
      const pubUuid = uuid();
      const subjectName = subjectNames[subjectId] || '';
      const res = await client.query(`
        INSERT INTO subject_topics (name, slug, chapter_id, subject_id, subject, order_index,
          is_active, is_deleted, difficulty, frequently_asked,
          public_id_uuid, exam_ids, stage_ids, related_chapters)
        VALUES ($1, $2, $3, $4, $5, $6, true, false, 'Mixed', false,
          $7, '{}', '{}', '{}')
        RETURNING id;
      `, [name, slug(name, chapterId), chapterId, subjectId, subjectName, orderIndex, pubUuid]);
      topicsInserted++;
      return res.rows[0].id;
    }

    // ============================================================================
    // HELPER: Insert a subtopic, return its ID
    // ============================================================================
    async function insertSubtopic(topicId, name, orderIndex) {
      const pubUuid = uuid();
      await client.query(`
        INSERT INTO subject_subtopics (name, slug, topic_id, order_index,
          is_active, is_deleted, public_id_uuid, stage_ids)
        VALUES ($1, $2, $3, $4, true, false, $5, '{}');
      `, [name, slug(name, topicId), topicId, orderIndex, pubUuid]);
      subtopicsInserted++;
    }

    // ============================================================================
    // HELPER: Insert a chapter, return its ID
    // ============================================================================
    async function insertChapter(subjectId, title, orderIndex, unitId = null) {
      const pubUuid = uuid();
      const res = await client.query(`
        INSERT INTO subject_chapters (title, slug, subject_id, unit_id, order_index,
          is_active, is_deleted, public_id_uuid)
        VALUES ($1, $2, $3, $4, $5, true, false, $6)
        RETURNING id;
      `, [title, slug(title, subjectId), subjectId, unitId, orderIndex, pubUuid]);
      chaptersInserted++;
      return res.rows[0].id;
    }

    // ============================================================================
    // HELPER: Insert a unit, return its ID
    // ============================================================================
    async function insertUnit(subjectId, name, orderIndex) {
      const res = await client.query(`
        INSERT INTO subject_units (name, slug, subject_id, order_index,
          is_active, is_deleted)
        VALUES ($1, $2, $3, $4, true, false)
        RETURNING id;
      `, [name, slug(name, subjectId), subjectId, orderIndex]);
      return res.rows[0].id;
    }

    // ============================================================================
    // PHASE 1: Add new topics to 28 bottleneck chapters
    // ============================================================================
    console.log('=== PHASE 1: Adding new topics to bottleneck chapters ===\n');

    // --- REASONING (Subject 1) ---

    // Chapter 76: Number Series (existing topic: 3223)
    const ns_topics = [
      'Difference & Double Difference Series',
      'Geometric & Multiplication Series',
      'Square, Cube & Prime Pattern Series',
      'Alternating & Mixed Pattern Series',
      'Wrong Term Detection'
    ];
    for (let i = 0; i < ns_topics.length; i++) {
      const tid = await insertTopic(76, 1, ns_topics[i], i + 2);
      await insertSubtopic(tid, `${ns_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Number Series: +5 topics');

    // Chapter 588: Mathematical Operations (existing: 3117)
    const mo_topics = [
      'Sign Interchange Problems',
      'Number Interchange Problems',
      'Coded Symbol Substitution',
      'Equation Balancing'
    ];
    for (let i = 0; i < mo_topics.length; i++) {
      const tid = await insertTopic(588, 1, mo_topics[i], i + 2);
      await insertSubtopic(tid, `${mo_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Mathematical Operations: +4 topics');

    // Chapter 219: Letter Shifting (existing: 477)
    const ls_topics = [
      'Forward & Backward Shift',
      'Multiple Position Shift',
      'Pattern-Based Shift'
    ];
    for (let i = 0; i < ls_topics.length; i++) {
      const tid = await insertTopic(219, 1, ls_topics[i], i + 2);
      await insertSubtopic(tid, `${ls_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Letter Shifting: +3 topics');

    // Chapter 584: Figure Completion (existing: 3212)
    const fc_topics = [
      'Pattern Completion',
      'Symmetry-Based Completion',
      'Missing Part Identification'
    ];
    for (let i = 0; i < fc_topics.length; i++) {
      const tid = await insertTopic(584, 1, fc_topics[i], i + 2);
      await insertSubtopic(tid, `${fc_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Figure Completion: +3 topics');

    // Chapter 579: Mirror Image (existing: 3232)
    const mi_topics = [
      'Letter & Number Mirror Image',
      'Figure & Shape Mirror Image',
      'Clock & Time Mirror Image'
    ];
    for (let i = 0; i < mi_topics.length; i++) {
      const tid = await insertTopic(579, 1, mi_topics[i], i + 2);
      await insertSubtopic(tid, `${mi_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Mirror Image: +3 topics');

    // Chapter 216: Circular Representations (existing: 474)
    const cr_topics = [
      'Circular Seating Arrangement',
      'Circular Direction Problems',
      'Circular Table Problems'
    ];
    for (let i = 0; i < cr_topics.length; i++) {
      const tid = await insertTopic(216, 1, cr_topics[i], i + 2);
      await insertSubtopic(tid, `${cr_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Circular Representations: +3 topics');

    // Chapter 79: Paper Cutting & Folding (existing: 3183)
    const pcf_topics = [
      'Paper Folding Patterns',
      'Paper Cutting Shapes',
      'Hole Punch Problems'
    ];
    for (let i = 0; i < pcf_topics.length; i++) {
      const tid = await insertTopic(79, 1, pcf_topics[i], i + 2);
      await insertSubtopic(tid, `${pcf_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Paper Cutting & Folding: +3 topics');

    // --- QUANTITATIVE APTITUDE (Subject 2) ---

    // Chapter 558: Line Graph (existing: 3173)
    const lg_topics = [
      'Single Line Graph Analysis',
      'Multiple Line Comparison'
    ];
    for (let i = 0; i < lg_topics.length; i++) {
      const tid = await insertTopic(558, 2, lg_topics[i], i + 2);
      await insertSubtopic(tid, `${lg_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Line Graph: +2 topics');

    // Chapter 556: Table DI (existing: 1857)
    const tdi_topics = [
      'Simple Table Analysis',
      'Complex Multi-Variable Table'
    ];
    for (let i = 0; i < tdi_topics.length; i++) {
      const tid = await insertTopic(556, 2, tdi_topics[i], i + 2);
      await insertSubtopic(tid, `${tdi_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Table DI: +2 topics');

    // --- ENGLISH LANGUAGE (Subject 3) ---

    // Chapter 598: One Word Substitution (existing: 3235)
    const ows_topics = [
      'Persons & Professions',
      'Places & Dwellings',
      'Phobias & Manias',
      'Government & Political Terms',
      'Science & Medicine Terms'
    ];
    for (let i = 0; i < ows_topics.length; i++) {
      const tid = await insertTopic(598, 3, ows_topics[i], i + 2);
      await insertSubtopic(tid, `${ows_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ One Word Substitution: +5 topics');

    // Chapter 108: Contextual Meaning (existing: 488)
    const cm_topics = [
      'Vocabulary in Context',
      'Sentence-Level Context',
      'Passage-Level Context'
    ];
    for (let i = 0; i < cm_topics.length; i++) {
      const tid = await insertTopic(108, 3, cm_topics[i], i + 2);
      await insertSubtopic(tid, `${cm_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Contextual Meaning: +3 topics');

    // Chapter 107: High Frequency Words (existing: 487)
    const hfw_topics = [
      'Academic & Formal Vocabulary',
      'Root-Word Based Vocabulary',
      'Commonly Confused Words'
    ];
    for (let i = 0; i < hfw_topics.length; i++) {
      const tid = await insertTopic(107, 3, hfw_topics[i], i + 2);
      await insertSubtopic(tid, `${hfw_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ High Frequency Words: +3 topics');

    // Chapter 608: Active Sentence Formation (existing: 3197)
    const asf_topics = [
      'Sentence Rewriting',
      'Voice Transformation Drills'
    ];
    for (let i = 0; i < asf_topics.length; i++) {
      const tid = await insertTopic(608, 3, asf_topics[i], i + 2);
      await insertSubtopic(tid, `${asf_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Active Sentence Formation: +2 topics');

    // Chapter 102: Case Rules (existing: 482)
    const case_topics = [
      'Nominative Case',
      'Objective Case',
      'Possessive Case'
    ];
    for (let i = 0; i < case_topics.length; i++) {
      const tid = await insertTopic(102, 3, case_topics[i], i + 2);
      await insertSubtopic(tid, `${case_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Case Rules: +3 topics');

    // --- HISTORY (Subject 4) ---

    // Chapter 59: Harappan Town Planning (existing: 3185)
    const htp_topics = [
      'Major Harappan Sites & Excavations',
      'Town Planning & Great Bath',
      'Seals, Script & Inscriptions',
      'Trade, Agriculture & Metallurgy'
    ];
    for (let i = 0; i < htp_topics.length; i++) {
      const tid = await insertTopic(59, 4, htp_topics[i], i + 2);
      await insertSubtopic(tid, `${htp_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Harappan Town Planning: +4 topics');

    // Chapter 141: Quit India (existing: 454)
    const qi_topics = [
      'Events & Timeline (1942)',
      'Key Leaders & Roles',
      'Impact & Aftermath'
    ];
    for (let i = 0; i < qi_topics.length; i++) {
      const tid = await insertTopic(141, 4, qi_topics[i], i + 2);
      await insertSubtopic(tid, `${qi_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Quit India: +3 topics');

    // --- POLITY (Subject 5) ---

    // Chapter 69: Preamble (existing: 3180)
    const preamble_topics = [
      'Key Terms: Sovereign, Socialist, Secular, Democratic, Republic',
      '42nd & 44th Constitutional Amendments',
      'Judicial Interpretations (Kesavananda Bharati)'
    ];
    for (let i = 0; i < preamble_topics.length; i++) {
      const tid = await insertTopic(69, 5, preamble_topics[i], i + 2);
      await insertSubtopic(tid, `${preamble_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Preamble: +3 topics');

    // Chapter 698: Written Constitution (existing: 3189)
    const wc_topics = [
      'Features of Written Constitution',
      'Comparison with Unwritten Constitutions (UK)',
      'Historical Development & Drafting'
    ];
    for (let i = 0; i < wc_topics.length; i++) {
      const tid = await insertTopic(698, 5, wc_topics[i], i + 2);
      await insertSubtopic(tid, `${wc_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Written Constitution: +3 topics');

    // Chapter 70: Parliament (existing: 3200)
    const parl_topics = [
      'Lok Sabha',
      'Rajya Sabha',
      'Parliamentary Procedures & Sessions'
    ];
    for (let i = 0; i < parl_topics.length; i++) {
      const tid = await insertTopic(70, 5, parl_topics[i], i + 2);
      await insertSubtopic(tid, `${parl_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Parliament: +3 topics');

    // Chapter 700: Federal System with Unitary Bias (existing: 3097)
    const fed_topics = [
      'Federal Features of Indian Constitution',
      'Unitary Features of Indian Constitution',
      'Centre-State Relations'
    ];
    for (let i = 0; i < fed_topics.length; i++) {
      const tid = await insertTopic(700, 5, fed_topics[i], i + 2);
      await insertSubtopic(tid, `${fed_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Federal System: +3 topics');

    // Chapter 730: Origin (existing: 3129)
    const origin_topics = [
      'Sources of Indian Constitution',
      'Borrowed Features from Other Constitutions',
      'Constitutional Evolution'
    ];
    for (let i = 0; i < origin_topics.length; i++) {
      const tid = await insertTopic(730, 5, origin_topics[i], i + 2);
      await insertSubtopic(tid, `${origin_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Origin: +3 topics');

    // Chapter 729: FR vs DPSP (existing: 3128)
    const frdpsp_topics = [
      'Key Differences Between FR and DPSP',
      'Judicial Pronouncements on FR vs DPSP',
      'Harmonization of FR and DPSP'
    ];
    for (let i = 0; i < frdpsp_topics.length; i++) {
      const tid = await insertTopic(729, 5, frdpsp_topics[i], i + 2);
      await insertSubtopic(tid, `${frdpsp_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ FR vs DPSP: +3 topics');

    // --- GEOGRAPHY (Subject 6) ---

    // Chapter 132: Drainage (existing: 445)
    const drain_topics = [
      'Himalayan River Systems',
      'Peninsular River Systems',
      'Tributaries & Confluences',
      'Dams & Reservoirs'
    ];
    for (let i = 0; i < drain_topics.length; i++) {
      const tid = await insertTopic(132, 6, drain_topics[i], i + 2);
      await insertSubtopic(tid, `${drain_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Drainage: +4 topics');

    // --- PHYSICS (Subject 8) ---

    // Chapter 71: Motion (existing: 3116)
    const motion_topics = [
      'Equations of Motion',
      'Speed, Velocity & Acceleration',
      'Circular & Projectile Motion'
    ];
    for (let i = 0; i < motion_topics.length; i++) {
      const tid = await insertTopic(71, 8, motion_topics[i], i + 2);
      await insertSubtopic(tid, `${motion_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Motion: +3 topics');

    // --- CHEMISTRY (Subject 9) ---

    // Chapter 72: Atoms (existing: 3118)
    const atom_topics = [
      'Atomic Structure & Subatomic Particles',
      'Atomic Models (Thomson, Rutherford, Bohr)',
      'Isotopes, Isobars & Isotones'
    ];
    for (let i = 0; i < atom_topics.length; i++) {
      const tid = await insertTopic(72, 9, atom_topics[i], i + 2);
      await insertSubtopic(tid, `${atom_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Atoms: +3 topics');

    // --- BIOLOGY (Subject 10) ---

    // Chapter 73: Digestion (existing: 3125)
    const dig_topics = [
      'Digestive System Organs',
      'Enzymes & Secretions',
      'Disorders of Digestive System'
    ];
    for (let i = 0; i < dig_topics.length; i++) {
      const tid = await insertTopic(73, 10, dig_topics[i], i + 2);
      await insertSubtopic(tid, `${dig_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Digestion: +3 topics');

    // Chapter 88: Plant Kingdom (existing: 3219)
    const pk_topics = [
      'Classification of Plants',
      'Flowering vs Non-Flowering Plants',
      'Economic Importance of Plants'
    ];
    for (let i = 0; i < pk_topics.length; i++) {
      const tid = await insertTopic(88, 10, pk_topics[i], i + 2);
      await insertSubtopic(tid, `${pk_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Plant Kingdom: +3 topics');

    // --- CURRENT AFFAIRS (Subject 12) ---

    // Chapter 11: Current Affairs (existing: 18)
    const ca_topics = [
      'National & State Affairs',
      'International Affairs & Summits',
      'Sports & Tournaments',
      'Awards & Honours',
      'Appointments & Obituaries',
      'Defence, Science & Space'
    ];
    for (let i = 0; i < ca_topics.length; i++) {
      const tid = await insertTopic(11, 12, ca_topics[i], i + 2);
      await insertSubtopic(tid, `${ca_topics[i]} (Concepts & Practice)`, 1);
    }
    console.log('  ✓ Current Affairs: +6 topics');

    console.log(`\n  Phase 1 complete: ${topicsInserted} topics inserted\n`);

    // ============================================================================
    // PHASE 2: Add new subtopics to 51 single-subtopic topics (>50 Qs)
    // ============================================================================
    console.log('=== PHASE 2: Adding new subtopics to bottleneck topics ===\n');

    // Format: [topicId, [subtopicNames...]]
    const subtopicExpansions = [
      // Quant: Divisibility Remainders (1866) — 4,762 Qs
      [1866, [
        'Divisibility Rules (2-11)',
        'Unit Digit & Last Digits',
        'Remainder Theorem',
        'Number of Factors & Zeros',
        'LCM/HCF Remainder Models',
        'Successive Division'
      ]],
      // Reasoning: Number Series (3223) — 2,312 Qs
      [3223, [
        'Difference Series',
        'Geometric & Multiplication Series',
        'Square/Cube Pattern Series',
        'Alternating & Mixed Series',
        'Wrong Term Detection'
      ]],
      // English: One Word Substitution (3235) — 1,354 Qs
      [3235, [
        'Persons & Professions',
        'Places & Collections',
        'Phobias & Manias',
        'Government & Political Terms',
        'Science & Medicine Terms'
      ]],
      // English: Single Blank (2031) — 1,175 Qs
      [2031, [
        'Vocabulary-Based Blanks',
        'Preposition & Collocation Blanks',
        'Grammar & Conjunction Blanks',
        'Phrasal Verb Blanks'
      ]],
      // History: Harappan Town Planning (3185) — 731 Qs
      [3185, [
        'Major Harappan Sites',
        'Town Planning Features',
        'Seals & Script',
        'Trade & Agriculture'
      ]],
      // English: Sentence Types (2012) — 711 Qs
      [2012, [
        'Simple Sentences',
        'Compound Sentences',
        'Complex Sentences',
        'Sentence Transformation'
      ]],
      // Polity: Preamble (3180) — 683 Qs
      [3180, [
        'Key Preamble Terms',
        'Historical Context of Preamble',
        'Amendments to Preamble',
        'Preamble Judicial Interpretation'
      ]],
      // Quant: Ratio Proportion Variation (1855) — 677 Qs
      [1855, [
        'Mean/Third/Fourth Proportional',
        'Distribution Problems',
        'Income-Expenditure Ratios',
        'Mixture & Replacement'
      ]],
      // English: Contextual Meaning (488) — 637 Qs
      [488, [
        'Vocabulary Context',
        'Sentence Context',
        'Passage Context'
      ]],
      // English: High Frequency Words (487) — 609 Qs
      [487, [
        'Academic Vocabulary',
        'Root-Word Based',
        'Commonly Confused Words'
      ]],
      // Reasoning: Mathematical Operations (3117) — 584 Qs
      [3117, [
        'Sign Interchange',
        'Number Interchange',
        'Coded Symbols',
        'Equation Balancing'
      ]],
      // Reasoning: Letter Shifting (477) — 543 Qs
      [477, [
        'Forward/Backward Shift',
        'Multiple Position Shift',
        'Pattern-Based Shift'
      ]],
      // Geography: Drainage (445) — 427 Qs
      [445, [
        'Himalayan Rivers',
        'Peninsular Rivers',
        'Tributaries & Confluences',
        'Dams & Reservoirs'
      ]],
      // Physics: Motion (3116) — 379 Qs
      [3116, [
        'Equations of Motion',
        'Speed & Velocity',
        'Circular Motion',
        'Projectile Motion'
      ]],
      // Reasoning: Figure Completion (3212) — 356 Qs
      [3212, [
        'Pattern Completion',
        'Symmetry Completion',
        'Missing Part Identification'
      ]],
      // Polity: President Election (2394) — 351 Qs
      [2394, [
        'Presidential Election Process',
        'Powers of President',
        'Emergency Powers',
        'Impeachment Process'
      ]],
      // Reasoning: Statement & Assumption (1960) — 325 Qs
      [1960, [
        'Statement & Assumption',
        'Statement & Conclusion',
        'Statement & Course of Action',
        'Statement & Argument'
      ]],
      // Polity: Written Constitution (3189) — 306 Qs
      [3189, [
        'Features of Written Constitution',
        'Comparison with Unwritten',
        'Historical Development'
      ]],
      // Chemistry: Atoms (3118) — 297 Qs
      [3118, [
        'Atomic Structure',
        'Atomic Models',
        'Isotopes & Isobars',
        'Valency & Electron Configuration'
      ]],
      // Quant: Rate calculation (623) — 285 Qs
      [623, [
        'Rate Finding Problems',
        'Time Finding Problems',
        'Mixed SI Problems'
      ]],
      // English: Direct Indirect (1864) — 279 Qs
      [1864, [
        'Direct to Indirect Conversion',
        'Indirect to Direct Conversion',
        'Reported Speech Rules'
      ]],
      // Reasoning: Figure Series (1934) — 267 Qs
      [1934, [
        'Rotation-Based Figure Series',
        'Addition/Subtraction Figure Series',
        'Pattern Completion Figure Series'
      ]],
      // History: Quit India (454) — 251 Qs
      [454, [
        'Events & Timeline 1942',
        'Key Leaders of Movement',
        'Impact & Aftermath'
      ]],
      // Reasoning: Mirror Image (3232) — 231 Qs
      [3232, [
        'Letter/Number Mirror',
        'Figure/Shape Mirror',
        'Clock Mirror'
      ]],
      // Geography: Latitudinal Extent (2290) — 218 Qs
      [2290, [
        'Latitudinal Extent',
        'Longitudinal Extent',
        'Boundary Neighbours',
        'Strategic Location'
      ]],
      // English: Active Passive (1847) — 205 Qs
      [1847, [
        'Active to Passive Rules',
        'Passive to Active Rules',
        'Special Constructions'
      ]],
      // Reasoning: Position Ranking (1948) — 203 Qs
      [1948, [
        'Left-Right Position',
        'Top-Bottom Position',
        'Interchanged Position'
      ]],
      // Biology: Digestion (3125) — 193 Qs
      [3125, [
        'Digestive Organs',
        'Enzymes & Secretions',
        'Digestive Disorders'
      ]],
      // English: Passive Voice Rules (2004) — 175 Qs
      [2004, [
        'Tense-Based Passive Rules',
        'Modal Passive',
        'Imperative Passive'
      ]],
      // Reasoning: Paper Cutting & Folding (3183) — 163 Qs
      [3183, [
        'Folding Patterns',
        'Cutting Shapes',
        'Hole Punch'
      ]],
      // Polity: Article 14 (2382) — 143 Qs
      [2382, [
        'Equality Before Law',
        'Equal Protection of Laws',
        'Reasonable Classification',
        'Landmark Judgements'
      ]],
      // Quant: SI formula (621) — 139 Qs
      [621, [
        'Basic SI Formula Application',
        'Two-Scheme Comparison',
        'Principal/Rate/Time Finding'
      ]],
      // Reasoning: Height Based Ranking (1949) — 131 Qs
      [1949, [
        'Height Order Problems',
        'Weight/Age Ranking',
        'Multi-Parameter Ranking'
      ]],
      // Quant: Filling pipes (631) — 127 Qs
      [631, [
        'Single Pipe Problems',
        'Two Pipe (Fill + Drain)',
        'Multiple Pipes & Alternating'
      ]],
      // Quant: Successive discount (616) — 119 Qs
      [616, [
        'Two Successive Discounts',
        'Three or More Discounts',
        'Equivalent Single Discount'
      ]],
      // Reasoning: Alphabet Series (1932) — 118 Qs
      [1932, [
        'Single Letter Pattern',
        'Double Letter Pattern',
        'Mixed Alpha-Numeric Series'
      ]],
      // Quant: Annual compounding (626) — 103 Qs
      [626, [
        'Annual CI Calculation',
        'Half-Yearly & Quarterly CI',
        'CI vs SI Difference Problems'
      ]],
      // Reasoning: Relationship Based Venn (1955) — 100 Qs
      [1955, [
        'Two-Set Relationship Venn',
        'Three-Set Relationship Venn',
        'Counting-Based Venn'
      ]],
      // Quant: Table Interpretation (687) — 97 Qs
      [687, [
        'Simple Table Interpretation',
        'Multi-Row Calculation',
        'Percentage-Based Table'
      ]],
      // English: Main Idea (2023) — 97 Qs
      [2023, [
        'Main Idea Identification',
        'Supporting Detail Extraction',
        'Inference-Based Questions'
      ]],
      // Polity: Parliament (3200) — 96 Qs
      [3200, [
        'Lok Sabha Functions',
        'Rajya Sabha Functions',
        'Joint Sessions & Procedures'
      ]],
      // English: Active Voice Rules (2003) — 86 Qs
      [2003, [
        'Present Tense Active Rules',
        'Past Tense Active Rules',
        'Future Tense Active Rules'
      ]],
      // Quant: Line Graph (3173) — 86 Qs
      [3173, [
        'Single Line Analysis',
        'Multiple Line Comparison',
        'Trend-Based Questions'
      ]],
      // Polity: State Bills (2423) — 84 Qs
      [2423, [
        'Types of State Bills',
        'Assent Process',
        'State vs Central Bills'
      ]],
      // Reasoning: Classification Venn (1954) — 84 Qs
      [1954, [
        'Two-Set Classification',
        'Three-Set Classification',
        'Inclusive/Exclusive Sets'
      ]],
      // Polity: Federal System (3097) — 83 Qs
      [3097, [
        'Federal Features',
        'Unitary Features',
        'Centre-State Relations'
      ]],
      // Economy: RBI Establishment (2494) — 82 Qs
      [2494, [
        'RBI History & Establishment',
        'RBI Functions',
        'RBI Governors'
      ]],
      // Polity: Origin (3129) — 77 Qs
      [3129, [
        'Sources of Constitution',
        'Borrowed Features',
        'Constitutional Evolution'
      ]],
      // History: Formation of INC (2241) — 73 Qs
      [2241, [
        'Formation & Early Years',
        'Moderate Phase',
        'Extremist Phase'
      ]],
      // Quant: Cost price (612) — 70 Qs
      [612, [
        'CP Calculation Methods',
        'CP from SP & Profit/Loss',
        'Marked Price & CP Relation'
      ]],
      // English: Active Sentence Formation (3197) — 63 Qs
      [3197, [
        'Sentence Rewriting',
        'Voice Transformation'
      ]],
      // Polity: FR vs DPSP (3128) — 62 Qs
      [3128, [
        'Key Differences',
        'Judicial Pronouncements',
        'Harmonization'
      ]],
      // Quant: Di Mixed (1857) — 56 Qs
      [1857, [
        'Simple Table DI',
        'Complex Multi-Variable DI'
      ]],
      // Quant: Decimal system (582) — 55 Qs
      [582, [
        'Decimal to Fraction',
        'Decimal Operations',
        'Recurring Decimals'
      ]],
      // Quant: CI formula (625) — 53 Qs
      [625, [
        'Basic CI Formula',
        'Successive Year CI',
        'CI with Variable Rate'
      ]],
      // Biology: Plant Kingdom (3219) — 52 Qs
      [3219, [
        'Plant Classification',
        'Flowering vs Non-Flowering',
        'Economic Importance'
      ]]
    ];

    for (const [topicId, newSubtopics] of subtopicExpansions) {
      for (let i = 0; i < newSubtopics.length; i++) {
        await insertSubtopic(topicId, newSubtopics[i], i + 2); // start at order 2 to keep existing at 1
      }
    }
    console.log(`  Phase 2 complete: ${subtopicsInserted - topicsInserted} subtopics inserted\n`);
    // (topicsInserted subtopics were already counted from Phase 1 auto-stubs)

    // ============================================================================
    // PHASE 3: Build Statistics & Finance & Economics Syllabi
    // ============================================================================
    console.log('=== PHASE 3: Building syllabi for empty subjects ===\n');

    // --- STATISTICS (Subject 18) ---
    const statUnits = [
      { name: 'Collection & Presentation of Data', chapters: [
        { title: 'Data Collection Methods', topics: [
          { name: 'Primary Data', subs: ['Census Method', 'Sampling Method'] },
          { name: 'Secondary Data', subs: ['Published Sources', 'Unpublished Sources'] }
        ]},
        { title: 'Classification & Tabulation', topics: [
          { name: 'Frequency Distribution', subs: ['Discrete Series', 'Continuous Series', 'Cumulative Frequency'] },
          { name: 'Tabulation', subs: ['Simple Table', 'Complex Table', 'Cross Tabulation'] }
        ]},
        { title: 'Graphical Representation', topics: [
          { name: 'Bar Diagrams', subs: ['Simple Bar', 'Multiple Bar', 'Subdivided Bar'] },
          { name: 'Pie Charts', subs: ['Construction', 'Interpretation'] },
          { name: 'Histogram & Ogive', subs: ['Histogram', 'Frequency Polygon', 'Ogive Curve'] }
        ]}
      ]},
      { name: 'Measures of Central Tendency', chapters: [
        { title: 'Arithmetic Mean', topics: [
          { name: 'Simple AM', subs: ['Direct Method', 'Shortcut Method', 'Step Deviation'] },
          { name: 'Weighted Mean', subs: ['Weighted AM', 'Combined Mean'] }
        ]},
        { title: 'Median', topics: [
          { name: 'Median Calculation', subs: ['Individual Series', 'Discrete Series', 'Continuous Series'] }
        ]},
        { title: 'Mode', topics: [
          { name: 'Mode Calculation', subs: ['By Inspection', 'By Formula', 'Graphical Method'] }
        ]},
        { title: 'Geometric & Harmonic Mean', topics: [
          { name: 'Geometric Mean', subs: ['GM Calculation', 'GM Applications'] },
          { name: 'Harmonic Mean', subs: ['HM Calculation', 'Relationship AM-GM-HM'] }
        ]}
      ]},
      { name: 'Measures of Dispersion', chapters: [
        { title: 'Range & Quartile Deviation', topics: [
          { name: 'Range', subs: ['Absolute Range', 'Coefficient of Range'] },
          { name: 'Quartile Deviation', subs: ['Quartile Calculation', 'Coefficient of QD'] }
        ]},
        { title: 'Mean Deviation', topics: [
          { name: 'MD from Mean', subs: ['Individual Series', 'Grouped Series'] },
          { name: 'MD from Median', subs: ['Individual Series', 'Grouped Series'] }
        ]},
        { title: 'Standard Deviation & Variance', topics: [
          { name: 'Standard Deviation', subs: ['Direct Method', 'Shortcut Method', 'Combined SD'] },
          { name: 'Coefficient of Variation', subs: ['CV Calculation', 'Comparison of Variability'] }
        ]}
      ]},
      { name: 'Correlation & Regression', chapters: [
        { title: 'Correlation Analysis', topics: [
          { name: 'Scatter Diagram', subs: ['Positive Correlation', 'Negative Correlation', 'No Correlation'] },
          { name: 'Karl Pearson Coefficient', subs: ['Direct Method', 'Shortcut Method'] },
          { name: 'Rank Correlation', subs: ['Spearman Rank', 'Tied Ranks'] }
        ]},
        { title: 'Regression Analysis', topics: [
          { name: 'Regression Lines', subs: ['Y on X', 'X on Y'] },
          { name: 'Regression Coefficient', subs: ['Calculation', 'Properties'] }
        ]}
      ]},
      { name: 'Probability', chapters: [
        { title: 'Probability Theory', topics: [
          { name: 'Classical Probability', subs: ['Equally Likely Events', 'Mutually Exclusive Events'] },
          { name: 'Addition Theorem', subs: ['Exclusive Events', 'Non-Exclusive Events'] },
          { name: 'Multiplication Theorem', subs: ['Independent Events', 'Conditional Probability'] },
          { name: 'Bayes Theorem', subs: ['Prior & Posterior Probability', 'Applications'] }
        ]},
        { title: 'Random Variables & Distributions', topics: [
          { name: 'Discrete Distributions', subs: ['Binomial', 'Poisson'] },
          { name: 'Continuous Distributions', subs: ['Normal Distribution', 'Properties of Normal Curve'] }
        ]}
      ]},
      { name: 'Index Numbers', chapters: [
        { title: 'Index Numbers', topics: [
          { name: 'Price Index', subs: ['Laspeyres', 'Paasche', 'Fisher Ideal'] },
          { name: 'Quantity Index', subs: ['Simple Aggregate', 'Weighted Aggregate'] },
          { name: 'Chain Base & Fixed Base', subs: ['Chain Base Method', 'Fixed Base Method', 'Conversion'] }
        ]}
      ]},
      { name: 'Time Series', chapters: [
        { title: 'Time Series Analysis', topics: [
          { name: 'Components of Time Series', subs: ['Trend', 'Seasonal Variation', 'Cyclical Variation', 'Irregular Variation'] },
          { name: 'Trend Analysis', subs: ['Moving Average', 'Least Squares Method'] },
          { name: 'Seasonal Indices', subs: ['Simple Average Method', 'Ratio to Trend Method'] }
        ]}
      ]},
      { name: 'Sampling Theory', chapters: [
        { title: 'Sampling Methods', topics: [
          { name: 'Random Sampling', subs: ['Simple Random', 'Systematic Sampling'] },
          { name: 'Stratified Sampling', subs: ['Proportional Allocation', 'Optimum Allocation'] },
          { name: 'Sampling Errors', subs: ['Standard Error', 'Confidence Intervals'] }
        ]}
      ]}
    ];

    let unitOrder = 1;
    for (const unit of statUnits) {
      const unitId = await insertUnit(18, unit.name, unitOrder++);
      let chOrder = 1;
      for (const ch of unit.chapters) {
        const chId = await insertChapter(18, ch.title, chOrder++, unitId);
        let tOrder = 1;
        for (const t of ch.topics) {
          const tId = await insertTopic(chId, 18, t.name, tOrder++);
          let sOrder = 1;
          for (const sub of t.subs) {
            await insertSubtopic(tId, sub, sOrder++);
          }
        }
      }
    }
    console.log('  ✓ Statistics (Subject 18): Full syllabus built');

    // --- FINANCE & ECONOMICS (Subject 19) ---
    const finUnits = [
      { name: 'Micro Economics', chapters: [
        { title: 'Demand & Supply', topics: [
          { name: 'Law of Demand', subs: ['Demand Curve', 'Exceptions to Law', 'Determinants'] },
          { name: 'Elasticity of Demand', subs: ['Price Elasticity', 'Income Elasticity', 'Cross Elasticity'] },
          { name: 'Supply & Market Equilibrium', subs: ['Law of Supply', 'Market Equilibrium', 'Price Ceiling & Floor'] }
        ]},
        { title: 'Consumer Theory', topics: [
          { name: 'Utility Analysis', subs: ['Cardinal Utility', 'Ordinal Utility', 'Indifference Curve'] },
          { name: 'Consumer Surplus', subs: ['Marshallian Surplus', 'Hicksian Analysis'] }
        ]},
        { title: 'Market Structures', topics: [
          { name: 'Perfect Competition', subs: ['Price Taking', 'Short Run Equilibrium', 'Long Run Equilibrium'] },
          { name: 'Monopoly', subs: ['Price Maker', 'Price Discrimination', 'Deadweight Loss'] },
          { name: 'Oligopoly & Monopolistic', subs: ['Oligopoly Models', 'Monopolistic Competition'] }
        ]},
        { title: 'Production & Cost Theory', topics: [
          { name: 'Production Function', subs: ['Short Run Production', 'Long Run Production', 'Returns to Scale'] },
          { name: 'Cost Concepts', subs: ['Fixed & Variable Cost', 'Marginal Cost', 'Average Cost Curves'] }
        ]}
      ]},
      { name: 'Macro Economics', chapters: [
        { title: 'National Income', topics: [
          { name: 'National Income Concepts', subs: ['GDP, GNP, NDP, NNP', 'Methods of Calculation', 'Real vs Nominal GDP'] },
          { name: 'Income Determination', subs: ['Keynesian Model', 'Multiplier Effect'] }
        ]},
        { title: 'Money & Banking', topics: [
          { name: 'Money Supply', subs: ['Measures of Money Supply', 'Credit Creation', 'Money Multiplier'] },
          { name: 'Banking System', subs: ['Commercial Banks', 'Central Banking (RBI)', 'Monetary Policy Tools'] }
        ]},
        { title: 'Inflation & Business Cycles', topics: [
          { name: 'Inflation', subs: ['Types of Inflation', 'Causes & Effects', 'Anti-Inflationary Measures'] },
          { name: 'Business Cycles', subs: ['Phases of Business Cycle', 'Stabilization Policies'] }
        ]}
      ]},
      { name: 'Public Finance', chapters: [
        { title: 'Government Budget', topics: [
          { name: 'Budget Components', subs: ['Revenue Budget', 'Capital Budget', 'Budget Deficit Types'] },
          { name: 'Fiscal Policy', subs: ['Objectives', 'Tools', 'Crowding Out Effect'] }
        ]},
        { title: 'Taxation', topics: [
          { name: 'Direct Taxes', subs: ['Income Tax', 'Corporate Tax', 'Capital Gains Tax'] },
          { name: 'Indirect Taxes', subs: ['GST Structure', 'Customs Duty', 'Tax Incidence'] }
        ]},
        { title: 'Public Debt', topics: [
          { name: 'Government Securities', subs: ['Types of G-Sec', 'Yield Curve'] },
          { name: 'Debt Management', subs: ['Internal vs External Debt', 'Debt-GDP Ratio'] }
        ]}
      ]},
      { name: 'Indian Economy', chapters: [
        { title: 'Planning & Development', topics: [
          { name: 'Five Year Plans', subs: ['Plan History', 'NITI Aayog', 'Key Schemes'] },
          { name: 'Poverty & Unemployment', subs: ['Poverty Measurement', 'Employment Programs'] }
        ]},
        { title: 'Sectors of Indian Economy', topics: [
          { name: 'Agriculture', subs: ['Green Revolution', 'MSP & Procurement', 'Agriculture Reforms'] },
          { name: 'Industry', subs: ['Industrial Policy', 'Make in India', 'MSME Sector'] },
          { name: 'Service Sector', subs: ['IT & BPO', 'Financial Services', 'Tourism'] }
        ]},
        { title: 'External Sector', topics: [
          { name: 'Foreign Trade', subs: ['Balance of Trade', 'Balance of Payments', 'Current Account'] },
          { name: 'LPG Reforms (1991)', subs: ['Liberalization', 'Privatization', 'Globalization'] },
          { name: 'International Organizations', subs: ['WTO', 'IMF', 'World Bank'] }
        ]}
      ]},
      { name: 'Financial Markets', chapters: [
        { title: 'Capital Market', topics: [
          { name: 'Primary Market', subs: ['IPO', 'FPO', 'Private Placement'] },
          { name: 'Secondary Market', subs: ['NSE & BSE', 'SEBI Regulations', 'Market Indices'] }
        ]},
        { title: 'Money Market', topics: [
          { name: 'Money Market Instruments', subs: ['Treasury Bills', 'Commercial Paper', 'Certificate of Deposit'] },
          { name: 'REPO & Reverse REPO', subs: ['REPO Operations', 'LAF', 'MSF'] }
        ]},
        { title: 'Derivatives & Risk Management', topics: [
          { name: 'Derivatives', subs: ['Futures', 'Options', 'Swaps'] },
          { name: 'Risk Management', subs: ['Hedging', 'Portfolio Theory', 'Insurance'] }
        ]}
      ]},
      { name: 'Accounting & Auditing', chapters: [
        { title: 'Financial Accounting', topics: [
          { name: 'Journal & Ledger', subs: ['Journal Entries', 'Ledger Posting', 'Trial Balance'] },
          { name: 'Financial Statements', subs: ['Balance Sheet', 'Profit & Loss Account', 'Cash Flow Statement'] }
        ]},
        { title: 'Auditing', topics: [
          { name: 'Audit Types', subs: ['Statutory Audit', 'Internal Audit', 'CAG Audit'] },
          { name: 'Audit Procedures', subs: ['Vouching', 'Verification', 'Audit Report'] }
        ]}
      ]}
    ];

    unitOrder = 1;
    for (const unit of finUnits) {
      const unitId = await insertUnit(19, unit.name, unitOrder++);
      let chOrder = 1;
      for (const ch of unit.chapters) {
        const chId = await insertChapter(19, ch.title, chOrder++, unitId);
        let tOrder = 1;
        for (const t of ch.topics) {
          const tId = await insertTopic(chId, 19, t.name, tOrder++);
          let sOrder = 1;
          for (const sub of t.subs) {
            await insertSubtopic(tId, sub, sOrder++);
          }
        }
      }
    }
    console.log('  ✓ Finance & Economics (Subject 19): Full syllabus built');

    await client.query('COMMIT');
    console.log(`\n✅ ALL PHASES COMPLETE`);
    console.log(`   Chapters inserted: ${chaptersInserted}`);
    console.log(`   Topics inserted:   ${topicsInserted}`);
    console.log(`   Subtopics inserted: ${subtopicsInserted}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ROLLED BACK due to error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

/**
 * Maps a classifier rule key ("<subjectId>:<ruleId>") to a target taxonomy node.
 *
 * Resolution is keyword-based against the LIVE taxonomy tables so we never
 * hard-code row ids that may drift. The first matching chapter candidate wins,
 * then the topic keyword is matched inside that chapter.
 *
 * `chapter`      ordered case-insensitive substrings tried against
 *                subject_chapters.title for the mapped subject.
 * `topic`        ordered substrings tried against subject_topics.name inside
 *                the resolved chapter (optional; first topic is fallback).
 * `skipChapter`  true → report chapter as "needs mapping" instead of dumping
 *                all questions into an arbitrary chapter.
 */

export const RULE_TAXONOMY_MAP = {
  // ---------------- Reasoning (subject 1) ----------------
  "1:analogy": { chapter: ["Analogy"], topic: ["Word Analogy", "Analogy"] },
  "1:classification_odd_one_out": { chapter: ["Classification"] },
  "1:series_missing_term": { chapter: ["Series"], topic: ["Number Series", "Series"] },
  "1:coding_decoding": { chapter: ["Coding-Decoding", "Coding Decoding"] },
  "1:blood_relations": { chapter: ["Blood Relations"] },
  "1:direction_sense": { chapter: ["Direction Sense"] },
  "1:seating_arrangement": { chapter: ["Seating Arrangement"] },
  "1:puzzle_floor": { chapter: ["Puzzle"], topic: ["Floor Puzzle"] },
  "1:syllogism": { chapter: ["Syllogism"] },
  "1:venn_diagram": { chapter: ["Logical Venn", "Venn Diagram"] },
  "1:cube_dice": { chapter: ["Cube & Dice", "Cube and Dice"] },
  "1:mirror_water_paper": { chapter: ["Mirror & Water Images", "Mirror Water Images", "Paper Cutting"] },
  "1:mathematical_operations": { chapter: ["Mathematical Operations"] },
  "1:ranking_order": { chapter: ["Ranking & Order", "Ranking"] },
  "1:data_sufficiency": { chapter: ["Data Sufficiency"] },
  "1:statement_assumption_conclusion": { chapter: ["Statement Based Reasoning", "Decision Making"] },
  "1:non_verbal_figure": { chapter: ["Non-Verbal Reasoning", "Figure Based Problems"] },
  "1:alphabet_test": { chapter: ["Alphabet Test"] },
  "1:input_output": { chapter: ["Input Output"] },
  "1:counting_figures": { chapter: ["Counting Figures"] },

  // ---------------- Quantitative Aptitude (subject 2) ----------------
  "2:simplification": { chapter: ["Simplification"] },
  "2:profit_loss": { chapter: ["Profit & Loss", "Profit and Loss"] },
  "2:discount": { chapter: ["Discount"] },
  "2:simple_interest": { chapter: ["Simple Interest"] },
  "2:compound_interest": { chapter: ["Compound Interest"] },
  "2:ratio_proportion": { chapter: ["Ratio & Proportion", "Ratio and Proportion"] },
  "2:mixture_alligation": { chapter: ["Mixture & Alligation", "Mixture"] },
  "2:average": { chapter: ["Average"] },
  "2:time_work": { chapter: ["Time & Work", "Time and Work"] },
  "2:pipe_cistern": { chapter: ["Pipe & Cistern", "Pipe"] },
  "2:time_distance_train": { chapter: ["Time & Distance", "Speed", "Time and Distance"] },
  "2:boat_stream": { chapter: ["Boat & Stream", "Boat"] },
  "2:lcm_hcf": { chapter: ["LCM & HCF", "LCM"] },
  "2:number_system": { chapter: ["Number System"] },
  "2:surds_indices": { chapter: ["Surds"] },
  "2:percentage": { chapter: ["Percentage"] },
  "2:algebra": { chapter: ["Algebra"] },
  "2:sequence_series_quant": { chapter: ["Sequence & Series", "Sequence"] },
  "2:trigonometry": { chapter: ["Trigonometry"] },
  "2:geometry": { chapter: ["Geometry"] },
  "2:mensuration": { chapter: ["Mensuration"] },
  "2:data_interpretation": { chapter: ["Data Interpretation"] },
  "2:statistics_probability": { chapter: ["Statistics & Probability", "Statistics"] },

  // ---------------- English (subject 3) ----------------
  "3:error_detection": { chapter: ["Error Detection"] },
  "3:synonym_antonym": { chapter: ["Synonyms & Antonyms", "Synonyms"] },
  "3:one_word_substitution": { chapter: ["One Word Substitution"] },
  "3:idioms_phrases": { chapter: ["Idioms & Phrases", "Idioms"] },
  "3:active_passive": { chapter: ["Active & Passive Voice", "Active"] },
  "3:direct_indirect": { chapter: ["Direct & Indirect Speech", "Direct"] },
  "3:sentence_rearrangement": { chapter: ["Sentence Rearrangement"] },
  "3:cloze_test": { chapter: ["Cloze Test"] },
  "3:fill_blanks": { chapter: ["Fill in the Blanks"] },
  "3:sentence_improvement": { chapter: ["Error Detection"], topic: ["Sentence Improvement"] },
  "3:comprehension": { chapter: ["Comprehension", "Reading Comprehension", "Passage Based Questions"] },
  "3:spelling": { chapter: ["Spelling"] },
  "3:parts_of_speech": { chapter: ["Parts of Speech"] },
  "3:tenses_grammar": { chapter: ["Tenses", "Grammar"] },
  "3:vocabulary_context": { chapter: ["Vocabulary"] },

  // ---------------- History (subject 4) ----------------
  "4:ivc_harappan": { chapter: ["Harappan", "Indus Valley"] },
  "4:vedic": { chapter: ["Vedic"], topic: ["Vedic Period", "Early Vedic"] },
  "4:mahajanapadas": { chapter: ["Mahajanapadas"] },
  "4:buddhism_jainism": { chapter: ["Buddhism & Jainism", "Buddhism"] },
  "4:maurya_gupta": { chapter: ["Ancient India"], topic: ["Maurya Empire", "Gupta Empire"] },
  "4:delhi_sultanate": { chapter: ["Delhi Sultanate"] },
  "4:mughal": { chapter: ["Mughal Empire", "Mughal", "Akbar"] },
  "4:maratha": { chapter: ["Maratha"] },
  "4:bhakti_sufi": { chapter: ["Bhakti Movement", "Sufi Movement", "Bhakti"] },
  "4:british_european": { chapter: ["British Administration", "European Expansion", "European"] },
  "4:revolt_1857": { chapter: ["Revolt of 1857", "1857"] },
  "4:national_movement": { chapter: ["Indian National Movement", "National Movement"] },
  "4:gandhian": { chapter: ["Gandhian"] },
  "4:post_independence": { chapter: ["Post Independence", "Post-Independence"] },
  "4:world_history": { chapter: ["World History"] },
  "4:prehistoric": { chapter: ["Prehistoric"] },

  // ---------------- Polity (subject 5) ----------------
  "5:constitution": { chapter: ["Written Constitution", "Constitution"] },
  "5:preamble_fr_dpsp": { chapter: ["Preamble"], topic: ["Meaning of Preamble", "Preamble"] },
  "5:articles_schedules": { chapter: ["Article"], topic: ["Article"] },
  "5:parliament": { chapter: ["Parliament"] },
  "5:president_pm": { chapter: ["President of India", "President"] },
  "5:judiciary": { chapter: ["Judiciary", "Supreme Court"] },
  "5:local_government": { chapter: ["Panchayati Raj", "Local"] },
  "5:elections_ec": { chapter: ["Election Commission", "Election System"] },
  "5:constitutional_bodies": { chapter: ["Constitutional Bodies"], skipChapter: true },
  "5:amendments": { chapter: ["Constitutional Amendments", "Amendment"] },
  "5:governor_states": { chapter: ["Governor"] },
  "5:citizenship_emergency": { chapter: ["National Emergency", "Emergency", "Citizenship"] },

  // ---------------- Geography (subject 6) ----------------
  "6:rivers_drainage": { chapter: ["Drainage", "River"] },
  "6:mountains_plateaus": { chapter: ["Physical Geography"], topic: ["Mountain", "Plateau"] },
  "6:climate_monsoon": { chapter: ["Climate", "Monsoon"] },
  "6:soil_agriculture_geo": { chapter: ["Soil"], topic: ["Soil"] },
  "6:water_bodies": { chapter: ["Oceans & Seas", "Oceans", "Lakes", "Water Bodies"] },
  "6:forests_wildlife_geo": { chapter: ["Natural Vegetation", "Forest", "Wildlife"] },
  "6:minerals_energy_geo": { chapter: ["Mineral", "Energy Resources"] },
  "6:landforms_hazards": { chapter: ["Earthquakes & Volcanoes", "Earthquake"], topic: ["Earthquake"] },
  "6:indian_geography_specific": { chapter: ["Indian Geography"] },
  "6:world_geography": { chapter: ["World Geography"] },

  // ---------------- Economy (subject 7) ----------------
  "7:national_income_gdp": { chapter: ["National Income"] },
  "7:inflation": { chapter: ["Inflation"] },
  "7:rbi_monetary": { chapter: ["Banking"], topic: ["RBI", "Central Bank"] },
  "7:budget_tax": { chapter: ["Budget", "Taxation", "Public Finance"] },
  "7:planning_niti": { chapter: ["Economic Planning", "Planning", "NITI"] },
  "7:banking_finance": { chapter: ["Banking"] },
  "7:capital_market": { chapter: ["Capital Market", "Financial Market", "Money Market"] },
  "7:trade_forex": { chapter: ["International Trade", "Foreign Trade", "Trade"] },
  "7:poverty_employment": { chapter: ["Poverty", "Employment"] },
  "7:reforms_schemes": { chapter: ["Economic Reforms", "Reforms"] },
  "7:basic_economics": { chapter: ["Economic Terms", "Basic"] },

  // ---------------- Physics (subject 8) ----------------
  "8:mechanics_motion": { chapter: ["Mechanics", "Motion"] },
  "8:optics": { chapter: ["Optics", "Light"] },
  "8:work_energy_power": { chapter: ["Work, Power & Energy", "Work"] },
  "8:heat_thermo": { chapter: ["Heat", "Thermo"] },
  "8:electricity_magnetism": { chapter: ["Electricity", "Magnetism"] },
  "8:sound_waves": { chapter: ["Sound", "Wave"] },
  "8:units_measurement": { chapter: ["Units", "Measurement"] },
  "8:modern_physics": { chapter: ["Modern Physics", "Atomic", "Nuclear"] },
  "8:pressure_fluids": { chapter: ["Pressure", "Fluid"] },

  // ---------------- Chemistry (subject 9) ----------------
  "9:atomic_structure": { chapter: ["Atomic Structure", "Structure of Atom"] },
  "9:periodic_table": { chapter: ["Periodic Table"] },
  "9:chemical_bonding": { chapter: ["Chemical Bonds", "Bonding"] },
  "9:chemical_reactions": { chapter: ["Chemical Reactions", "Types of Chemical"] },
  "9:acids_bases_salts": { chapter: ["Acids, Bases & Salts", "Acids"] },
  "9:metals_nonmetals": { chapter: ["Metals and Non-Metals", "Metals"] },
  "9:carbon_organic": { chapter: ["Carbon Chemistry", "Carbon Compounds", "Carbon"] },
  "9:chemical_formula": { chapter: ["Introduction to Chemistry", "Chemistry"] },
  "9:daily_use_chemicals": { chapter: ["Daily Use Chemicals"] },
  "9:matter_states": { chapter: ["Introduction to Chemistry", "Chemistry"] },

  // ---------------- Biology (subject 10) ----------------
  "10:human_body": { chapter: ["Human Body Systems", "Human Body"] },
  "10:cell_biology": { chapter: ["Cell Biology", "Cell Structure"] },
  "10:photosynthesis_plants": { chapter: ["Photosynthesis", "Plant"] },
  "10:diseases_health": { chapter: ["Diseases and Health", "Diseases"] },
  "10:genetics_evolution": { chapter: ["Genetics & Evolution", "Genetics"] },
  "10:ecology_environment": { chapter: ["Ecology"] },
  "10:animal_kingdom": { chapter: ["Basics of Biology", "Biology"] },
  "10:microbiology": { chapter: ["Basics of Biology", "Biology"] },
  "10:nutrition_biology": { chapter: ["Basics of Biology", "Biology"] },
  "10:reproduction_biology": { chapter: ["Human Body Systems"] },

  // ---------------- Static GK (subject 11) ----------------
  "11:art_culture_dance": { chapter: ["Indian Art and Culture", "Art and Culture", "Art & Culture"] },
  "11:festivals_fairs": { chapter: ["Cultural GK", "Art and Culture", "Festival"] },
  "11:national_symbols": { chapter: ["National Symbols"] },
  "11:awards_honours": { chapter: ["National Awards", "International Awards"] },
  "11:books_authors": { chapter: ["Famous Books", "Famous Authors"] },
  "11:sports_trophies": { chapter: ["Sports and Games", "Sports Events", "Sports"] },
  "11:monuments_places": { chapter: ["Historical Monuments", "Important Places"] },
  "11:first_superlatives": { chapter: ["First in India", "Superlatives"] },
  "11:organizations_static": { chapter: ["International Organizations", "Indian Organizations"] },
  "11:days_years_static": { chapter: ["National Days", "International Days"] },
  "11:state_culture_specific": { chapter: ["States and Union Territories", "Indian States"] },
  "11:misc_gk_facts": { chapter: ["Important Facts", "Static Gk"] },

  // ---------------- Current Affairs (subject 12) ----------------
  "12:ca_schemes": { chapter: ["Government Policies and Schemes", "Policies"] },
  "12:ca_space_technology": { chapter: ["Space Technology"] },
  "12:ca_defence": { chapter: ["Defence Developments", "Defence"] },
  "12:ca_summit_relations": { chapter: ["International Relations", "International Organizations"] },
  "12:ca_appointments": { chapter: ["National Events and Developments", "National Affairs"] },
  "12:ca_awards_recent": { chapter: ["National Events and Developments", "National Affairs"] },
  "12:ca_sports_updates": { chapter: ["National Sports Updates", "Sports"] },
  "12:ca_budget_survey": { chapter: ["Budget and Economic Survey", "Budget"] },
  "12:ca_national_events": { chapter: ["National Events and Developments", "National Affairs"] },
  "12:ca_recent_general": { chapter: ["National Events and Developments", "National Affairs", "Current Affairs"] },

  // ---------------- Computer Knowledge (subject 13) ----------------
  "13:computer_hardware_io": { chapter: ["Input & Output Devices", "Input Devices", "Output Devices", "CPU & Storage"] },
  "13:computer_software_os": { chapter: ["Operating Systems", "System Software", "Application Software"] },
  "13:computer_networking": { chapter: ["Networking", "Protocols", "Internet Basics"] },
  "13:computer_database": { chapter: ["Database Concepts", "Database Models"] },
  "13:computer_security": { chapter: ["Computer Viruses", "Security Measures", "Cyber Crimes"] },
  "13:computer_fundamentals": { chapter: ["Computer Organization", "Computer Generations", "Data Representation"] },
  "13:computer_programming": { chapter: ["Programming Languages", "Programming Concepts"] },
  "13:computer_ms_office": { chapter: ["MS Word", "MS Excel", "MS PowerPoint"] },

};

/**
 * Resolve a rule key to concrete taxonomy ids using live taxonomy rows.
 * @param {string} ruleKey "<subjectId>:<ruleId>"
 * @param {Map<number, Array>} chaptersBySubject
 * @param {Map<number, Array>} topicsByChapter
 * @param {Map<number, Array>} subtopicsByTopic
 */
export function resolveRuleTaxonomy(ruleKey, chaptersBySubject, topicsByChapter, subtopicsByTopic) {
  const cfg = RULE_TAXONOMY_MAP[ruleKey];
  if (!cfg) return { resolved: false, reason: "no_mapping_for_rule" };

  const subjectId = Number(ruleKey.split(":")[0]);
  const chapters = chaptersBySubject.get(subjectId) || [];

  let chapter = null;
  for (const kw of cfg.chapter || []) {
    const needle = kw.toLowerCase();
    chapter = chapters.find((c) => String(c.title).toLowerCase().includes(needle));
    if (chapter) break;
  }
  if (!chapter) {
    return { resolved: false, reason: cfg.skipChapter ? "chapter_needs_mapping" : "chapter_keyword_not_found" };
  }
  if (cfg.skipChapter) {
    return { resolved: false, reason: "chapter_needs_mapping" };
  }

  const topics = topicsByChapter.get(chapter.id) || [];
  let topic = null;
  for (const kw of cfg.topic || []) {
    const needle = kw.toLowerCase();
    topic = topics.find((t) => String(t.name).toLowerCase().includes(needle));
    if (topic) break;
  }
  if (!topic) topic = topics[0] || null;

  const subtopics = topic ? subtopicsByTopic.get(topic.id) || [] : [];
  const subtopic = subtopics[0] || null;

  return {
    resolved: true,
    subjectId,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    topicId: topic ? topic.id : null,
    topicName: topic ? topic.name : null,
    subtopicId: subtopic ? subtopic.id : null,
    subtopicName: subtopic ? subtopic.name : null,
  };
}
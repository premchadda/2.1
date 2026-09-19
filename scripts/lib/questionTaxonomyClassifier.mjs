/**
 * Full-text hierarchical question taxonomy classifier (rules-based).
 *
 * Design goals (addresses the earlier single-keyword false positives):
 *  - Reads the ENTIRE question record: stem + options + explanation (+ Hindi).
 *  - Matches multi-word PHRASES / format signatures, never lone ambiguous tokens
 *    (e.g. "interest", "ratio", "series", "average" on their own match nothing).
 *  - Every rule is an AND-of-OR "group": each group needs at least one phrase to
 *    hit, so signals must co-occur in context (negation/ambiguity resistant).
 *  - Every match records human-readable evidence for auditability.
 *
 * Pure module: no DB / no I/O. Used by scripts/audit-full-question-classification.mjs
 */

export const SUBJECTS = {
  REASONING: 1,
  QUANT: 2,
  ENGLISH: 3,
  HISTORY: 4,
  POLITY: 5,
  GEOGRAPHY: 6,
  ECONOMY: 7,
  PHYSICS: 8,
  CHEMISTRY: 9,
  BIOLOGY: 10,
  STATIC_GK: 11,
  CURRENT_AFFAIRS: 12,
  COMPUTER: 13,
};

export const SUBJECT_NAMES = {
  1: "General Intelligence & Reasoning",
  2: "Quantitative Aptitude",
  3: "English Language",
  4: "History",
  5: "Polity",
  6: "Geography",
  7: "Economy",
  8: "Physics",
  9: "Chemistry",
  10: "Biology",
  11: "Static GK",
  12: "Current Affairs",
  13: "Computer Knowledge",
};

/** Strip HTML tags + entities and collapse whitespace. */
export function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the full searchable text for a question row.
 */
export function buildQuestionText(q) {
  const stem = stripHtml(q.question_text);
  const stemHi = stripHtml(q.question_text_hi);
  const options = [].concat(q.options || []).map(stripHtml).filter(Boolean).join(" | ");
  const optionsHi = [].concat(q.options_hi || []).map(stripHtml).filter(Boolean).join(" | ");
  const explanation = stripHtml(q.explanation);
  const explanationHi = stripHtml(q.explanation_hi);

  const combined = [stem, stemHi, options, optionsHi, explanation, explanationHi]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
  return { combined, stem: `${stem} \n ${stemHi}`.toLowerCase() };
}

/**
 * A rule is `{ id, subject, weight, groups, not }`.
 * `groups` is an array of arrays of RegExp; EVERY group needs >=1 match (AND of ORs).
 * `not` is an optional array of RegExp that veto the rule when matched.
 */
export function rule(subject, weight, id, groups, not) {
  return { subject, weight, id, groups, not };
}

// ---------------------------------------------------------------------------
// Reasoning (subject 1) — detected by FORMAT SIGNATURE, not content topic.
// This is what stops "odd one out: chicken pox, rubella" being filed as Biology.
// ---------------------------------------------------------------------------
export const REASONING_RULES = [
  rule(1, 6, "analogy", [
    [/select the (?:option|set|number|word|pair|letter)[^.]{0,60}(?:related|same way|alike|similar)/i, /is related to the (?:third|second|fifth)[^.]{0,40}same way/i, /complete the analogy/i, /उसी प्रकार संबंधित/i],
    [/\brelated to\b/i, /\bsame way\b/i, /\balike\b/i, /\banalogy/i, /\bसमान संबंध/i],
  ]),
  rule(1, 7, "classification_odd_one_out", [
    [/odd one out/i, /odd word/i, /odd number/i, /odd letter/i, /विषम/, /three of the following four are alike/i, /which (?:word|number|figure|option) is (?:different|not like)/i, /find the (?:odd|different|unlike)/i, /select the odd/i, /choose the (?:unlike|different|odd)/i, /असंगत/, /भिन्न/],
  ]),
  rule(1, 6, "series_missing_term", [
    [/replace the question mark/i, /complete the series/i, /complete the pattern/i, /missing (?:number|term|letter|character|figure)/i, /next (?:term|number|letter|figure) in the (?:series|sequence)/i, /प्रश्न चिह्न/, /श्रृंखला/, /in the series/i, /find the missing \(?/i, /sequence of letters/i],
    [/\?/, /question mark/i, /series/i, /sequence/i, /श्रृंखला/],
  ]),
  rule(1, 8, "coding_decoding", [
    [/in a certain code/i, /in a code language/i, /coded as/i, /is written as/i, /code for/i, /कूट भाषा/, /कूटबद्ध/],
    [/code|coded|written as|कूट/i],
  ]),
  rule(1, 8, "blood_relations", [
    [/pointing to/i, /pointing towards/i, /mother'?s only (?:son|daughter)/i, /father'?s only (?:son|daughter)/i, /brother of (?:my|her|his) (?:father|mother)/i, /sister of (?:my|her|his) (?:father|mother)/i, /how is [^.]{0,40}related to/i, /रक्त संबंध/, /इशारा/, /family (?:tree|relationship)/i, /is the (?:son|daughter|brother|sister|father|mother|husband|wife) of/i, /in terms of relationship/i],
    [/\b(?:father|mother|sister|brother|son|daughter|uncle|aunt|nephew|niece|wife|husband|cousin|grandfather|grandmother|paternal|maternal|relationship)\b/i],
  ]),
  rule(1, 8, "direction_sense", [
    [/walk(?:s|ed|ing)? \d+\s?(?:km|kms|m|metre|meter|feet|steps)/i, /move(?:s|d)? \d+\s?(?:km|kms|m|metre|meter)/i, /turns? (?:to the )?(?:left|right)/i, /took a (?:left|right) turn/i, /बाएं मुड़/, /दाएं मुड़/],
    [/\b(?:north|south|east|west|left|right|उत्तर|दक्षिण|पूर्व|पश्चिम)\b/i],
  ]),
  rule(1, 8, "seating_arrangement", [
    [/sitting/i, /seated/i, /sit in a/i, /बैठे/, /around a (?:circular|round) table/i],
    [/\b(?:row|circle|circular|straight line|facing|extreme|immediate left|immediate right|opposite|centre|center|मेज)\b/i],
  ]),
  rule(1, 7, "puzzle_floor", [
    [/different floors?/i, /floor (?:number|above|below|just)/i, /lives? on (?:an )?(?:odd|even)[- ]numbered floor/i, /working together, all having different/i],
    [/\b(?:floors?|lives?|living|stays?|above|below)\b/i],
  ]),
  rule(1, 7, "syllogism", [
    [/statements?\s*:/i, /कथन\s*:/, /logically follow/i, /तार्किक रूप से अनुसरण/],
    [/conclusions?\s*:/i, /निष्कर्ष\s*:/, /logically follow/i, /follows?\b/i],
  ]),
  rule(1, 5, "venn_diagram", [[/venn diagram/i, /वेन आरेख/]]),
  rule(1, 6, "cube_dice", [
    [/\bdice\b/i, /\bcube\b/i, /घन/, /पासा/],
    [/opposite (?:face|to the face)/i, /painted/i, /\bfaces?\b/i, /\bdice|cube|घन|पासा\b/i],
  ]),
  rule(1, 7, "mirror_water_paper", [
    [/mirror image/i, /water image/i, /दर्पण छवि/, /जल प्रतिबिंब/, /paper (?:is )?folded/i, /कागज को मोड़ा/, /embedded in the given figure/i, /figure completion/i, /count(?:ing)? (?:the )?(?:number of )?(?:triangles|squares|figures|rectangles)/i, /folded and (?:cut|punched)/i, /दी गई आकृति में अंतर्निहित/],
  ]),
  rule(1, 8, "mathematical_operations", [
    [/means\s*['"‘’`]?\s*(?:x|\+|-|×|÷|minus|plus|multiplied|divided)/i, /get replaced by/i, /replaced by\s*(?:\+|-|×|÷)/i, /प्रतिस्थापित/],
    [/means?\b/i, /replaced\b/i, /प्रतिस्थापित/],
  ]),
  rule(1, 6, "ranking_order", [
    [/rank(?:s|ing|ed)?/i, /position from the (?:top|bottom|left|right)/i, /क्रम/],
    [/\b(?:rank|position|top|bottom|above|below|row)\b/i],
  ]),
  rule(1, 6, "data_sufficiency", [[/data sufficiency/i, /statements? (?:i|ii|iii|1|2)\b[^.]{0,30}(?:alone|together)/i]]),
  rule(1, 6, "statement_assumption_conclusion", [
    [/statement[^.]{0,40}(?:assumption|argument|conclusion|course of action)/i, /\bassumption\b/i, /\bconclusion\b/i, /cause and effect/i, /decision making/i, /statement based/i],
    [/\bstatement\b/i, /\bargument\b/i, /\bconclusion\b/i, /\bcause\b/i, /\bdecision\b/i],
  ]),
  rule(1, 5, "non_verbal_figure", [
    [/select the figure/i, /figure (?:series|analogy|classification|matrix)/i, /which figure/i, /आकृति/, /transparent sheet/i],
  ]),
  rule(1, 5, "alphabet_test", [[/alphabet(?:ical)? (?:series|order|test|position)/i, /arrange the (?:given )?words? in (?:a )?(?:meaningful|alphabetical|dictionary) order/i]]),
  rule(1, 4, "input_output", [[/input output/i, /step \d+ (?:is|arrangement)/i]]),
  rule(1, 4, "counting_figures", [[/how many (?:triangles|squares|rectangles|straight lines|circles)/i]]),
];

// ---------------------------------------------------------------------------
// English Language (subject 3)
// ---------------------------------------------------------------------------
export const ENGLISH_RULES = [
  rule(3, 8, "error_detection", [
    [/error/i, /incorrect(?:ly)? (?:spelt|spelled|written|used)/i, /spot the error/i, /errorless/i, /grammatically (?:correct|incorrect)/i, /त्रुटि/, /गलत/],
    [/sentence/i, /part/i, /segment/i, /underline/i],
  ]),
  rule(3, 7, "synonym_antonym", [
    [/synonym/i, /antonym/i, /similar meaning/i, /opposite meaning/i, /समानार्थी/, /विलोम/],
    [/\bword\b/i, /\bchoose\b/i, /\bselect\b/i, /meaning/i],
  ]),
  rule(3, 7, "one_word_substitution", [
    [/one word substitution/i, /one-word substitution/i, /single word for/i, /substitute (?:the )?(?:following|for)/i, /एक शब्द/],
  ]),
  rule(3, 6, "idioms_phrases", [
    [/\bidiom(?:s|atic)?\b/i, /\bidiomatic expression\b/i, /phrase (?:means|refers to)/i, /मुहावरा/, /लोकोक्ति/],
    [/means/i, /meaning/i, /choose/i, /select/i, /expression/i],
  ]),
  rule(3, 7, "active_passive", [
    [/passive voice/i, /active voice/i, /passive form/i, /कर्मवाच्य/, /भाववाच्य/],
    [/sentence/i, /change/i, /convert/i, /voice/i],
  ]),
  rule(3, 7, "direct_indirect", [
    [/indirect speech/i, /direct speech/i, /reported speech/i, /narration/i, /अप्रत्यक्ष कथन/, /प्रत्यक्ष कथन/],
    [/sentence/i, /speech/i, /narration/i, /convert/i, /change/i],
  ]),
  rule(3, 7, "sentence_rearrangement", [
    [/rearrange/i, /jumbled/i, /arrange the sentences/i, /correct order to (?:form|make)/i, /क्रम में/],
    [/sentence/i, /paragraph/i, /passage/i, /वाक्य/],
  ]),
  rule(3, 6, "cloze_test", [[/cloze test/i, /fill in the blanks in the (?:following )?passage/i]]),
  rule(3, 6, "fill_blanks", [
    [/fill in the blank/i, /fill in the blanks/i, /fill up the blank/i, /रिक्त स्थान/],
  ]),
  rule(3, 7, "sentence_improvement", [
    [/improve the (?:underlined|bold)/i, /sentence improvement/i, /replace the underlined/i, /part of the sentence that contains an error/i],
    [/sentence/i, /part/i],
  ]),
  rule(3, 7, "comprehension", [
    [/reading comprehension/i, /read the (?:following )?passage/i, /based on the (?:following )?passage/i, /following passage/i, /गद्यांश/],
    [/passage/i, /answer/i, /questions?/i, /गद्यांश/],
  ]),
  rule(3, 8, "spelling", [
    [/correct(?:ly)? spelled/i, /correctly spelt/i, /wrongly spelt/i, /misspelt/i, /misspelled/i, /incorrectly spelt/i, /correct spelling/i, /spelling of/i, /identify the (?:mis|in)spelt/i, /वर्तनी/],
  ]),
  rule(3, 5, "parts_of_speech", [
    [/parts? of speech/i, /शब्द भेद/],
    [/noun|pronoun|verb|adjective|adverb|preposition|conjunction|interjection/i],
  ]),
  rule(3, 5, "tenses_grammar", [
    [/correct (?:form|tense)/i, /appropriate (?:form|tense|article|preposition)/i, /subject[- ]verb agreement/i, /grammatically (?:correct|incorrect)/i, /fill in the blank[^.]{0,60}(?:article|preposition|verb|tense)/i],
    [/tense/i, /verb/i, /sentence/i, /article/i, /preposition/i, /noun/i],
  ]),
  rule(3, 6, "vocabulary_context", [
    [/contextual meaning/i, /meaning of the (?:word|phrase|underlined)/i, /choose the word (?:that|which)/i, /select the option that best describes the meaning/i],
    [/word/i, /meaning/i, /sentence/i],
  ]),
];

// ---------------------------------------------------------------------------
// Quantitative Aptitude (subject 2) — phrase/number evidence only.
// ---------------------------------------------------------------------------
export const QUANT_RULES = [
  rule(2, 7, "simplification", [
    [/simplify/i, /evaluate:/i, /find the value of/i, /solve for/i, /calculate the value/i],
    [/\d/, /=/],
  ]),
  rule(2, 8, "profit_loss", [
    [/profit (?:percentage|percent|of|earned|made)/i, /loss (?:percentage|percent|of|incurred|at)/i, /cost price/i, /selling price/i, /marked price/i, /sold at a/i, /bought.*sold/i, /लाभ/, /हानि/],
    [/\d/, /%/, /percent/i],
  ]),
  rule(2, 7, "discount", [
    [/discount/i, /marked price/i, /successive discount/i],
    [/\d/, /%/, /percent/i],
  ]),
  rule(2, 7, "simple_interest", [
    [/simple interest/i, /sum of money.*(?:rate|years)/i, /principal.*rate.*(?:year|annum)/i, /साधारण ब्याज/],
  ]),
  rule(2, 7, "compound_interest", [
    [/compound(?:ed)? (?:interest|annually|half[- ]yearly|quarterly)/i, /चक्रवृद्धि ब्याज/],
  ]),
  rule(2, 7, "ratio_proportion", [
    [/ratio (?:of|between|is)/i, /proportion/i, /अनुपात/],
    [/\d/, /:/],
  ]),
  rule(2, 7, "mixture_alligation", [
    [/mixture of/i, /alligation/i, /mixed in the ratio/i, /मिश्रण/],
    [/\d/, /ratio/i, /:/],
  ]),
  rule(2, 7, "average", [
    [/average (?:of|age|speed|marks|weight|number)/i, /mean of \d/i, /औसत/],
    [/\d/],
  ]),
  rule(2, 8, "time_work", [
    [/time and work/i, /(?:finish|complete|do) (?:the |a )?work/i, /\d+ days? to (?:finish|complete)/i, /efficiency/i, /समय और कार्य/],
    [/\d/],
  ]),
  rule(2, 8, "pipe_cistern", [
    [/(?:pipe|tap|cistern|tank)\b[^.]{0,60}(?:fill|empty|empties|leak|drain|overflow)/i, /(?:fill|empty|empties|leak|drain)[^.]{0,60}(?:pipe|tap|cistern|tank)\b/i, /नल[^.]{0,40}भर|हौज/],
    [/\d/],
  ]),
  rule(2, 8, "time_distance_train", [
    [/speed of (?:the )?(?:train|car|bus|boat|stream)/i, /train (?:crosses|travels|running|moving)/i, /\(?in km\/?h\)?|km per hour|m\/s\b/i, /(?:cross|crosses) (?:a |the )?(?:platform|pole|bridge|tunnel)/i, /समय और दूरी/],
    [/\d/],
  ]),
  rule(2, 8, "boat_stream", [
    [/upstream|downstream|boat and stream|speed of the (?:boat|stream)|नाव/, /धारा/],
    [/\d/, /speed/i, /km/i],
  ]),
  rule(2, 8, "lcm_hcf", [
    [/lcm|hcf|least common multiple|highest common factor|greatest common divisor|लघुत्तम|महत्तम/],
    [/\d/],
  ]),
  rule(2, 8, "number_system", [
    [/remainder (?:when|is|of)/i, /divisible by/i, /prime (?:number|factor)/i, /unit digit/i, /number of zeros/i, /factors? of \d/i, /संख्या पद्धति/],
    [/\d/],
  ]),
  rule(2, 6, "surds_indices", [
    [/surds?/i, /indices/i, /square root/i, /cube root/i, /radical/i, /घातांक/],
    [/\d/, /√/, /root/i],
  ]),
  rule(2, 7, "percentage", [
    [/percentage/i, /\d+\s?%\s?(?:of|-)/i, /प्रतिशतता/],
    [/\d/],
  ]),
];

export const QUANT_RULES_2 = [
  rule(2, 7, "algebra", [
    [/quadratic equation/i, /polynomial/i, /solve (?:for|the equation)/i, /if x\b/i, /algebraic/i, /बीजगणित/],
    [/x\b|=|\d/],
  ]),
  rule(2, 6, "sequence_series_quant", [
    [/arithmetic progression/i, /geometric progression/i, /nth term/i, /common difference/i, /समांतर श्रेणी/],
    [/\d/],
  ]),
  rule(2, 7, "trigonometry", [
    [/trigonometric|sin\b|cos\b|tan\b|sec\b|cosec|cot\b/i, /त्रिकोणमिति/],
    [/angle|degree|triangle|θ|theta|\d/],
  ]),
  rule(2, 7, "geometry", [
    [/area of (?:the )?(?:triangle|circle|square|rectangle|quadrilateral|polygon)/i, /perimeter/i, /circumference/i, /radius|diameter/i, /angle (?:of|between|is)/i, /pythagoras|theorem/i, /triangle|quadrilateral|polygon/i, /ज्यामिति/],
    [/\d|cm|degree|°/],
  ]),
  rule(2, 8, "mensuration", [
    [/volume of/i, /surface area/i, /curved surface/i, /cylinder|cone|sphere|hemisphere|cuboid/i, /slant height/i, /क्षेत्रमिति/],
    [/\d/, /cm|radius|height/i],
  ]),
  rule(2, 7, "data_interpretation", [
    [/data interpretation/i, /bar (?:graph|chart)/i, /pie chart/i, /line graph/i, /following (?:table|graph|chart)/i, /study the following/i],
  ]),
  rule(2, 6, "statistics_probability", [
    [/probability (?:that|of)/i, /standard deviation/i, /median of/i, /mode of/i, /variance/i, /frequency distribution/i, /प्रायिकता/],
    [/\d/],
  ]),
];

// ---------------------------------------------------------------------------
// General Awareness content rules: History (4)
// ---------------------------------------------------------------------------
export const HISTORY_RULES = [
  rule(4, 8, "ivc_harappan", [
    [/harappan|indus valley|mohenjo-?daro|harappa|lothal|dholavira|kalibangan|chanhu-?daro|great bath|citadel of|सिंधु घाटी/],
  ]),
  rule(4, 8, "vedic", [
    [/rigveda|rig veda|samaveda|yajurveda|atharvaveda|\bvedic\b|\bvedas\b|upanishad|purusha sukta|ऋग्वेद|वैदिक/],
  ]),
  rule(4, 8, "mahajanapadas", [
    [/mahajanapada|महाजनपद/, /magadha|kosala|vatsa|avanti|champa|vaishali|rajgriha|rajgir|मगध/],
  ]),
  rule(4, 8, "buddhism_jainism", [
    [/gautama buddha|lord buddha|buddh(?:ism|a)\b|lumbini|bodh ?gaya|sarnath|kushinagar|mahavira|jain(?:ism)?\b|tirthankara|buddhist (?:sangha|council)|nirvana|बौद्ध|जैन/],
  ]),
  rule(4, 8, "maurya_gupta", [
    [/maurya|chandragupta maurya|ashoka|ashokan|kautilya|chanakya|arthashastra|bindusara|gupta (?:empire|dynasty|period)|samudragupta|aryabhata|kalidasa|मौर्य|गुप्त/],
  ]),
  rule(4, 9, "delhi_sultanate", [
    [/delhi sultanate|slave dynasty|mamluk|qutb-?ud-?din aibak|qutub-?ud-?din aibak|iltutmish|balban|alauddin khilji|khilji|tughlaq|firoz shah|sayyid dynasty|lodi dynasty|ibn battuta|सल्तनत|गुलाम वंश|खिलजी|तुगलक/],
  ]),
  rule(4, 9, "mughal", [
    [/mughal|babur|humayun|akbar|jahangir|shah jahan|aurangzeb|tansen|mansabdari|din-?i-?ilahi|navaratna|panipat|abul fazl|मुगल|अकबर|शाहजहाँ|औरंगजेब/],
  ]),
  rule(4, 8, "maratha", [
    [/maratha|shivaji|peshwa|baji rao|balaji|sambhaji|ashtapradhan|मराठा|शिवाजी/],
  ]),
  rule(4, 7, "bhakti_sufi", [
    [/bhakti (?:movement|saint)|sufi (?:saint|movement)|kabir|guru nanak|mirabai|tulsidas|chaitanya|khwaja moinuddin|dargah|chishti|भक्ति|सूफी/],
  ]),
  rule(4, 8, "british_european", [
    [/east india company|british (?:rule|india|administration|raj)|viceroy|governor-?general|dupleix|plassey|buxar|battle of|regulating act|pitt'?s india act|doctrine of lapse|अंग्रेज|ईस्ट इंडिया/],
  ]),
  rule(4, 8, "revolt_1857", [
    [/revolt of 1857|sepoy (?:mutiny|revolt)|1857 (?:revolt|uprising)|mangal pandey|rani lakshmibai|bahadur shah zafar|विद्रोह/],
  ]),
  rule(4, 9, "national_movement", [
    [/indian national congress|inc session|swaraj|non-?cooperation|civil disobedience|quit india|dandi|salt march|khilafat|home rule|partition of bengal|jallianwala|rowlatt|round table|कांग्रेस|सविनय अवज्ञा|भारत छोड़ो/],
  ]),
  rule(4, 8, "gandhian", [
    [/mahatma gandhi|gandh(?:hi|ian)|poorna swaraj|satyagraha|champaran|kheda|sabarmati|harijan|गांधी|सत्याग्रह/],
  ]),
  rule(4, 7, "post_independence", [
    [/post.?independence|integration of states|sardar patel|princely state|hyderabad annexation|operation polo|linguistic reorganisation|स्वतंत्रता के बाद/],
  ]),
  rule(4, 7, "world_history", [
    [/world war (?:i|ii|1|2)|french revolution|russian revolution|american (?:revolution|war of independence)|cold war|renaissance|विश्व युद्ध/],
  ]),
  rule(4, 7, "prehistoric", [
    [/paleolithic|mesolithic|neolithic|chalcolithic|stone age|prehistoric|bhimbetka|cave painting|rock shelter|पाषाण युग/],
  ]),
];

// ---------------------------------------------------------------------------
// Polity (5)
// ---------------------------------------------------------------------------
export const POLITY_RULES = [
  rule(5, 9, "constitution", [
    [/indian constitution|constitution of india|constitutional (?:amendment|body|provision|assembly|framework|rights)/i, /\bthe constitution\b/i, /संविधान/],
  ]),
  rule(5, 9, "preamble_fr_dpsp", [
    [/preamble|प्रस्तावना/, /fundamental rights?|fundamental duties?|directive principles?|dpsp|right to equality|right to freedom|right against exploitation|right to constitutional remedies|मौलिक अधिकार|मूल कर्तव्य|नीति निदेशक/],
  ]),
  rule(5, 8, "articles_schedules", [
    [/article \d+[a-z]?/i, /schedule \d/i, /part \d+ of the constitution/i, /\barticle\b/i],
    [/constitution|rights|duties|amendment|अनुच्छेद/],
  ]),
  rule(5, 9, "parliament", [
    [/parliament|lok sabha|rajya sabha|speaker of the lok sabha|money bill|ordinary bill|no-?confidence|question hour|zero hour|संसद|लोकसभा|राज्यसभा/],
  ]),
  rule(5, 8, "president_pm", [
    [/president of india|vice-?president of india|prime minister|council of ministers|union cabinet|राष्ट्रपति|प्रधानमंत्री/],
  ]),
  rule(5, 8, "judiciary", [
    [/supreme court|high court|judiciary|chief justice|judicial review|\bwrit\b|habeas corpus|mandamus|certiorari|quo warranto|public interest litigation|\bpil\b|उच्चतम न्यायालय|न्यायपालिका/],
  ]),
  rule(5, 8, "local_government", [
    [/panchayat(?:i raj)?|73rd amendment|74th amendment|municipality|municipal corporation|gram sabha|zila parishad|panchayat samiti|local self.?government|पंचायत/],
  ]),
  rule(5, 7, "elections_ec", [
    [/election commission|chief election commissioner|electoral (?:roll|college)|adult franchise|delimitation|by-?election|निर्वाचन आयोग/],
  ]),
  rule(5, 7, "constitutional_bodies", [
    [/attorney general|comptroller and auditor general|\bcag\b|finance commission|union public service commission|\bupsc\b|public service commission|election commissioner|महान्यायवादी|नियंत्रक/],
  ]),
  rule(5, 7, "amendments", [
    [/\d+(?:st|nd|rd|th) (?:constitutional )?amendment/i, /amendment act/i, /42nd amendment|44th amendment|constitutional amendment/i, /संविधान संशोधन/],
  ]),
  rule(5, 6, "governor_states", [
    [/\bgovernor\b/i, /union and territory|state reorganisation|article 370|rajya.?sabha seat|राज्यपाल/],
    [/state|appointed|powers|article|राज्य/i],
  ]),
  rule(5, 6, "citizenship_emergency", [
    [/citizenship|national emergency|article 352|article 356|president'?s rule|financial emergency|नागरिकता|आपातकाल/],
  ]),
];

// ---------------------------------------------------------------------------
// Geography (6)
// ---------------------------------------------------------------------------
export const GEOGRAPHY_RULES = [
  rule(6, 8, "rivers_drainage", [
    [/tributar|drainage (?:system|basin)|catchment area|watershed|river basin|confluence|river (?:is|flows|originates|empties|rises)/i, /\bdelta\b|estuary|नदी|अपवाह/],
  ]),
  rule(6, 8, "mountains_plateaus", [
    [/himalaya|mountain range|aravalli|vindhya|satpura|western ghats|eastern ghats|nilgiri|shivalik|karakoram|plateau|peninsula|पर्वत|पठार/],
  ]),
  rule(6, 7, "climate_monsoon", [
    [/monsoon|rainfall|southwest monsoon|retreating monsoon|climate of|latitude|longitude|equator|tropic of cancer|standard time|time zone|मानसून|जलवायु/],
  ]),
  rule(6, 7, "soil_agriculture_geo", [
    [/alluvial soil|black soil|laterite soil|red soil|soil erosion|type of soil|soil (?:is|are|found|type)|kharif|rabi crop|crop season|cultivation of|मृदा|कृषि/],
  ]),
  rule(6, 8, "water_bodies", [
    [/wular|chilika|vembanad|pulicat|sambhar|gulf of|strait|bay of bengal|arabian sea|indian ocean|andaman|lakshadweep|island|झील|जलडमरूमध्य/],
  ]),
  rule(6, 8, "forests_wildlife_geo", [
    [/national park|wildlife sanctuary|biosphere reserve|tiger reserve|natural vegetation|forest cover|mangrove|sundarban|वन्यजीव|राष्ट्रीय उद्यान/],
  ]),
  rule(6, 7, "minerals_energy_geo", [
    [/iron ore|bauxite|mica|coal (?:field|mine|deposit)/i, /petroleum (?:reserve|field)/i, /natural gas|mineral (?:belt|resource)|खनिज/],
  ]),
  rule(6, 6, "landforms_hazards", [
    [/earthquake|volcano|seismic(?: zone)?|tsunami|glacial landform|landform|topography|भूकंप|ज्वालामुखी/],
  ]),
  rule(6, 6, "indian_geography_specific", [
    [/indian geography|in india|of india|भारत में/],
    [/river|mountain|plateau|soil|forest|state|district|region|नदी|पर्वत|राज्य/],
  ]),
  rule(6, 6, "world_geography", [
    [/which country|capital of [a-z]+|continent|largest (?:ocean|desert|continent|country)/i, /sahara|amazon|nile|andes|rockies|देश|महाद्वीप/],
  ]),
];

// ---------------------------------------------------------------------------
// Economy (7)
// ---------------------------------------------------------------------------
export const ECONOMY_RULES = [
  rule(7, 9, "national_income_gdp", [
    [/gross domestic product|\bgdp\b|gross national product|national income|per capita income|जीडीपी|राष्ट्रीय आय/],
  ]),
  rule(7, 9, "inflation", [
    [/inflation|deflation|consumer price index|\bcpi\b|wholesale price|\bwpi\b|मुद्रास्फीति/],
  ]),
  rule(7, 9, "rbi_monetary", [
    [/reserve bank of india|\brbi\b|monetary policy|repo rate|reverse repo|bank rate|cash reserve ratio|\bcrr\b|statutory liquidity ratio|\bslr\b|open market operation|भारतीय रिजर्व बैंक|मौद्रिक नीति/],
  ]),
  rule(7, 8, "budget_tax", [
    [/union budget|budget 20\d\d|interim budget|fiscal (?:deficit|policy)|revenue deficit|primary deficit|direct tax|indirect tax|income tax|goods and services tax|\bgst\b|taxation|tax (?:is|was|levied|imposed)|जीएसटी|आयकर|बजट/],
  ]),
  rule(7, 8, "planning_niti", [
    [/five year plan|niti aayog|planning commission|economic planning|पंचवर्षीय योजना|नीति आयोग/],
  ]),
  rule(7, 8, "banking_finance", [
    [/commercial bank|scheduled bank|cooperative bank|microfinance|financial inclusion|banking sector|nabard|बैंकिंग/],
  ]),
  rule(7, 8, "capital_market", [
    [/\bsebi\b|stock (?:market|exchange)|sensex|nifty|mutual fund|initial public offering|\bipo\b|share market|capital market|शेयर बाजार/],
  ]),
  rule(7, 8, "trade_forex", [
    [/balance of payment|current account deficit|trade deficit|foreign exchange|foreign direct investment|\bfdi\b|forex reserve|imports? and exports?|आयात|निर्यात/],
  ]),
  rule(7, 7, "poverty_employment", [
    [/poverty line|unemployment rate|mgnrega|poverty (?:ratio|alleviation)|मनरेगा|गरीबी/],
  ]),
  rule(7, 7, "reforms_schemes", [
    [/demonetisation|disinvestment|privatisation|liberalisation|make in india|startup india|economic reforms|उदारीकरण/],
  ]),
  rule(7, 6, "basic_economics", [
    [/demand and supply|law of demand|elasticity|market structure|monopoly|oligopoly|मांग/],
  ]),
];

// ---------------------------------------------------------------------------
// Physics (8)
// ---------------------------------------------------------------------------
export const PHYSICS_RULES = [
  rule(8, 9, "mechanics_motion", [
    [/newton'?s? (?:law|first|second|third)/i, /law of motion|inertia|acceleration|momentum|friction|gravitation|law of gravity/i, /velocity of|force (?:of|is|applied)/i, /गति के नियम|त्वरण|बल/],
  ]),
  rule(8, 9, "optics", [
    [/refraction|reflection|focal length|convex (?:lens|mirror)|concave (?:lens|mirror)|myopia|hypermetropia|presbyopia|prism|dispersion of light|optical (?:fibre|fiber|instrument)|अवतल|उत्तल|अपवर्तन|परावर्तन/],
  ]),
  rule(8, 8, "work_energy_power", [
    [/work (?:done|energy)|kinetic energy|potential energy|mechanical energy|conservation of energy|joule|horsepower|गतिज ऊर्जा|कार्य/],
  ]),
  rule(8, 8, "heat_thermo", [
    [/specific heat|latent heat|conduction|convection|thermal (?:expansion|conductivity)|boiling point|melting point|celsius|fahrenheit|kelvin|thermometer|ऊष्मा|तापमान/],
  ]),
  rule(8, 9, "electricity_magnetism", [
    [/electric current|potential difference|resistance|ohm'?s law|ammeter|voltmeter|electric (?:power|circuit|bulb|fuse)|magnetic field|electromagnet|solenoid|faraday|galvanometer|विद्युत|चुंबक/],
  ]),
  rule(8, 10, "modern_physics", [
    [/photoelectric|photovoltaic|semiconductor|transistor|diode|x-?ray|radioactiv|nuclear (?:fission|fusion)|modern physics/i, /परमाणु/],
  ]),
  rule(8, 8, "sound_waves", [
    [/sound wave|wavelength|echo|ultrasound|sonic boom|decibel|doppler (?:effect|shift)|whistle|pitch (?:of|changes)|ध्वनि/],
  ]),
  rule(8, 7, "units_measurement", [
    [/\bsi unit\b|unit of (?:measurement|force|energy|power|pressure|temperature)/i, /scalar|vector quantity|dimensional formula|मात्रक/],
  ]),
  rule(8, 7, "pressure_fluids", [
    [/atmospheric pressure|pascal|buoyancy|archimedes|float(?:s|ing) (?:in|on) water|density of (?:water|liquid)/i, /दाब|द्रव/],
  ]),
];

// ---------------------------------------------------------------------------
// Chemistry (9)
// ---------------------------------------------------------------------------
export const CHEMISTRY_RULES = [
  rule(9, 9, "atomic_structure", [
    [/atomic (?:number|mass|radius)|electron|proton|neutron|isotope|isobar|valenc(?:e|y)|shell (?:of|in) (?:an )?atom/i, /परमाणु|इलेक्ट्रॉन/],
  ]),
  rule(9, 9, "periodic_table", [
    [/periodic table|mendeleev|modern periodic|group \d+ element|alkali metal|noble gas|halogen|lanthanide|actinide|आवर्त सारणी/],
  ]),
  rule(9, 8, "chemical_bonding", [
    [/chemical bond|ionic bond|covalent bond|electrovalent|hydrogen bond|bond (?:is )?(?:formed|present)/i, /आयनिक|सहसंयोजक/],
  ]),
  rule(9, 9, "chemical_reactions", [
    [/chemical reaction|oxidation reaction|reduction reaction|\bredox\b|catalyst|combination reaction|decomposition reaction|displacement reaction|precipitation reaction|रासायनिक अभिक्रिया|उपचयन|अपचयन/],
  ]),
  rule(9, 9, "acids_bases_salts", [
    [/\bacid(?:s|ic)?\b|\balkali(?:ne)?\b|\bbases?\b[^.]{0,30}\bacid|acid[^.]{0,30}\bbases?\b|\bsalt(?:s)?\b[^.]{0,30}(?:acid|base|reaction)|\bph\b[^a-z]|neutralis|neutraliz|litmus|अम्ल|क्षार|लवण|उदासीनीकरण/],
  ]),
  rule(9, 8, "metals_nonmetals", [
    [/non-?metal|metalloid|alloy|amalgam|galvanis|galvaniz|corrosion|rusting of iron|धातु|मिश्रातु|जंग/],
  ]),
  rule(9, 8, "carbon_organic", [
    [/carbon compound|hydrocarbon|alkane|alkene|alkyne|ethanol|methane|benzene|organic chemistry|polymer|plastic|\bch4\b|\bc2h5oh\b|कार्बन/],
  ]),
  rule(9, 7, "chemical_formula", [
    [/chemical formula|molecular formula|chemical symbol|वैलेंसी|h2o|co2|nacl|h2so4|caco3/],
  ]),
  rule(9, 7, "daily_use_chemicals", [
    [/fertilizer|pesticide|detergent|bleaching powder|baking soda|washing soda|plaster of paris|cement|glass (?:is|making)|उर्वरक/],
  ]),
  rule(9, 6, "matter_states", [
    [/states? of matter|solid liquid gas|sublimation|colloid|suspension|पदार्थ की अवस्था/],
  ]),
];

// ---------------------------------------------------------------------------
// Biology (10)
// ---------------------------------------------------------------------------
export const BIOLOGY_RULES = [
  rule(10, 9, "human_body", [
    [/human (?:body|heart|brain|eye|ear|kidney|liver|lung|stomach|blood|skeleton)/i, /digest(?:ion|ive)|respirat(?:ion|ory)|circulat(?:ion|ory)|excret(?:ion|ory)|nervous system|endocrine|hormone|blood (?:group|pressure|vessel|circulation)|neuron|बहती है|रक्त|मानव शरीर/],
  ]),
  rule(10, 9, "cell_biology", [
    [/cell (?:wall|membrane|organelle|nucleus|division|theory)/i, /mitochondri|ribosome|chloroplast|prokaryot|eukaryot|mitosis|meiosis|कोशिका/],
  ]),
  rule(10, 9, "photosynthesis_plants", [
    [/photosynthes|chlorophyll|stomata|xylem|phloem|transpiration|plant (?:kingdom|hormone|tissue)/i, /प्रकाश संश्लेषण|पर्णहरित/],
  ]),
  rule(10, 9, "diseases_health", [
    [/deficiency (?:disease|of)|caused by (?:a )?(?:virus|bacteri|fungus|protozo)|vitamin [a-k]\b|disease (?:is caused|spread)/i, /malaria|dengue|tuberculosis|cholera|typhoid|polio|rabies|cancer|diabetes|रोग|विटामिन/],
  ]),
  rule(10, 8, "genetics_evolution", [
    [/\bgenes?\b[^.]{0,40}(?:is|are|for|pair|expression)|genetic (?:code|material|disorder|engineering|makeup)|\bdna\b|\brna\b|chromosome|heredity|mendel(?:'s|ian)|natural selection|darwin(?:'s|ian)|theory of evolution/i, /आनुवंशिकता|विकास/],
  ]),
  rule(10, 8, "ecology_environment", [
    [/ecosystem|food (?:chain|web)|biodiversity|biome|ecological pyramid|decomposer|greenhouse (?:gas|effect)|ozone (?:layer|depletion)|global warming|पारिस्थितिकी/],
  ]),
  rule(10, 8, "animal_kingdom", [
    [/animal (?:kingdom|ia|classified)|vertebrat|invertebrat|mammal(?:s|ia)|reptile|amphibian|arthropod|insect(?:s)?\b|phylum|जंतु/],
  ]),
  rule(10, 7, "microbiology", [
    [/bacteri(?:a|um|al)|virus(?:es)?\b|fungi|fungus|protozoa|algae|algae|pathogen|microorganis|सूक्ष्मजीव|जीवाणु|विषाणु/],
  ]),
  rule(10, 7, "nutrition_biology", [
    [/nutrient|balanced diet|protein|carbohydrate|fat(?:s)?\b|vitamin|mineral (?:deficiency|required)/i, /पोषण|प्रोटीन/],
  ]),
  rule(10, 6, "reproduction_biology", [
    [/reproduction|reproductive|fertilis|fertiliz|pollination|ovule|sperm|ovum|embryo|placenta|प्रजनन/],
  ]),
];

// ---------------------------------------------------------------------------
// Static GK (11) & Current Affairs (12) & Computer (13)
// ---------------------------------------------------------------------------
export const STATIC_GK_RULES = [
  rule(11, 9, "art_culture_dance", [
    [/bharatnatyam|kathak|kathakali|odissi|kuchipudi|manipuri|sattriya|mohiniyattam|classical dance|folk dance|paint(?:ing|ings) of|भरतनाट्यम|कथक|लोक नृत्य/],
  ]),
  rule(11, 9, "festivals_fairs", [
    [/festival (?:is|of|celebrated)|celebrated (?:in|by|on)|fair (?:is )?held|onam|pongal|bihu|baisakhi|hornbill|rongker|kumbh mela|मेला|त्योहार/],
  ]),
  rule(11, 9, "national_symbols", [
    [/national (?:symbol|emblem|anthem|song|bird|animal|flower|tree|fruit|game|river)/i, /जन गण मन|राष्ट्रीय प्रतीक|राष्ट्रीय ध्वज/],
  ]),
  rule(11, 8, "awards_honours", [
    [/bharat ratna|padma (?:vibhushan|bhushan|shri)|nobel prize|dronacharya|arjuna award|dada saheb phalke|gyanpith|jnanpith|oskar|grammy|पद्म|पुरस्कार/],
  ]),
  rule(11, 8, "books_authors", [
    [/authored by|written by|who wrote|book (?:is|was|entitled|titled)|autobiograph|पुस्तक|लेखक/],
  ]),
  rule(11, 8, "sports_trophies", [
    [/trophy|tournament|olympic|world cup|asian games|commonwealth games|ranji|durand cup|santosh trophy|kabaddi|kho-?kho|खेल|ट्रॉफी/],
  ]),
  rule(11, 8, "monuments_places", [
    [/unesco (?:world )?heritage|taj mahal|qutub minar|red fort|sanchi|hampi|khajuraho|konark|ajanta|ellora|monument (?:is|was|located)/i, /स्मारक|धरोहर/],
  ]),
  rule(11, 8, "first_superlatives", [
    [/first (?:indian|person|woman|president|prime minister) to|(?:largest|longest|highest|smallest|deepest|biggest) (?:river|lake|mountain|state|country|city|continent|desert|island|dam|temple)/i, /सबसे (?:बड़ा|बड़ी|लंबा|लंबी|ऊँचा|ऊँची)/],
  ]),
  rule(11, 7, "organizations_static", [
    [/world bank|imf|united nations|\bun\b|unesco|who|wto|saarc|brics|g20|asean|\bwho\b|संयुक्त राष्ट्र|विश्व बैंक/],
    [/headquarters|established in|founded in|member (?:countries|states)/i, /मुख्यालय|स्थापना/],
  ]),
  rule(11, 7, "days_years_static", [
    [/world (?:environment|health|water|literacy|day) day|national (?:science|mathematics|teachers) day|observed (?:on|every)|commemorat/i, /दिवस|दिन मनाया/],
  ]),
  rule(11, 7, "state_culture_specific", [
    [/state (?:of|has) .*(?:capital|language|dance|festival)|capital of (?:the )?state|असम|केरल|राज्य की राजधानी/],
  ]),
  rule(11, 6, "misc_gk_facts", [
    [/which of the following is (?:not )?(?:true|correct) about/i, /number of (?:districts|states|members) in/i],
  ]),
];

// ---------------------------------------------------------------------------
// Current Affairs (12) — news/recency evidence required.
// ---------------------------------------------------------------------------
export const RECENT_YEAR = /\b20(?:2[3-9]|3\d)\b/;

export const CURRENT_AFFAIRS_RULES = [
  rule(12, 9, "ca_schemes", [
    [/scheme (?:was|has been|is being) (?:launch|unveil|approv|introduc)/i, /pradhan mantri|pm-?kisan|ayushman bharat|jal jeevan mission|swachh bharat (?:mission|abhiyan)|beti bachao beti padhao|pm ?gati ?shakti/i, /योजना (?:शुरू|लॉन्च|शुभारंभ)/],
    [RECENT_YEAR, /launch|approv|introduc|announce|शुरू/],
  ]),
  rule(12, 9, "ca_space_technology", [
    [/isro|chandrayaan|gaganyaan|aditya-?l1|pslv|gslv|sslv|nasa|spacex|satellite (?:launch|mission)/i],
    [RECENT_YEAR, /launch|mission|successfully|भेजा/],
  ]),
  rule(12, 9, "ca_defence", [
    [/mitra shakti|malabar (?:exercise|naval)|varuna|garuda|yudh abhyas|indian (?:army|navy|air force).*(?:exercise|drill|test)/i, /missile (?:test|launch|system)|drdo/i, /defence (?:deal|exercise|ministry|system)/i],
    [RECENT_YEAR, /exercise|test|launch|deal|conducted|edition/],
  ]),
  rule(12, 9, "ca_summit_relations", [
    [/summit|bilateral (?:meeting|talks)|mou (?:was )?signed|g20|brics|sco\b|quad\b|joint (?:statement|exercise)/i],
    [RECENT_YEAR, /held|signed|hosted|participat|meeting/],
  ]),
  rule(12, 9, "ca_appointments", [
    [/appointed as|took (?:over|charge) as|elected as (?:the )?(?:president|chairman|director|ceo)|new (?:chief|ceo|chairman|governor) of/i],
    [RECENT_YEAR],
  ]),
  rule(12, 9, "ca_awards_recent", [
    [/conferred with (?:the )?|awarded the|received the .*(?:award|prize|honour)/i],
    [RECENT_YEAR],
  ]),
  rule(12, 8, "ca_sports_updates", [
    [/won (?:the )?(?:gold|silver|bronze) medal|world (?:championship|cup) (?:in|20\d\d)|olympic (?:medal|games 20\d\d)/i],
    [RECENT_YEAR],
  ]),
  rule(12, 8, "ca_budget_survey", [
    [/union budget 20\d\d|economic survey 20\d\d|interim budget/i],
  ]),
  rule(12, 8, "ca_national_events", [
    [/launched (?:the|a) |unveiled (?:the|a) |inaugurated (?:the|by) |flagged off|dedicated to the nation/i],
    [RECENT_YEAR],
  ]),
  rule(12, 7, "ca_recent_general", [
    [/20(?:2[3-9])\b/],
    [/exercis|launch|announc|approv|signed|hosted|held|passed|released|becom|conduct|summit|conference|appoint|award|medal|scheme|mission|rank|report|index/i],
  ]),
];

// ---------------------------------------------------------------------------
// Computer Knowledge (13)
// ---------------------------------------------------------------------------
export const COMPUTER_RULES = [
  rule(13, 9, "computer_hardware_io", [
    [/input device|output device|keyboard|mouse\b|printer|scanner|plotter|joystick|trackball|touch ?screen|light pen|microphone|taskbar|recycle bin|motherboard|microprocessor/i, /\bram\b (?:memory|is|of)|random access memory|\brom\b (?:memory|is)|read only memory|cpu (?:is|of|chip|speed)|arithmetic logic unit|control unit|memory (?:is|unit|chip|of|size)/i],
    [/device|computer|screen|output|input|display|memory|system|hardware|print|data|desktop|processor|storage/i],
  ]),
  rule(13, 9, "computer_software_os", [
    [/operating system|windows \d|linux|mac ?os|ms-?word|ms-?excel|powerpoint|spreadsheet|application software|system software|utility software|open source|proprietary software|third[- ]party software/i],
  ]),
  rule(13, 9, "computer_networking", [
    [/network topology|\blan\b|\bwan\b|modem|router|switch(?:es)?\b|ip address|http(?:s)?\b|\bftp\b|\btcp\b|\burl\b|web browser|web page|\bwww\b|e-?mail|protocol|server (?:is|that)|\bbandwidth\b|wi-?fi|internet (?:is|was|service)/i],
  ]),
  rule(13, 8, "computer_database", [
    [/database|dbms|\bsql\b|primary key|foreign key|record (?:in )?(?:a )?(?:table|database)|field (?:in )?(?:a )?(?:table|database)|normalis|normaliz/i],
  ]),
  rule(13, 8, "computer_security", [
    [/computer virus|malware|antivirus|firewall|hacking|hacker|phishing|cyber ?crime|encryption|strong password|spam (?:mail|email)?/i],
  ]),
  rule(13, 8, "computer_fundamentals", [
    [/generation of computer|abacus|pascaline|charles babbage|eniac|univac|first (?:electronic )?computer|binary (?:number|system)|hexadecimal|\bascii\b|data representation|kilobyte|megabyte|gigabyte|terabyte|computer (?:is|was) (?:invent|develop)/i],
    [/\bbits?\b|\bbytes?\b|\bmemory\b|computer|binary|data|number/i],
  ]),
  rule(13, 8, "computer_programming", [
    [/programming language|\bc\+\+\b|java\b|python\b|compiler|interpreter|algorithm|flowchart|source code|machine language|assembly language|loop (?:in )?program|\bhtml\b|\bcss\b|javascript/i],
  ]),
  rule(13, 7, "computer_ms_office", [
    [/ms-?office|ms-?word|ms-?excel|ms-?powerpoint|worksheet|cell (?:in )?(?:excel|spreadsheet)|slide (?:in )?powerpoint|shortcut key/i],
  ]),
];

// ---------------------------------------------------------------------------
// Evaluation engine
// ---------------------------------------------------------------------------

export const ALL_RULE_SETS = [
  ["reasoning", REASONING_RULES],
  ["english", ENGLISH_RULES],
  ["quant", QUANT_RULES],
  ["quant", QUANT_RULES_2],
  ["history", HISTORY_RULES],
  ["polity", POLITY_RULES],
  ["geography", GEOGRAPHY_RULES],
  ["economy", ECONOMY_RULES],
  ["physics", PHYSICS_RULES],
  ["chemistry", CHEMISTRY_RULES],
  ["biology", BIOLOGY_RULES],
  ["static_gk", STATIC_GK_RULES],
  ["current_affairs", CURRENT_AFFAIRS_RULES],
  ["computer", COMPUTER_RULES],
];

export const SECTION_SUBJECTS = {
  "general awareness": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  "general intelligence & reasoning": [1],
  "quantitative aptitude": [2],
  "english language": [3],
};

/**
 * English "task format" rules — when one of these matches the QUESTION STEM it is
 * a decisive language-exam signature (e.g. "rearrange the following sentences"),
 * and outranks topical words that merely appear inside the passage text.
 */
export const ENGLISH_FORMAT_RULES = new Set([
  "error_detection", "synonym_antonym", "one_word_substitution", "idioms_phrases",
  "active_passive", "direct_indirect", "sentence_rearrangement", "cloze_test",
  "fill_blanks", "sentence_improvement", "comprehension", "spelling",
  "parts_of_speech", "tenses_grammar", "vocabulary_context",
]);

/**
 * Subject pairs that are inherently ambiguous (recency-dependent). Moves between
 * these are reported separately rather than as hard misclassifications.
 */
export const BOUNDARY_PAIRS = new Set(["12:11", "11:12"]);

/**
 * Evaluate one rule set against the full text.
 * AND-of-OR semantics: every group must produce at least one hit.
 *
 * Evidence found in the QUESTION STEM is authoritative; evidence found only in
 * options / Hindi options / explanation is discounted (see effectiveWeight).
 * This is what stops distractors like the option word "vicereine" or the Hindi
 * word "करें" from reclassifying an English spelling question.
 */
export function evaluateRules(text, rules, stem) {
  const hits = [];
  const stemText = stem || "";
  for (const r of rules) {
    if (r.not && r.not.some((re) => re.test(text))) continue;
    const evidence = [];
    let ok = true;
    let allInStem = true;
    for (const group of r.groups) {
      let found = null;
      for (const re of group) {
        const m = text.match(re);
        if (m) {
          found = m[0];
          break;
        }
      }
      if (found === null) {
        ok = false;
        break;
      }
      if (allInStem && !group.some((re) => re.test(stemText))) allInStem = false;
      evidence.push(found.replace(/\s+/g, " ").trim().slice(0, 70));
    }
    if (ok) {
      hits.push({
        id: r.id,
        subject: r.subject,
        weight: r.weight,
        inStem: allInStem,
        effectiveWeight: allInStem ? r.weight : Math.max(1, r.weight - 3),
        evidence,
      });
    }
  }
  return hits;
}

function bestOf(hits) {
  if (!hits.length) return null;
  return hits.reduce((a, b) => (b.effectiveWeight > a.effectiveWeight ? b : a));
}

/**
 * Classify a question from FULL text (stem + options + explanation + Hindi).
 * Returns an auditable decision object.
 */
export function classifyQuestion(combined, stem, currentSubjectId, section) {
  const perSet = {};
  const contentHits = [];
  let reasoningHits = [];
  let englishHits = [];
  for (const [setName, rules] of ALL_RULE_SETS) {
    const hits = evaluateRules(combined, rules, stem);
    perSet[setName] = hits;
    if (setName === "reasoning") reasoningHits = hits;
    else if (setName === "english") englishHits = hits;
    else contentHits.push(...hits);
  }

  const bestReasoning = bestOf(reasoningHits);
  const bestEnglish = bestOf(englishHits);
  const bestContent = bestOf(contentHits);

  let decision;
  const allHits = [...contentHits, ...reasoningHits, ...englishHits];

  // 1. A reasoning FORMAT signature ("odd one out", "in a certain code") outranks
  //    topical keywords: "odd one out: chicken pox, rubella" is a Reasoning question.
  if (bestReasoning && bestReasoning.effectiveWeight >= 7 && (!bestContent || bestReasoning.effectiveWeight >= bestContent.effectiveWeight)) {
    decision = { subjectId: 1, ruleId: bestReasoning.id, ...bestReasoning, basis: "reasoning_format_signature" };
  }
  // 2. An English exam FORMAT signature in the STEM ("identify the misspelt word",
  //    "rearrange the following sentences", "convert into passive voice") is
  //    decisive — a passage/option can contain any topical words.
  else if (bestEnglish && bestEnglish.inStem && bestEnglish.effectiveWeight >= 7 && ENGLISH_FORMAT_RULES.has(bestEnglish.id) && (!bestContent || bestEnglish.effectiveWeight + 1 >= bestContent.effectiveWeight)) {
    decision = { subjectId: 3, ruleId: bestEnglish.id, ...bestEnglish, basis: "english_format_signature" };
  }
  // 3. Otherwise the strongest content rule wins.
  else if (bestContent) {
    decision = { subjectId: bestContent.subject, ruleId: bestContent.id, ...bestContent, basis: "content_rule" };
  } else if (bestEnglish) {
    decision = { subjectId: 3, ruleId: bestEnglish.id, ...bestEnglish, basis: "english_weak" };
  } else if (bestReasoning) {
    decision = { subjectId: 1, ruleId: bestReasoning.id, ...bestReasoning, basis: "reasoning_weak" };
  } else {
    return {
      subjectId: null,
      ruleId: null,
      weight: 0,
      effectiveWeight: 0,
      inStem: null,
      evidence: [],
      basis: "no_rule_matched",
      confidence: "none",
      sectionConsistent: null,
      alternatives: [],
      perSetStats: Object.fromEntries(Object.entries(perSet).map(([k, v]) => [k, v.length])),
    };
  }

  const expected = SECTION_SUBJECTS[String(section || "").trim().toLowerCase()] || null;
  const sectionConsistent = expected ? expected.includes(decision.subjectId) : null;
  const ew = decision.effectiveWeight || 0;
  const confidence = ew >= 8 ? "high" : ew >= 7 ? "medium" : "low";

  const alternatives = allHits
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight)
    .slice(0, 3)
    .map((h) => `S${h.subject}:${h.id}(${h.effectiveWeight}${h.inStem ? "" : ",opts"})`);

  return {
    subjectId: decision.subjectId,
    ruleId: decision.ruleId,
    weight: decision.weight,
    effectiveWeight: ew,
    inStem: decision.inStem,
    evidence: decision.evidence,
    basis: decision.basis,
    confidence,
    sectionConsistent,
    alternatives,
    perSetStats: Object.fromEntries(Object.entries(perSet).map(([k, v]) => [k, v.length])),
  };
}

// __APPEND__

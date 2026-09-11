/**
 * Question utility helpers
 */

/**
 * Builds the "exam name year stage date shift" label for previous-year questions.
 * Strictly respects the sequence: exam name -> year -> stage -> date -> shift.
 *
 * @param {Object} question - The question object
 * @param {Object} [sourceConfig] - Optional explicit source config JSONB
 * @param {string} [source] - Optional raw source string fallback
 * @returns {string|null} Formatted label, e.g. "SSC CGL 2024 Tier 1 09 Sep 2024 Shift 2"
 */
export function formatPyqSourceLabel(question, sourceConfig, source) {
  const sc =
    sourceConfig && typeof sourceConfig === "object"
      ? sourceConfig
      : question?.sourceConfig || question?.source_config || {};

  const q = question || {};

  // Candidate title strings that might contain exam / stage / date / shift details
  const candidateTitles = [
    q.testTitle,
    q.test_title,
    q.test?.title,
    sc.testTitle,
    sc.test_title,
    sc.title,
    typeof sc.rawSource === "string" ? sc.rawSource : null,
  ].filter((t) => typeof t === "string" && t.trim().length > 0);

  // 1. Exam Name
  let examName =
    sc.examName ||
    sc.exam_name ||
    sc.examTitle ||
    sc.exam ||
    q.examName ||
    q.exam_name ||
    q.exam ||
    "";

  if (
    !examName &&
    typeof sc.examId === "string" &&
    !sc.examId.startsWith("pyp_")
  ) {
    examName = sc.examId.replace(/[-_]/g, " ").toUpperCase();
  }

  // Filter out generic placeholders like "pyq" or "pyp"
  if (
    typeof examName === "string" &&
    /^(pyq|pyp|previous.?year)$/i.test(examName.trim())
  ) {
    examName = "";
  }

  if (!examName) {
    for (const text of candidateTitles) {
      const examMatch = text.match(
        /\b(SSC\s+(?:CGL|CHSL|MTS|CPO|GD|JE|Stenographer)|RRB\s+(?:NTPC|Group\s*D|JE|ALP)|UPSC\s+(?:CSE|CDS|NDA)|IBPS\s+(?:PO|Clerk|SO)|SBI\s+(?:PO|Clerk))\b/i,
      );
      if (examMatch) {
        examName = examMatch[1].toUpperCase();
        break;
      }
    }
  }

  // 2. Year
  let year = sc.year || q.year || q.pyqYear || q.pyq_year || "";

  if (!year) {
    for (const text of candidateTitles) {
      const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        year = yearMatch[1];
        break;
      }
    }
  }

  // 3. Stage (tier, paper, stageName)
  let stage = sc.stage || sc.tier || sc.stageName || q.stage || q.tier || "";

  if (!stage && typeof sc.paper === "string" && sc.paper.trim().length > 0) {
    stage = sc.paper.trim();
  }

  if (!stage) {
    for (const text of candidateTitles) {
      const stageMatch = text.match(
        /\b(Tier[-\s]?(?:[1-4]|I{1,3}|IV)|CBT[-\s]?[12]|Phase[-\s]?(?:[1-4]|I{1,3}|IV)|Stage[-\s]?(?:[1-4]|I{1,3}|IV)|Paper[-\s]?(?:[1-4]|I{1,3}|IV)|Prelims|Mains|Graduate|Undergraduate|UG)\b/i,
      );
      if (stageMatch) {
        let matched = stageMatch[1].trim();
        if (/^tier/i.test(matched)) {
          matched = matched.replace(/^tier[-\s]?/i, "Tier ");
        } else if (/^cbt/i.test(matched)) {
          matched = matched.replace(/^cbt[-\s]?/i, "CBT ");
        } else if (/^phase/i.test(matched)) {
          matched = matched.replace(/^phase[-\s]?/i, "Phase ");
        } else if (/^stage/i.test(matched)) {
          matched = matched.replace(/^stage[-\s]?/i, "Stage ");
        }
        stage = matched;
        break;
      }
    }
  }

  // 4. Date
  let date =
    sc.date ||
    sc.examDate ||
    sc.exam_date ||
    sc.testDate ||
    q.date ||
    q.examDate ||
    q.exam_date ||
    "";

  if (!date) {
    for (const text of candidateTitles) {
      const dmyMatch = text.match(
        /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{4})?)\b/i,
      );
      if (dmyMatch) {
        let extractedDate = dmyMatch[1].trim();
        if (!/\d{4}/.test(extractedDate) && year) {
          extractedDate = `${extractedDate} ${year}`;
        }
        date = extractedDate;
        break;
      }
      const slashMatch = text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
      if (slashMatch) {
        date = slashMatch[1].trim();
        break;
      }
      const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (isoMatch) {
        date = isoMatch[1].trim();
        break;
      }
    }
  }

  // 5. Shift
  let shift = sc.shift || sc.shiftName || q.shift || "";

  if (!shift) {
    for (const text of candidateTitles) {
      const shiftMatch = text.match(
        /\b(Shift[-\s]?(?:[1-4]|I{1,3}|IV|Morning|Evening|Afternoon))\b/i,
      );
      if (shiftMatch) {
        shift = shiftMatch[1].trim().replace(/^shift[-\s]?/i, "Shift ");
        break;
      }
      const timeShiftMatch = text.match(
        /\((\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))\)/i,
      );
      if (timeShiftMatch) {
        shift = timeShiftMatch[1].trim();
        break;
      }
    }
  }

  if (
    shift &&
    !String(shift).toLowerCase().includes("shift") &&
    !String(shift).includes("-") &&
    !String(shift).includes(":")
  ) {
    shift = `Shift ${shift}`;
  }

  // Fallback to raw source string if structured parts are sparse
  const rawSource =
    typeof source === "string"
      ? source
      : typeof q.source === "string"
        ? q.source
        : "";

  if (
    !examName &&
    !year &&
    !stage &&
    !date &&
    rawSource &&
    !/^(pyq|pyp)$/i.test(rawSource.trim())
  ) {
    return rawSource.trim();
  }

  // Format in exact requested sequence: exam name -> year -> stage -> date -> shift
  const parts = [];

  if (examName) {
    parts.push(String(examName).trim());
  }

  if (year) {
    const yearStr = String(year).trim();
    if (!examName || !examName.includes(yearStr)) {
      parts.push(yearStr);
    }
  }

  if (stage) {
    const stageStr = String(stage).trim();
    if (!parts.some((p) => p.toLowerCase().includes(stageStr.toLowerCase()))) {
      parts.push(stageStr);
    }
  }

  if (date) {
    const dateStr = String(date).trim();
    if (!parts.some((p) => p.toLowerCase().includes(dateStr.toLowerCase()))) {
      parts.push(dateStr);
    }
  }

  if (shift) {
    const shiftStr = String(shift).trim();
    if (!parts.some((p) => p.toLowerCase().includes(shiftStr.toLowerCase()))) {
      parts.push(shiftStr);
    }
  }

  return parts.length ? parts.join(" ") : null;
}

const fs = require('fs')

const filePath = 'e:\\Tech\\Testprep\\Trstprep V2.1\\apps\\backend\\src\\api\\routes\\study.js'
let content = fs.readFileSync(filePath, 'utf8')

// Replace calculateStudyMaterialCounts
const calcPattern = /async function calculateStudyMaterialCounts[\s\S]*?^}/m;
const countsNew = `async function calculateStudyMaterialCounts(dbHelpers, subject) {
  try {
    const subjectId = subject?.id ?? subject?._id
    
    let chaptersCount = 0
    let topicsCount = 0

    if (subjectId != null) {
      const chapters = await dbHelpers.find('chapters', { subjectId, isActive: true })
      chaptersCount = chapters.length
      
      if (chapters.length > 0) {
        const chapterIds = chapters.map(c => c.id ?? c._id).filter(id => id != null)
        const topics = await dbHelpers.find('topics', { chapterId: { $in: chapterIds }, isActive: true })
        topicsCount = topics.length
      }
    } else {
      const allTopics = await dbHelpers.find('topics', { subject: subject.name || subject, isActive: true })
      chaptersCount = allTopics.filter(t => !t.parentTopicId).length
      topicsCount = allTopics.filter(t => t.parentTopicId).length
    }

    const smId = subjectId || subject.name
    let videos = []
    let pdfs = []
    let topicTests = []
    if (smId != null) {
      ;[videos, pdfs, topicTests] = await Promise.all([
        dbHelpers.find('subjectVideos', { studyMaterialId: smId, isActive: true }),
        dbHelpers.find('subjectPdfs', { studyMaterialId: smId, isActive: true }),
        dbHelpers.find('topicTests', { studyMaterialId: smId, isActive: true }),
      ])
    }

    return {
      topics: topicsCount,
      chapters: chaptersCount,
      videos: videos.length,
      pdf: pdfs.length,
      tests: topicTests.length
    }
  } catch (error) {
    console.error('Error calculating counts:', error)
    return { topics: 0, chapters: 0, videos: 0, pdf: 0, tests: 0 }
  }
}`
if (calcPattern.test(content)) {
  content = content.replace(calcPattern, countsNew)
  console.log("calculateStudyMaterialCounts replaced")
} else {
  console.log("Could not find calculateStudyMaterialCounts")
}

// Replace resolveSubjectContent
const resolvePattern = /async function resolveSubjectContent[\s\S]*?(?:return \{\n\s*parts: \[\],\n\s*chapters: legacyChapters\n\s*\}\n\})/;
const resolveNew = `async function resolveSubjectContent(dbHelpers, subject) {
  const subjectId = subject?.id ?? subject?._id
  if (subjectId == null) {
    return { parts: [], chapters: [] }
  }

  // 1. Fetch parts directly
  let parts = await dbHelpers.find('subjectParts', { subjectId, isActive: true })
  
  // Try inherited parts if empty
  if (parts.length === 0 && subject.subjectGroup) {
    const allSubjects = await dbHelpers.find('subjects', {})
    const targetGroup = normalizeText(subject.subjectGroup)
    const candidates = allSubjects.filter(c => c.id !== subjectId && (normalizeText(c.name) === targetGroup || c.slug === toSlug(subject.subjectGroup)))
    
    for (const candidate of candidates) {
      const candidateParts = await dbHelpers.find('subjectParts', { subjectId: candidate.id, isActive: true })
      if (candidateParts.length > 0) {
        const keywords = getPartKeywords(subject)
        const matched = candidateParts.filter(p => {
          const pn = normalizeText(p.name)
          return keywords.some(k => pn.includes(k) || k.includes(pn))
        })
        parts = matched.length > 0 ? matched : candidateParts
        break
      }
    }
  }

  const units = await dbHelpers.find('units', { subjectId, isActive: true })
  const chapters = await dbHelpers.find('chapters', { subjectId, isActive: true })
  
  const chapterIdCandidates = [...new Set(chapters.flatMap(c => [c.id, c._id].filter(v => v != null && v !== '')))]
  const topics = chapterIdCandidates.length > 0 
    ? await dbHelpers.find('topics', { chapterId: { $in: chapterIdCandidates }, isActive: true })
    : []

  const { allVideos, allPdfs, allTests } = await loadSubjectMediaBundle(dbHelpers, subject)

  // 2. Build Chapters
  const enrichedChapters = chapters.map(chapter => {
    const chapterTopics = topics.filter(t => looseIdEquals(t.chapterId, chapter.id) || looseIdEquals(t.chapterId, chapter._id)).sort(sortByOrderAndId)
    
    const chapterKeySet = collectKeySet(chapter)
    const topicKeySet = new Set()
    for (const t of chapterTopics) {
      for (const k of collectKeySet(t)) topicKeySet.add(k)
    }

    const videos = allVideos.filter(v => assetBelongsToChapter(v, chapterKeySet, topicKeySet)).sort(sortByOrderAndId).map(mapVideoForClient)
    const pdfs = allPdfs.filter(p => assetBelongsToChapter(p, chapterKeySet, topicKeySet)).sort(sortByOrderAndId).map(mapPdfForClient)
    const tests = allTests.filter(t => assetBelongsToChapter(t, chapterKeySet, topicKeySet)).sort(sortByOrderAndId)

    return {
      ...chapter,
      title: chapter.title || chapter.name,
      topics: chapterTopics,
      topicCount: chapterTopics.length,
      videoCount: videos.length,
      pdfCount: pdfs.length,
      testCount: tests.length,
      videosList: videos,
      pdfsList: pdfs,
      testsList: tests,
    }
  }).sort(sortByOrderAndId)

  // 3. Build Units
  const enrichedUnits = units.map(unit => {
    const unitChapters = enrichedChapters.filter(c => looseIdEquals(c.unitId, unit.id) || looseIdEquals(c.unitId, unit._id))
    return {
      ...unit,
      chapters: unitChapters
    }
  }).sort(sortByOrderAndId)

  // 4. Handle orphaned chapters (no unit match)
  const chaptersWithUnit = new Set(enrichedUnits.flatMap(u => u.chapters).map(c => c.id))
  const orphanedChapters = enrichedChapters.filter(c => !chaptersWithUnit.has(c.id))
  
  if (orphanedChapters.length > 0) {
    enrichedUnits.push({
      id: 'general-unit',
      _id: 'general-unit',
      name: 'Additional Topics',
      slug: 'additional-topics',
      chapters: orphanedChapters,
      partId: null // Mark for general part
    })
  }

  // 5. Build Parts
  const enrichedParts = parts.map(part => {
    const partUnits = enrichedUnits.filter(u => looseIdEquals(u.partId, part.id) || looseIdEquals(u.partId, part._id))
    return {
      ...part,
      units: partUnits
    }
  }).sort(sortByOrderAndId)

  // 6. Handle orphaned units (no part match)
  const unitsWithPart = new Set(enrichedParts.flatMap(p => p.units).map(u => u.id))
  const orphanedUnits = enrichedUnits.filter(u => !unitsWithPart.has(u.id))
  
  if (orphanedUnits.length > 0) {
    enrichedParts.push({
      id: 'general-part',
      _id: 'general-part',
      name: 'Additional Contents',
      slug: 'additional-contents',
      units: orphanedUnits
    })
  }

  return {
    parts: enrichedParts,
    chapters: enrichedChapters
  }
}`

if (resolvePattern.test(content)) {
  content = content.replace(resolvePattern, resolveNew)
  console.log("resolveSubjectContent replaced")
} else {
  console.log("Could not find resolveSubjectContent")
}

fs.writeFileSync(filePath, content, 'utf8')

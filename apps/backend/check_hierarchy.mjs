import { dbHelpers } from './src/infrastructure/database/postgres-helpers.js'

function sortByOrderAndId(left, right) {
  const leftOrder = left?.orderIndex ?? left?.order ?? 0
  const rightOrder = right?.orderIndex ?? right?.order ?? 0
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return (left?.id ?? 0) - (right?.id ?? 0)
}

function collectKeySet(record) {
  const keys = new Set()
  if (!record || typeof record !== 'object') return keys
  for (const v of [record.id, record._id]) {
    if (v === undefined || v === null || v === '') continue
    keys.add(v)
    keys.add(String(v))
    if (typeof v === 'number' || (typeof v === 'string' && /^[0-9]+$/.test(String(v)))) {
      keys.add(parseInt(String(v), 10))
    }
  }
  return keys
}

function looseIdEquals(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  return String(a) === String(b)
}

function assetBelongsToChapter(asset, chapterKeySet, topicKeySet) {
  if (asset.chapterId != null && asset.chapterId !== '') {
    for (const k of chapterKeySet) {
      if (looseIdEquals(asset.chapterId, k)) return true
    }
  }
  if (asset.topicId != null && asset.topicId !== '') {
    for (const k of topicKeySet) {
      if (looseIdEquals(asset.topicId, k)) return true
    }
  }
  return false
}

async function getRobustHierarchy(subject) {
  // 1. Fetch all elements for this subject
  const parts = await dbHelpers.find('subjectParts', { subjectId: subject.id, isActive: true })
  const units = await dbHelpers.find('units', { subjectId: subject.id, isActive: true })
  const chapters = await dbHelpers.find('chapters', { subjectId: subject.id, isActive: true })
  
  const chapterIdCandidates = [...new Set(chapters.flatMap(c => [c.id, c._id].filter(v => v != null && v !== '')))]
  const topics = chapterIdCandidates.length > 0 
    ? await dbHelpers.find('topics', { chapterId: { $in: chapterIdCandidates }, isActive: true })
    : []

  // Media (dummy for script)
  const allVideos = []
  const allPdfs = []
  const allTests = []

  // 2. Build Chapters
  const chapterMap = new Map() // id -> enriched chapter
  const enrichedChapters = chapters.map(chapter => {
    const chapterTopics = topics.filter(t => looseIdEquals(t.chapterId, chapter.id) || looseIdEquals(t.chapterId, chapter._id)).sort(sortByOrderAndId)
    
    const chapterKeySet = collectKeySet(chapter)
    const topicKeySet = new Set()
    for (const t of chapterTopics) {
      for (const k of collectKeySet(t)) topicKeySet.add(k)
    }

    const videos = allVideos.filter(v => assetBelongsToChapter(v, chapterKeySet, topicKeySet)).sort(sortByOrderAndId)
    const pdfs = allPdfs.filter(p => assetBelongsToChapter(p, chapterKeySet, topicKeySet)).sort(sortByOrderAndId)
    const tests = allTests.filter(t => assetBelongsToChapter(t, chapterKeySet, topicKeySet)).sort(sortByOrderAndId)

    const enriched = {
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
    
    for (const k of collectKeySet(chapter)) chapterMap.set(k, enriched)
    return enriched
  }).sort(sortByOrderAndId)

  // 3. Build Units
  const unitMap = new Map()
  const enrichedUnits = units.map(unit => {
    // Find chapters for this unit
    const unitChapters = enrichedChapters.filter(c => looseIdEquals(c.unitId, unit.id) || looseIdEquals(c.unitId, unit._id))
    
    const enriched = {
      ...unit,
      chapters: unitChapters
    }
    for (const k of collectKeySet(unit)) unitMap.set(k, enriched)
    return enriched
  }).sort(sortByOrderAndId)

  // 4. Handle orphaned chapters (no unit match)
  const chaptersWithUnit = new Set(enrichedUnits.flatMap(u => u.chapters).map(c => c.id))
  const orphanedChapters = enrichedChapters.filter(c => !chaptersWithUnit.has(c.id))
  
  if (orphanedChapters.length > 0) {
    const generalUnit = {
      id: 'general-unit',
      _id: 'general-unit',
      name: 'General Topics',
      slug: 'general-topics',
      chapters: orphanedChapters,
      partId: null // Mark for general part
    }
    enrichedUnits.push(generalUnit)
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
    const generalPart = {
      id: 'general-part',
      _id: 'general-part',
      name: 'General',
      slug: 'general',
      units: orphanedUnits
    }
    enrichedParts.push(generalPart)
  }

  return {
    parts: enrichedParts,
    chapters: enrichedChapters
  }
}

async function run() {
  const subject = await dbHelpers.find('subjects', { id: 22 })
  if (subject.length) {
    const hierarchy = await getRobustHierarchy(subject[0])
    console.log("Parts:", hierarchy.parts.length)
    for (const p of hierarchy.parts) {
      console.log(` Part: ${p.name}`)
      for (const u of p.units) {
        console.log(`  Unit: ${u.name} (Chapters: ${u.chapters.length})`)
      }
    }
    console.log("Total chapters:", hierarchy.chapters.length)
    const totalTopics = hierarchy.chapters.reduce((sum, c) => sum + c.topicCount, 0)
    console.log("Total topics:", totalTopics)
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })

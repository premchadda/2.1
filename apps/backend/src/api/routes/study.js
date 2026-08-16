/**
 * Study Materials Public API Routes
 * 
 * ROUTING PATTERN: SLUG-FIRST WITH ID FALLBACK
 * =============================================
 * Public endpoints first try to find by 'slug' (SEO-friendly URLs),
 * then fall back to '_id' if slug is not found. This enables:
 * - SEO-friendly URLs like /study/reasoning, /study/quantitative-aptitude
 * - Backward compatibility when slug is missing (uses ID instead)
 * 
 * Available Routes:
 * - GET /api/study                    → List all study materials (public)
 * - GET /api/study/:slugOrId          → Get single material by slug (preferred) or ID (fallback)
 * - GET /api/study/:slugOrId/chapters → Get chapters for a material by slug or ID
 * 
 * Admin Routes (see admin.js):
 * - GET /api/admin/study-materials           → List all materials (admin)
 * - GET /api/admin/study-materials/:id       → Get by database ID (admin)
 * - POST /api/admin/study-materials          → Create new material
 * - PUT /api/admin/study-materials/:id       → Update by ID
 * - DELETE /api/admin/study-materials/:id    → Soft delete by ID
 * - PUT /api/admin/study-materials/:id/restore → Restore from trash
 * 
 * COLLECTION: studyMaterials
 * Fields: _id, name, slug, description, icon, isPro, isActive, order
 * 
 * Related Collections:
 * - chapters (linked via studyMaterialId)
 * - subjectVideos (linked via studyMaterialId)
 * - subjectPdfs (linked via studyMaterialId)
 * - topicTests (linked via studyMaterialId)
 */
import express from 'express'
import { findEntityByIdentifier } from '../../shared/utils/identifier-utils.js'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { responseCache } from '../../middleware/responseCache.middleware.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

// Memoized loader for the (rarely-changing) active study_materials table.
// Resolving media scope for every subject used to re-scan this whole table
// 2x per subject, which is the dominant cost behind the /api/study 504s.
let _studyMaterialsCache = null
let _studyMaterialsCacheTime = 0
const STUDY_MATERIALS_CACHE_TTL = 60 * 1000

async function getActiveStudyMaterials(dbHelpers) {
  const now = Date.now()
  if (_studyMaterialsCache && now - _studyMaterialsCacheTime < STUDY_MATERIALS_CACHE_TTL) {
    return _studyMaterialsCache
  }
  try {
    const all = await dbHelpers.find('studyMaterials', { isActive: true })
    _studyMaterialsCache = all
    _studyMaterialsCacheTime = now
    return all
  } catch (_) {
    return _studyMaterialsCache || []
  }
}

// Build the set of IDs a subject's media may be linked through (study_material_id
// OR chapter_id OR topic_id), using data that has already been bulk-loaded instead
// of issuing per-subject queries. Mirrors resolveSubjectMediaScope exactly.
function buildStudyMediaScope(subject, subjectId, studyMaterials, subjectChapterIds, topicIdsByChapter) {
  const idsToSearch = new Set()
  if (subjectId != null) {
    idsToSearch.add(subjectId)
    if (typeof subjectId === 'number' || (typeof subjectId === 'string' && /^\d+$/.test(String(subjectId)))) {
      idsToSearch.add(parseInt(String(subjectId), 10))
    }
  }

  const topicIds = new Set()
  for (const cid of subjectChapterIds) {
    const t = topicIdsByChapter.get(cid)
    if (t) for (const id of t) topicIds.add(id)
  }

  const subjectSlug = subject?.slug
  const subjectName = (subject?.name || subject?.title || '').toLowerCase().trim()
  for (const sm of studyMaterials) {
    const smSlug = sm.slug
    const smName = (sm.name || sm.title || '').toLowerCase().trim()
    if (
      (subjectSlug && smSlug && subjectSlug === smSlug) ||
      (subjectName && smName && subjectName === smName)
    ) {
      const matchId = sm.id ?? sm._id
      if (matchId != null && matchId !== '') {
        idsToSearch.add(matchId)
        idsToSearch.add(String(matchId))
      }
    }
  }

  return { idsToSearch, chapterIds: subjectChapterIds, topicIds: [...topicIds] }
}

// Helper function to calculate subject counts
// Resolve the full set of IDs that a subject's media may be linked through:
//  - the subject's own id (subjects table)
//  - matching study_materials ids (admin panel uses study_materials table)
//  - every chapter_id / topic_id belonging to the subject
// Media in subject_videos / subject_pdfs / topic_tests can be linked via any of
// these FK columns, so all must be searched to avoid missing/undercounting.
async function resolveSubjectMediaScope(dbHelpers, subject) {
  const subjectId = subject?.id ?? subject?._id
  const idsToSearch = new Set()
  const chapterIds = []
  const topicIds = []

  if (subjectId != null) {
    idsToSearch.add(subjectId)
    if (typeof subjectId === 'number' || (typeof subjectId === 'string' && /^\d+$/.test(String(subjectId)))) {
      idsToSearch.add(parseInt(String(subjectId), 10))
    }

    const chapters = await dbHelpers.find('chapters', { subjectId, isActive: true })
    for (const c of chapters) {
      const id = c.id ?? c._id
      if (id != null && id !== '') chapterIds.push(id)
    }
    if (chapterIds.length) {
      const topics = await dbHelpers.find('topics', { chapterId: { $in: chapterIds }, isActive: true })
      for (const t of topics) {
        const id = t.id ?? t._id
        if (id != null && id !== '') topicIds.push(id)
      }
    }
  } else {
    const allTopics = await dbHelpers.find('topics', { subject: subject.name || subject, isActive: true })
    for (const t of allTopics) {
      const id = t.id ?? t._id
      if (id != null && id !== '') topicIds.push(id)
    }
  }

  // Bridge to the admin study_materials table (matched by slug/name)
  try {
    const allStudyMaterials = await getActiveStudyMaterials(dbHelpers)
    const subjectSlug = subject?.slug
    const subjectName = (subject?.name || subject?.title || '').toLowerCase().trim()
    for (const sm of allStudyMaterials) {
      const smSlug = sm.slug
      const smName = (sm.name || sm.title || '').toLowerCase().trim()
      if (
        (subjectSlug && smSlug && subjectSlug === smSlug) ||
        (subjectName && smName && subjectName === smName)
      ) {
        const matchId = sm.id ?? sm._id
        if (matchId != null && matchId !== '') {
          idsToSearch.add(matchId)
          idsToSearch.add(String(matchId))
        }
      }
    }
  } catch (_) {
    // Non-fatal — proceed with the subject's own ID only
  }

  return { idsToSearch, chapterIds, topicIds }
}

// Count media linked to a subject via study_material_id OR chapter_id OR topic_id.
async function countMediaByScope(scope) {
  const { idsToSearch, chapterIds, topicIds } = scope
  const conds = []
  const vals = []
  let i = 1
  if (idsToSearch.size > 0) {
    const arr = [...idsToSearch]
    conds.push(`study_material_id IN (${arr.map(() => `$${i++}`).join(', ')})`)
    vals.push(...arr)
  }
  if (chapterIds.length > 0) {
    conds.push(`chapter_id IN (${chapterIds.map(() => `$${i++}`).join(', ')})`)
    vals.push(...chapterIds)
  }
  if (topicIds.length > 0) {
    conds.push(`topic_id IN (${topicIds.map(() => `$${i++}`).join(', ')})`)
    vals.push(...topicIds)
  }

  const where = conds.length > 0
    ? `(${conds.join(' OR ')}) AND is_active = true`
    : '1=0'

  const countTable = async (table) => {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table} WHERE ${where}`, vals)
      return rows[0]?.c || 0
    } catch (error) {
      console.error(`Error counting ${table}:`, error.message)
      return 0
    }
  }

  const [videos, pdfs, topicTests] = await Promise.all([
    countTable('subject_videos'),
    countTable('subject_pdfs'),
    countTable('topic_tests'),
  ])
  return { videos, pdfs, topicTests }
}

async function calculateStudyMaterialCounts(dbHelpers, subject) {
  try {
    const subjectId = subject?.id ?? subject?._id
    
    let chaptersCount = 0
    let topicsCount = 0

    if (subjectId != null) {
      // Modern robust counts from chapters and topics tables
      const chapters = await dbHelpers.find('chapters', { subjectId, isActive: true })
      chaptersCount = chapters.length
      
      if (chapters.length > 0) {
        const chapterIds = chapters.map(c => c.id ?? c._id).filter(id => id != null)
        const topics = await dbHelpers.find('topics', { chapterId: { $in: chapterIds }, isActive: true })
        topicsCount = topics.length
      }
    } else {
      // Legacy subjects fallback (very old data without IDs)
      const allTopics = await dbHelpers.find('topics', { subject: subject.name || subject, isActive: true })
      chaptersCount = allTopics.filter(t => !t.parentTopicId).length
      topicsCount = allTopics.filter(t => t.parentTopicId).length
    }

    // Count media by studyMaterialId, chapter_id, or topic_id (any link path)
    const scope = await resolveSubjectMediaScope(dbHelpers, subject)
    const { videos, pdfs, topicTests } = await countMediaByScope(scope)

    return {
      topics: topicsCount,
      chapters: chaptersCount,
      videos,
      pdf: pdfs,
      tests: topicTests
    }
  } catch (error) {
    console.error('Error calculating counts:', error)
    return { topics: 0, chapters: 0, videos: 0, pdf: 0, tests: 0 }
  }
}

// @route   GET /api/study
// @route   GET /api/study
// @desc    Get all study materials (subjects)
// @access  Public
router.get('/', responseCache("study-materials", 120), async (req, res) => {
  try {
    const [subjects, studyMaterials, allVideos, allPdfs, allTests] = await Promise.all([
      dbHelpers.find('subjects', { isActive: true }),
      getActiveStudyMaterials(dbHelpers),
      dbHelpers.find('subjectVideos', { isActive: true }).catch(() => []),
      dbHelpers.find('subjectPdfs', { isActive: true }).catch(() => []),
      dbHelpers.find('topicTests', { isActive: true }).catch(() => [])
    ])

    const subjectIds = subjects
      .map((s) => s.id ?? s._id)
      .filter((id) => id != null)

    const allChapters = subjectIds.length
      ? await dbHelpers.find('chapters', { subjectId: { $in: subjectIds }, isActive: true })
      : []

    const chapterIds = allChapters
      .map((c) => c.id ?? c._id)
      .filter((id) => id != null)

    const allTopics = chapterIds.length
      ? await dbHelpers.find('topics', { chapterId: { $in: chapterIds }, isActive: true })
      : []

    // Index chapters by subject and topics by chapter for O(1) lookup.
    const chaptersBySubject = new Map()
    for (const c of allChapters) {
      const sid = c.subjectId ?? c.subject_id
      if (sid == null) continue
      if (!chaptersBySubject.has(sid)) chaptersBySubject.set(sid, [])
      chaptersBySubject.get(sid).push(c)
    }

    const topicIdsByChapter = new Map()
    for (const t of allTopics) {
      const cid = t.chapterId ?? t.chapter_id
      if (cid == null) continue
      if (!topicIdsByChapter.has(cid)) topicIdsByChapter.set(cid, [])
      topicIdsByChapter.get(cid).push(t.id ?? t._id)
    }

    const materialsWithCounts = subjects.map((subject) => {
      const subjectId = subject.id ?? subject._id
      const subjectChapters = chaptersBySubject.get(subjectId) || []
      const subjectChapterIds = subjectChapters
        .map((c) => c.id ?? c._id)
        .filter((id) => id != null)

      let topicsCount = 0
      for (const cid of subjectChapterIds) {
        topicsCount += (topicIdsByChapter.get(cid) || []).length
      }

      const scope = buildStudyMediaScope(
        subject,
        subjectId,
        studyMaterials,
        subjectChapterIds,
        topicIdsByChapter,
      )

      const chapterIdSet = new Set(scope.chapterIds.map(String))
      scope.chapterIds.forEach(id => chapterIdSet.add(Number(id)))
      const topicIdSet = new Set(scope.topicIds.map(String))
      scope.topicIds.forEach(id => topicIdSet.add(Number(id)))

      const matchesScope = (item) => {
        const smId = item.study_material_id ?? item.studyMaterialId
        if (smId != null && scope.idsToSearch.has(smId)) return true
        const cId = item.chapter_id ?? item.chapterId
        if (cId != null && (chapterIdSet.has(cId) || chapterIdSet.has(String(cId)))) return true
        const tId = item.topic_id ?? item.topicId
        if (tId != null && (topicIdSet.has(tId) || topicIdSet.has(String(tId)))) return true
        return false
      }

      const videos = allVideos.filter(matchesScope).length
      const pdfs = allPdfs.filter(matchesScope).length
      const topicTests = allTests.filter(matchesScope).length

      return {
        _id: subject._id,
        slug: subject.slug,
        title: subject.name, // Mapping name to title for frontend
        icon: subject.icon,
        topics: topicsCount,
        chapters: subjectChapters.length,
        videos: videos,
        pdf: pdfs,
        tests: topicTests,
        color: subject.color,
        bg: subject.color + '20', // Generate bg from color
        description: subject.description,
        subjectGroup: subject.subjectGroup || null, // Group label (e.g. "General Science")
        order: subject.order || 0,
        isActive: subject.isActive,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt
      }
    })

    // Sort by order 
    materialsWithCounts.sort((a, b) => (a.order || 0) - (b.order || 0))

    res.json({
      success: true,
      count: materialsWithCounts.length,
      data: materialsWithCounts
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

const normalizeText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const toSlug = (value = '') => normalizeText(value).replace(/\s+/g, '-')
const isNumericString = (value) => typeof value === 'string' && /^[0-9]+$/.test(value)

const sortByOrderAndId = (left, right) => {
  const leftOrder = left?.orderIndex ?? left?.order ?? 0
  const rightOrder = right?.orderIndex ?? right?.order ?? 0
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return (left?.id ?? 0) - (right?.id ?? 0)
}

const flattenHierarchyChapters = (parts = []) => (
  parts.flatMap(part => (part.units || []).flatMap(unit => unit.chapters || []))
)

const PART_KEYWORD_OVERRIDES = {
  'advance-math': ['advance math', 'advance'],
  'arithmetic-maths': ['arithmetic maths', 'arithmetic'],
  biology: ['biology'],
  physics: ['physics'],
  chemistry: ['chemistry']
}

function getPartKeywords(subject) {
  const keywords = new Set()
  const normalizedName = normalizeText(subject?.name)
  const normalizedSlug = normalizeText(subject?.slug)

  if (normalizedName) keywords.add(normalizedName)
  if (normalizedSlug) keywords.add(normalizedSlug)

  const overrideKeywords = PART_KEYWORD_OVERRIDES[subject?.slug] || []
  overrideKeywords.forEach(keyword => keywords.add(normalizeText(keyword)))

  return [...keywords].filter(Boolean)
}

async function findSubjectBySlugOrId(dbHelpers, slugOrId) {
  // First try the legacy `subjects` table (slug or numeric ID)
  const found = await findEntityByIdentifier(dbHelpers, 'subjects', slugOrId, {
    slugFields: ['slug']
  })
  if (found) return found

  // Fall back to the `study_materials` table (admin-created entries)
  const sm = await findEntityByIdentifier(dbHelpers, 'studyMaterials', slugOrId, {
    slugFields: ['slug']
  })
  if (!sm) return null

  // Use the linked subject_id for content resolution (units, chapters, etc.)
  // study_materials.subject_id points to subjects.id which owns the curriculum
  const resolvedSubjectId = sm.subjectId || sm.subject_id || sm._id || sm.id

  // Normalize study_materials fields to match the subjects shape
  return {
    ...sm,
    name: sm.name || sm.title,
    title: sm.title || sm.name,
    // Use the linked subjects.id for content queries
    id: resolvedSubjectId,
    _id: resolvedSubjectId,
    // Keep original study_material ids for reference
    studyMaterialId: sm.id ?? sm._id,
    studyMaterialNumericId: sm._id ?? sm.id,
  }
}

function looseIdEquals(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  return String(a) === String(b)
}

/** All id shapes we compare against DB foreign keys (int / string drift). */
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

function mapVideoForClient(v) {
  return {
    ...v,
    url: v.videoUrl || v.url || '',
  }
}

function mapPdfForClient(p) {
  return {
    ...p,
    url: p.pdfUrl || p.url || '',
  }
}

function dedupeMediaRows(rows) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const id = row.id ?? row._id
    if (id == null) {
      out.push(row)
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    out.push(row)
  }
  return out
}

async function loadSubjectMediaBundle(dbHelpers, subject) {
  const smId = subject?.id ?? subject?._id
  let allVideos = []
  let allPdfs = []
  let allTests = []

  // Collect all IDs to search — the subject's own ID plus any matching study_material ID
  const idsToSearch = new Set()
  if (smId != null) idsToSearch.add(smId)
  if (typeof smId === 'number' || (typeof smId === 'string' && /^\d+$/.test(String(smId)))) {
    idsToSearch.add(parseInt(String(smId), 10))
  }
  // Also include original study_material IDs if this was resolved from study_materials
  if (subject?.studyMaterialNumericId != null) {
    idsToSearch.add(subject.studyMaterialNumericId)
    idsToSearch.add(String(subject.studyMaterialNumericId))
  }
  if (subject?.studyMaterialId != null) {
    idsToSearch.add(subject.studyMaterialId)
    idsToSearch.add(String(subject.studyMaterialId))
  }

  // Also find the matching study_material record (admin panel uses study_materials table)
  // This bridges the gap between the legacy subjects table and the admin study_materials table
  try {
    const allStudyMaterials = await getActiveStudyMaterials(dbHelpers)
    const subjectSlug = subject?.slug
    const subjectName = (subject?.name || subject?.title || '').toLowerCase().trim()

    for (const sm of allStudyMaterials) {
      const smSlug = sm.slug
      const smName = (sm.name || sm.title || '').toLowerCase().trim()
      if (
        (subjectSlug && smSlug && subjectSlug === smSlug) ||
        (subjectName && smName && subjectName === smName)
      ) {
        const matchId = sm.id ?? sm._id
        if (matchId != null) {
          idsToSearch.add(matchId)
          idsToSearch.add(String(matchId))
        }
      }
    }
  } catch (_) {
    // Non-fatal — proceed with the subject's own ID only
  }

  // Fetch media for all matching IDs in parallel, then dedupe
  const fetchForId = async (id) => {
    try {
      const [vids, pdfs, tests] = await Promise.all([
        dbHelpers.find('subjectVideos', { studyMaterialId: id, isActive: true }),
        dbHelpers.find('subjectPdfs', { studyMaterialId: id, isActive: true }),
        dbHelpers.find('topicTests', { studyMaterialId: id, isActive: true }),
      ])
      return { vids, pdfs, tests }
    } catch (_) {
      return { vids: [], pdfs: [], tests: [] }
    }
  }

  // Media may also be linked directly to a chapter or topic of this subject.
  const fetchByLink = async (field, ids) => {
    if (!ids || ids.length === 0) return { vids: [], pdfs: [], tests: [] }
    try {
      const [vids, pdfs, tests] = await Promise.all([
        dbHelpers.find('subjectVideos', { [field]: { $in: ids }, isActive: true }),
        dbHelpers.find('subjectPdfs', { [field]: { $in: ids }, isActive: true }),
        dbHelpers.find('topicTests', { [field]: { $in: ids }, isActive: true }),
      ])
      return { vids, pdfs, tests }
    } catch (_) {
      return { vids: [], pdfs: [], tests: [] }
    }
  }

  if (idsToSearch.size > 0) {
    const results = await Promise.all([...idsToSearch].map(fetchForId))
    for (const { vids, pdfs, tests } of results) {
      allVideos.push(...vids)
      allPdfs.push(...pdfs)
      allTests.push(...tests)
    }
  }

  // Resolve the subject's chapter/topic IDs so chapter- and topic-linked media is included
  const { chapterIds, topicIds } = await resolveSubjectMediaScope(dbHelpers, subject)
  const linkResults = [
    await fetchByLink('chapterId', chapterIds),
    await fetchByLink('topicId', topicIds),
  ]
  for (const { vids, pdfs, tests } of linkResults) {
    allVideos.push(...vids)
    allPdfs.push(...pdfs)
    allTests.push(...tests)
  }

  // Deduplicate by id
  allVideos = dedupeMediaRows(allVideos)
  allPdfs = dedupeMediaRows(allPdfs)
  allTests = dedupeMediaRows(allTests)

  // NOTE: subject_videos and subject_pdfs do NOT have a 'subject' text column.
  // Media is linked exclusively via study_material_id. The secondary subject-name
  // query that used to run here caused 'column "subject" does not exist' errors.

  return { allVideos, allPdfs, allTests }
}

async function enrichLegacyChaptersWithMedia(dbHelpers, subject, chapters) {
  if (!chapters?.length) return chapters

  const { allVideos, allPdfs, allTests } = await loadSubjectMediaBundle(dbHelpers, subject)
  if (allVideos.length === 0 && allPdfs.length === 0 && allTests.length === 0) return chapters

  return chapters.map((chapter) => {
    const chapterKeySet = collectKeySet(chapter)
    const topicKeySet = new Set()
    for (const t of chapter.topics || []) {
      for (const k of collectKeySet(t)) topicKeySet.add(k)
    }

    const videos = allVideos
      .filter((v) => assetBelongsToChapter(v, chapterKeySet, topicKeySet))
      .sort(sortByOrderAndId)
      .map(mapVideoForClient)
    const pdfs = allPdfs
      .filter((p) => assetBelongsToChapter(p, chapterKeySet, topicKeySet))
      .sort(sortByOrderAndId)
      .map(mapPdfForClient)
    const tests = allTests
      .filter((t) => assetBelongsToChapter(t, chapterKeySet, topicKeySet))
      .sort(sortByOrderAndId)

    return {
      ...chapter,
      videoCount: videos.length,
      pdfCount: pdfs.length,
      testCount: tests.length,
      videosList: videos,
      pdfsList: pdfs,
      testsList: tests,
    }
  })
}

async function buildHierarchyFromParts(dbHelpers, parts, subject) {
  const { allVideos, allPdfs, allTests } = await loadSubjectMediaBundle(dbHelpers, subject)

  const sortedParts = [...parts].sort(sortByOrderAndId)

  return Promise.all(sortedParts.map(async (part) => {
    const units = (await dbHelpers.find('units', {
      partId: part.id,
      isActive: true
    })).sort(sortByOrderAndId)

    const hierarchicalUnits = await Promise.all(units.map(async (unit) => {
      const chapters = (await dbHelpers.find('chapters', {
        unitId: unit.id,
        isActive: true
      })).sort(sortByOrderAndId)

      const hierarchicalChapters = await Promise.all(chapters.map(async (chapter) => {
        const chapterIdCandidates = [...new Set([chapter.id, chapter._id].filter((v) => v != null && v !== ''))]
        const topics = chapterIdCandidates.length
          ? (await dbHelpers.find('topics', {
              chapterId: { $in: chapterIdCandidates },
              isActive: true,
            })).sort(sortByOrderAndId)
          : []

        const chapterKeySet = collectKeySet(chapter)
        const topicKeySet = new Set()
        for (const t of topics) {
          for (const k of collectKeySet(t)) topicKeySet.add(k)
        }

        const videos = allVideos
          .filter((v) => assetBelongsToChapter(v, chapterKeySet, topicKeySet))
          .sort(sortByOrderAndId)
          .map(mapVideoForClient)
        const pdfs = allPdfs
          .filter((p) => assetBelongsToChapter(p, chapterKeySet, topicKeySet))
          .sort(sortByOrderAndId)
          .map(mapPdfForClient)
        const topicTests = allTests
          .filter((t) => assetBelongsToChapter(t, chapterKeySet, topicKeySet))
          .sort(sortByOrderAndId)

        return {
          ...chapter,
          title: chapter.title || chapter.name,
          topics,
          topicCount: topics.length,
          videoCount: videos.length,
          pdfCount: pdfs.length,
          testCount: topicTests.length,
          videosList: videos,
          pdfsList: pdfs,
          testsList: topicTests,
        }
      }))

      return {
        ...unit,
        chapters: hierarchicalChapters
      }
    }))

    return {
      ...part,
      units: hierarchicalUnits
    }
  }))
}

function buildLegacyChaptersFromTopics(allTopics = []) {
  const chapters = allTopics.filter(topic => !topic.parentTopicId).sort(sortByOrderAndId)
  const chapterTopics = allTopics.filter(topic => topic.parentTopicId)

  return chapters.map(chapter => {
    const chapterId = chapter.id ?? chapter._id
    const relatedTopics = chapterTopics.filter(topic => String(topic.parentTopicId) === String(chapterId))

    return {
      ...chapter,
      title: chapter.title || chapter.name,
      topics: relatedTopics,
      topicCount: relatedTopics.length,
      videoCount: chapter.videoCount || chapter.videos || 0,
      pdfCount: chapter.pdfCount || chapter.pdfs || 0,
      testCount: chapter.testCount || chapter.tests || 0,
      videosList: [],
      pdfsList: [],
      testsList: []
    }
  })
}

async function buildLegacySubjectChapters(dbHelpers, subject) {
  let allTopics = await dbHelpers.find('topics', {
    subject: subject.name,
    isActive: true
  })

  if (allTopics.length === 0 && subject.subjectGroup) {
    allTopics = await dbHelpers.find('topics', {
      subject: subject.subjectGroup,
      isActive: true
    })
  }

  const base = buildLegacyChaptersFromTopics(allTopics)
  return enrichLegacyChaptersWithMedia(dbHelpers, subject, base)
}

async function findInheritedParts(dbHelpers, subject) {
  if (!subject.subjectGroup) return []

  const allSubjects = await dbHelpers.find('subjects', {})
  const targetGroupName = normalizeText(subject.subjectGroup)
  const targetGroupSlug = toSlug(subject.subjectGroup)

  const candidates = allSubjects.filter(candidate =>
    candidate.id !== subject.id && (
      normalizeText(candidate.name) === targetGroupName ||
      candidate.slug === targetGroupSlug
    )
  )

  for (const candidate of candidates) {
    const candidateParts = await dbHelpers.find('subjectParts', {
      subjectId: candidate.id,
      isActive: true
    })

    if (candidateParts.length === 0) continue

    const partKeywords = getPartKeywords(subject)
    const filteredParts = candidateParts.filter(part => {
      const partName = normalizeText(part.name)
      return partKeywords.some(keyword => partName.includes(keyword) || keyword.includes(partName))
    })

    return filteredParts.length > 0 ? filteredParts : candidateParts
  }

  return []
}

async function resolveSubjectContent(dbHelpers, subject) {
  const subjectId = subject?.id ?? subject?._id
  if (subjectId == null) {
    return { units: [], chapters: [] }
  }

  // Filter out soft-deleted units and chapters
  const allUnits = await dbHelpers.find('units', { subjectId, isActive: true })
  const units = allUnits.filter(u => u.isDeleted !== true && u.is_deleted !== true)
  
  const allChapters = await dbHelpers.find('chapters', { subjectId, isActive: true })
  const chapters = allChapters.filter(c => c.isDeleted !== true && c.is_deleted !== true)
  
  const chapterIdCandidates = [...new Set(chapters.flatMap(c => [c.id, c._id].filter(v => v != null && v !== '')))]
  const allTopics = chapterIdCandidates.length > 0 
    ? await dbHelpers.find('topics', { chapterId: { $in: chapterIdCandidates }, isActive: true })
    : []
  const topics = allTopics.filter(t => t.isDeleted !== true && t.is_deleted !== true)

  const { allVideos, allPdfs, allTests } = await loadSubjectMediaBundle(dbHelpers, subject)

  // 1. Build Chapters
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

  // 2. Build Units
  const enrichedUnits = units.map(unit => {
    const unitChapters = enrichedChapters.filter(c => looseIdEquals(c.unitId, unit.id) || looseIdEquals(c.unitId, unit._id))
    return {
      ...unit,
      chapters: unitChapters
    }
  }).sort(sortByOrderAndId)

  // 3. Handle orphaned chapters (no unit match)
  const chaptersWithUnit = new Set(enrichedUnits.flatMap(u => u.chapters).map(c => c.id))
  const orphanedChapters = enrichedChapters.filter(c => !chaptersWithUnit.has(c.id))
  
  if (orphanedChapters.length > 0) {
    enrichedUnits.push({
      id: 'general-unit',
      _id: 'general-unit',
      name: 'Additional Topics',
      slug: 'additional-topics',
      chapters: orphanedChapters
    })
  }

  return {
    units: enrichedUnits,
    chapters: enrichedChapters
  }
}

function mapChapterSummary(chapter) {
  return {
    _id: chapter._id ?? chapter.id,
    id: chapter.id ?? chapter._id,
    title: chapter.title || chapter.name,
    description: chapter.description,
    videos: chapter.videoCount || chapter.videos || chapter.videosList?.length || 0,
    pdfs: chapter.pdfCount || chapter.pdfs || chapter.pdfsList?.length || 0,
    duration: chapter.duration || 0,
    order: chapter.orderIndex ?? chapter.order ?? 0,
    isActive: chapter.isActive,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt
  }
}

// @route   GET /api/study/:slugOrId
// @desc    Get study material by slug or ID with full hierarchy
// @access  Public
router.get('/:slugOrId', async (req, res) => {
  try {
    const { slugOrId } = req.params
    const material = await findSubjectBySlugOrId(dbHelpers, slugOrId)

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
      })
    }

    const counts = await calculateStudyMaterialCounts(dbHelpers, material)
    const resolvedContent = await resolveSubjectContent(dbHelpers, material)
    const allChapters = resolvedContent.chapters

    // Load ALL media for this subject (including admin-uploaded PDFs/videos)
    const { allVideos, allPdfs, allTests } = await loadSubjectMediaBundle(dbHelpers, material)

    // Find media not matched to any chapter in the resolved hierarchy
    const matchedVideoIds = new Set(allChapters.flatMap(c => (c.videosList || []).map(v => String(v.id ?? v._id))))
    const matchedPdfIds   = new Set(allChapters.flatMap(c => (c.pdfsList  || []).map(p => String(p.id ?? p._id))))
    const matchedTestIds  = new Set(allChapters.flatMap(c => (c.testsList  || []).map(t => String(t.id ?? t._id))))

    const unmatchedVideos = allVideos.filter(v => !matchedVideoIds.has(String(v.id ?? v._id))).map(mapVideoForClient)
    const unmatchedPdfs   = allPdfs.filter(p   => !matchedPdfIds.has(String(p.id ?? p._id))).map(mapPdfForClient)
    const unmatchedTests  = allTests.filter(t  => !matchedTestIds.has(String(t.id ?? t._id)))

    const hasUnmatched = unmatchedVideos.length > 0 || unmatchedPdfs.length > 0 || unmatchedTests.length > 0

    // Build the synthetic "General" chapter for unmatched media
    const generalChapter = hasUnmatched ? {
      id: 'general',
      _id: 'general',
      title: 'General',
      name: 'General',
      description: 'Content not assigned to a specific chapter',
      videoCount: unmatchedVideos.length,
      pdfCount: unmatchedPdfs.length,
      testCount: unmatchedTests.length,
      videosList: unmatchedVideos,
      pdfsList: unmatchedPdfs,
      testsList: unmatchedTests,
      topics: [],
    } : null

    const finalChapters = generalChapter ? [...allChapters, generalChapter] : allChapters

    // Build the units array for the frontend, injecting the general chapter as an extra unit if needed
    let finalUnits = resolvedContent.units || []
    if (generalChapter) {
      finalUnits = [...finalUnits, {
        id: 'general-unit',
        _id: 'general-unit',
        name: 'Additional Content',
        slug: 'additional-content',
        chapters: [generalChapter],
      }]
    }

    // Build legacy `parts` wrapper from the units for backward compatibility
    const finalParts = finalUnits.length > 0
      ? [{ id: 'main', name: null, units: finalUnits }]
      : []

    res.json({
      success: true,
      data: {
        ...material,
        title: material.name || material.title,
        topics: counts.topics,
        chaptersCount: finalChapters.length || counts.chapters,
        videos: allVideos.length || counts.videos,
        pdf: allPdfs.length || counts.pdf,
        tests: allTests.length || counts.tests,
        bg: (material.color || '#667eea') + '20',
        chapters: finalChapters,   // flat list (used by fallback view)
        units: finalUnits,         // unit hierarchy with nested chapters
        parts: finalParts,         // legacy parts wrapper (hierarchy view)
        // Subject-level lists for direct rendering
        videosList: allVideos.map(mapVideoForClient),
        pdfsList: allPdfs.map(mapPdfForClient),
        testsList: allTests,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/videos/hierarchical
// @desc    Get all videos organized by subject-chapter-topic hierarchy
// @access  Public
router.get('/videos/hierarchical', responseCache("study-videos-hierarchical", 120), async (req, res) => {
  try {
    // Use a single SQL query with CTEs to fetch everything in one round-trip
    const { rows: hierarchicalData } = await pool.query(`
      WITH active_subjects AS (
        SELECT id, name, slug, icon, color, description, sort_order
        FROM subjects WHERE is_active = true AND (is_deleted IS NOT TRUE)
      ),
      active_chapters AS (
        SELECT id, title, slug, description, subject_id, order_index
        FROM subject_chapters WHERE is_active = true AND (is_deleted IS NOT TRUE)
      ),
      active_topics AS (
        SELECT id, name, slug, description, subject_id, chapter_id, order_index
        FROM subject_topics WHERE is_active = true AND (is_deleted IS NOT TRUE)
      ),
      active_videos AS (
        SELECT id, title, slug, description, video_url, thumbnail, duration,
               order_index, is_pro, chapter_id, topic_id, created_at, public_id
        FROM subject_videos WHERE is_active = true AND (is_deleted IS NOT TRUE)
      ),
      subject_stats AS (
        SELECT s.id AS subject_id, s.name, s.slug, s.icon, s.color, s.description, s.sort_order,
               (
                 SELECT COUNT(*)::int FROM active_videos v
                 LEFT JOIN active_chapters ch ON v.chapter_id = ch.id
                 LEFT JOIN active_topics tp ON v.topic_id = tp.id
                 WHERE ch.subject_id = s.id OR tp.subject_id = s.id
               ) AS total_videos
        FROM active_subjects s
      ),
      chapter_data AS (
        SELECT ch.subject_id,
               json_agg(
                 json_build_object(
                   'id', ch.id, '_id', ch.id, 'title', ch.title, 'slug', ch.slug,
                   'description', ch.description,
                   'videoCount', (
                     SELECT COUNT(*)::int FROM active_videos v WHERE v.chapter_id = ch.id
                   ),
                   'videos', (
                     SELECT COALESCE(json_agg(
                       json_build_object(
                         'id', v.id, '_id', v.id, 'publicId', v.public_id, 'title', v.title, 'slug', v.slug,
                         'description', v.description, 'videoUrl', v.video_url,
                         'thumbnail', v.thumbnail, 'duration', v.duration,
                         'isPro', v.is_pro, 'isFree', NOT v.is_pro,
                         'instructor', 'Expert Faculty', 'views', 0,
                         'createdAt', v.created_at
                       ) ORDER BY v.order_index, v.id
                     ), '[]'::json)
                      FROM active_videos v WHERE v.chapter_id = ch.id AND v.topic_id IS NULL
                   ),
                   'topics', (
                     SELECT COALESCE(json_agg(
                       json_build_object(
                         'id', tp.id, '_id', tp.id, 'title', tp.name, 'slug', tp.slug,
                         'description', tp.description,
                         'videoCount', (
                           SELECT COUNT(*)::int FROM active_videos v WHERE v.topic_id = tp.id
                         ),
                         'videos', (
                           SELECT COALESCE(json_agg(
                             json_build_object(
                               'id', v.id, '_id', v.id, 'publicId', v.public_id, 'title', v.title, 'slug', v.slug,
                               'description', v.description, 'videoUrl', v.video_url,
                               'thumbnail', v.thumbnail, 'duration', v.duration,
                               'isPro', v.is_pro, 'isFree', NOT v.is_pro,
                               'instructor', 'Expert Faculty', 'views', 0,
                               'createdAt', v.created_at
                             ) ORDER BY v.order_index, v.id
                           ), '[]'::json)
                           FROM active_videos v WHERE v.topic_id = tp.id
                         )
                       ) ORDER BY tp.order_index, tp.id
                     ), '[]'::json)
                     FROM active_topics tp WHERE tp.chapter_id = ch.id
                   )
                 ) ORDER BY ch.order_index, ch.id
               ) AS chapters_json
        FROM active_chapters ch
        WHERE EXISTS (SELECT 1 FROM active_videos v WHERE v.chapter_id = ch.id)
           OR EXISTS (
             SELECT 1 FROM active_topics tp
             WHERE tp.chapter_id = ch.id
               AND EXISTS (SELECT 1 FROM active_videos v WHERE v.topic_id = tp.id)
           )
        GROUP BY ch.subject_id
      ),
      unassigned_data AS (
        SELECT COALESCE(ch.subject_id, tp.subject_id) AS subject_id,
               json_agg(
                 json_build_object(
                   'id', v.id, '_id', v.id, 'publicId', v.public_id, 'title', v.title, 'slug', v.slug,
                   'description', v.description, 'videoUrl', v.video_url,
                   'thumbnail', v.thumbnail, 'duration', v.duration,
                   'isPro', v.is_pro, 'isFree', NOT v.is_pro,
                   'instructor', 'Expert Faculty', 'views', 0,
                   'createdAt', v.created_at
                 ) ORDER BY v.order_index, v.id
               ) AS unassigned_json
        FROM active_videos v
        LEFT JOIN active_chapters ch ON v.chapter_id = ch.id
        LEFT JOIN active_topics tp ON v.topic_id = tp.id
        WHERE v.chapter_id IS NULL AND v.topic_id IS NULL
        GROUP BY COALESCE(ch.subject_id, tp.subject_id)
      )
      SELECT json_agg(
        json_build_object(
          'id', ss.subject_id, '_id', ss.subject_id, 'title', ss.name, 'slug', ss.slug,
          'icon', ss.icon, 'color', ss.color, 'description', ss.description,
          'totalVideos', ss.total_videos,
          'chapters', COALESCE(cd.chapters_json, '[]'::json),
          'unassignedVideos', COALESCE(ud.unassigned_json, '[]'::json)
        ) ORDER BY ss.sort_order, ss.name
      ) AS data
      FROM subject_stats ss
      LEFT JOIN chapter_data cd ON cd.subject_id = ss.subject_id
      LEFT JOIN unassigned_data ud ON ud.subject_id = ss.subject_id
    `)

    const result = hierarchicalData[0]?.data || []

    res.json({
      success: true,
      count: result.length,
      data: result
    })
  } catch (error) {
    console.error('Error fetching hierarchical videos:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

// @route   GET /api/study/:slugOrId/chapters
// @desc    Get chapters for a subject by slug or ID
// @access  Public
router.get('/:slugOrId/chapters', async (req, res) => {
  try {
    const { slugOrId } = req.params
    const material = await findSubjectBySlugOrId(dbHelpers, slugOrId)

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found',
      })
    }

    const resolvedContent = await resolveSubjectContent(dbHelpers, material)
    const chapters = resolvedContent.chapters

    res.json({
      success: true,
      count: chapters.length,
      data: chapters.map(mapChapterSummary),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

export default router

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

const router = express.Router()

// Helper function to calculate subject counts
async function calculateStudyMaterialCounts(dbHelpers, subject) {
  try {
    // Count chapters (topics where parentTopic is null)
    const allTopics = await dbHelpers.find('topics', { subject: subject.name || subject, isActive: true })
    const chapters = allTopics.filter(t => !t.parentTopicId)
    const topics = allTopics.filter(t => t.parentTopicId)

    // Count media by studyMaterialId (the subject column does not exist on these tables)
    const smId = subject?.id ?? subject?._id
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
      topics: topics.length,
      chapters: chapters.length,
      videos: videos.length,
      pdf: pdfs.length,
      tests: topicTests.length
    }
  } catch (error) {
    console.error('Error calculating counts:', error)
    return { topics: 0, chapters: 0, videos: 0, pdf: 0, tests: 0 }
  }
}

// @route   GET /api/study
// @desc    Get all study materials (subjects)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const subjects = await global.dbHelpers.find('subjects', { isActive: true })
    
    // Calculate actual counts for each material
    const materialsWithCounts = await Promise.all(
      subjects.map(async (subject) => {
        const counts = await calculateStudyMaterialCounts(global.dbHelpers, subject)
        const resolvedContent = await resolveSubjectContent(global.dbHelpers, subject)
        return {
          _id: subject._id,
          slug: subject.slug,
          title: subject.name, // Mapping name to title for frontend
          icon: subject.icon,
          topics: counts.topics,
          chapters: resolvedContent.chapters.length || counts.chapters,
          videos: counts.videos,
          pdf: counts.pdf,
          tests: counts.tests,
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
    )

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
      message: error.message,
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

  // Normalize study_materials fields to match the subjects shape
  return {
    ...sm,
    name: sm.name || sm.title,
    title: sm.title || sm.name,
    // Ensure both id shapes are present for downstream helpers
    id: sm.id ?? sm._id,
    _id: sm._id ?? sm.id,
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

  // Also find the matching study_material record (admin panel uses study_materials table)
  // This bridges the gap between the legacy subjects table and the admin study_materials table
  try {
    const allStudyMaterials = await dbHelpers.find('studyMaterials', { isActive: true })
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

  if (idsToSearch.size > 0) {
    const results = await Promise.all([...idsToSearch].map(fetchForId))
    for (const { vids, pdfs, tests } of results) {
      allVideos.push(...vids)
      allPdfs.push(...pdfs)
      allTests.push(...tests)
    }
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
  let parts = await dbHelpers.find('subjectParts', {
    subjectId: subject.id,
    isActive: true
  })

  if (parts.length === 0) {
    parts = await findInheritedParts(dbHelpers, subject)
  }

  const hierarchy = await buildHierarchyFromParts(dbHelpers, parts, subject)
  const hierarchyChapters = flattenHierarchyChapters(hierarchy)

  if (hierarchyChapters.length > 0) {
    return { parts: hierarchy, chapters: hierarchyChapters }
  }

  const legacyChapters = await buildLegacySubjectChapters(dbHelpers, subject)
  return {
    parts: [],
    chapters: legacyChapters
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
    const material = await findSubjectBySlugOrId(global.dbHelpers, slugOrId)

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
      })
    }

    const counts = await calculateStudyMaterialCounts(global.dbHelpers, material)
    const resolvedContent = await resolveSubjectContent(global.dbHelpers, material)
    const allChapters = resolvedContent.chapters

    // Load ALL media for this subject (including admin-uploaded PDFs/videos)
    const { allVideos, allPdfs, allTests } = await loadSubjectMediaBundle(global.dbHelpers, material)

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

    // Inject unmatched content into the parts hierarchy so the hierarchy view renders it.
    // We add it as a synthetic Part → Unit → Chapter so it appears regardless of view mode.
    let finalParts = resolvedContent.parts || []
    if (generalChapter) {
      const syntheticPart = {
        id: 'general-part',
        _id: 'general-part',
        name: 'Additional Content',
        slug: 'additional-content',
        units: [{
          id: 'general-unit',
          _id: 'general-unit',
          name: 'Additional Content',
          slug: 'additional-content',
          chapters: [generalChapter],
        }],
      }
      finalParts = [...finalParts, syntheticPart]
    }

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
        parts: finalParts,          // hierarchical structure (used by hierarchy view)
        // Subject-level lists for direct rendering
        videosList: allVideos.map(mapVideoForClient),
        pdfsList: allPdfs.map(mapPdfForClient),
        testsList: allTests,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/videos/hierarchical
// @desc    Get all videos organized by subject-chapter-topic hierarchy
// @access  Public
router.get('/videos/hierarchical', async (req, res) => {
  try {
    // Get all active subjects
    const subjects = await global.dbHelpers.find('subjects', { isActive: true })
    
    // Get all videos from subjectVideos collection
    const allVideos = await global.dbHelpers.find('subjectVideos', { isActive: true })
    
    // Get all topics (chapters)
    const allTopics = await global.dbHelpers.find('topics', { isActive: true })
    
    // Build hierarchical structure
    const hierarchicalData = subjects.map(subject => {
      // Get chapters for this subject (topics without parentTopicId)
      const subjectChapters = allTopics.filter(t => 
        t.subject === subject.name && !t.parentTopicId
      )
      
      // Get topics for this subject (topics with parentTopicId)
      const subjectTopics = allTopics.filter(t => 
        t.subject === subject.name && t.parentTopicId
      )
      
      // Get videos for this subject
      const subjectVideos = allVideos.filter(v => 
        v.subject === subject.name || v.studyMaterialId === subject._id
      )
      
      // Build chapters with their topics and videos
      const chaptersWithContent = subjectChapters.map(chapter => {
        const chapterVideos = subjectVideos.filter(v => 
          v.chapterId === chapter._id || v.chapterId === chapter.id
        )
        
        // Get topics under this chapter
        const chapterTopics = subjectTopics.filter(t => 
          t.parentTopicId === chapter._id || t.parentTopicId === chapter.id
        )
        
        // Build topics with their videos
        const topicsWithVideos = chapterTopics.map(topic => {
          const topicVideos = subjectVideos.filter(v => 
            v.topicId === topic._id || v.topicId === topic.id
          )
          
          return {
            _id: topic._id,
            id: topic.id,
            title: topic.name,
            slug: topic.slug,
            description: topic.description,
            videoCount: topicVideos.length,
            videos: topicVideos.map(v => ({
              _id: v._id,
              id: v.id,
              title: v.title,
              slug: v.slug,
              description: v.description,
              videoUrl: v.videoUrl,
              thumbnail: v.thumbnail,
              duration: v.duration,
              isPro: v.isPro,
              isFree: !v.isPro,
              instructor: v.instructor || 'Expert Faculty',
              views: v.views || 0
            }))
          }
        })
        
        return {
          _id: chapter._id,
          id: chapter.id,
          title: chapter.name,
          slug: chapter.slug,
          description: chapter.description,
          icon: chapter.icon,
          videoCount: chapterVideos.length,
          videos: chapterVideos.map(v => ({
            _id: v._id,
            id: v.id,
            title: v.title,
            slug: v.slug,
            description: v.description,
            videoUrl: v.videoUrl,
            thumbnail: v.thumbnail,
            duration: v.duration,
            isPro: v.isPro,
            isFree: !v.isPro,
            instructor: v.instructor || 'Expert Faculty',
            views: v.views || 0
          })),
          topics: topicsWithVideos
        }
      })
      
      return {
        _id: subject._id,
        id: subject.id,
        title: subject.name,
        slug: subject.slug,
        icon: subject.icon,
        color: subject.color,
        description: subject.description,
        subjectGroup: subject.subjectGroup || null,
        totalVideos: subjectVideos.length,
        chapters: chaptersWithContent,
        // Videos not assigned to any chapter
        unassignedVideos: subjectVideos
          .filter(v => !v.chapterId)
          .map(v => ({
            _id: v._id,
            id: v.id,
            title: v.title,
            slug: v.slug,
            description: v.description,
            videoUrl: v.videoUrl,
            thumbnail: v.thumbnail,
            duration: v.duration,
            isPro: v.isPro,
            isFree: !v.isPro,
            instructor: v.instructor || 'Expert Faculty',
            views: v.views || 0
          }))
      }
    }).filter(subject => subject.totalVideos > 0 || subject.chapters.length > 0)
    
    res.json({
      success: true,
      count: hierarchicalData.length,
      data: hierarchicalData
    })
  } catch (error) {
    console.error('Error fetching hierarchical videos:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   GET /api/study/:slugOrId/chapters
// @desc    Get chapters for a subject by slug or ID
// @access  Public
router.get('/:slugOrId/chapters', async (req, res) => {
  try {
    const { slugOrId } = req.params
    const material = await findSubjectBySlugOrId(global.dbHelpers, slugOrId)

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found',
      })
    }

    const resolvedContent = await resolveSubjectContent(global.dbHelpers, material)
    const chapters = resolvedContent.chapters

    res.json({
      success: true,
      count: chapters.length,
      data: chapters.map(mapChapterSummary),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

export default router

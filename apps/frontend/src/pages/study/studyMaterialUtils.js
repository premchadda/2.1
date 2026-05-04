const normalizeText = (value = '') => String(value ?? '').trim().toLowerCase()

export function resolveChapterIndex(chapters = [], chapter, fallbackIndex = -1) {
  if (!Array.isArray(chapters) || !chapter) return fallbackIndex

  const targetIdentifiers = [chapter.slug, chapter._id, chapter.id]
    .filter(value => value !== undefined && value !== null && value !== '')
    .map(String)

  if (targetIdentifiers.length > 0) {
    const matchedIndex = chapters.findIndex(item => {
      const itemIdentifiers = [item?.slug, item?._id, item?.id]
        .filter(value => value !== undefined && value !== null && value !== '')
        .map(String)

      return itemIdentifiers.some(identifier => targetIdentifiers.includes(identifier))
    })

    if (matchedIndex !== -1) return matchedIndex
  }

  const targetTitle = normalizeText(chapter.title || chapter.name)
  if (targetTitle) {
    const matchedIndex = chapters.findIndex(item => normalizeText(item?.title || item?.name) === targetTitle)
    if (matchedIndex !== -1) return matchedIndex
  }

  return fallbackIndex
}

export function getChapterIdentifier(chapter, chapters = [], fallbackIndex = -1) {
  const explicitIdentifier = chapter?.slug || chapter?._id || chapter?.id
  if (explicitIdentifier !== undefined && explicitIdentifier !== null && explicitIdentifier !== '') {
    return explicitIdentifier
  }

  const resolvedIndex = resolveChapterIndex(chapters, chapter, fallbackIndex)
  return resolvedIndex >= 0 ? resolvedIndex : fallbackIndex
}

export function getChapterPath(subjectId, chapter, chapters = [], fallbackIndex = -1) {
  return `/study/${subjectId}/${getChapterIdentifier(chapter, chapters, fallbackIndex)}`
}

export function matchesChapterIdentifier(chapter, targetIdentifier, chapters = [], fallbackIndex = -1) {
  const normalizedTarget = String(targetIdentifier)
  const resolvedIndex = resolveChapterIndex(chapters, chapter, fallbackIndex)

  return [
    chapter?.slug,
    chapter?._id,
    chapter?.id,
    resolvedIndex >= 0 ? resolvedIndex : null,
  ]
    .filter(value => value !== undefined && value !== null && value !== '')
    .map(String)
    .includes(normalizedTarget)
}

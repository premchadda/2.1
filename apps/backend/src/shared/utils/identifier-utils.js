import { parseNumericId } from './db-utils.js'

const LEGACY_OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/

export const getInternalId = (record) => {
  if (!record || typeof record !== 'object') return null
  return record.id ?? record._id ?? null
}

export async function findEntityByIdentifier(dbHelpers, collection, identifier, options = {}) {
  const { slugFields = [] } = options

  if (!dbHelpers || identifier === undefined || identifier === null) {
    return null
  }

  if (typeof identifier === 'number' && Number.isFinite(identifier)) {
    return dbHelpers.findById(collection, identifier)
  }

  if (typeof identifier !== 'string') {
    return null
  }

  const normalizedIdentifier = identifier.trim()
  if (!normalizedIdentifier) {
    return null
  }

  const entityType = dbHelpers.getTableName?.(collection) || collection

  if (dbHelpers.isValidPublicId?.(normalizedIdentifier, entityType)) {
    const byPublicId = await dbHelpers.findByPublicId(collection, normalizedIdentifier)
    if (byPublicId) {
      return byPublicId
    }
  }

  const numericId = parseNumericId(normalizedIdentifier)
  if (numericId !== null) {
    const byId = await dbHelpers.findById(collection, numericId)
    if (byId) {
      return byId
    }
  }

  for (const field of slugFields) {
    // Try case-insensitive match for fields like 'slug'
    const byField = await dbHelpers.findOne(collection, { [field]: normalizedIdentifier })
    if (byField) {
      return byField
    }
    
    // Fallback: search for case-insensitive match if the DB helper supports it or by manual find
    if (typeof normalizedIdentifier === 'string') {
      const allRecords = await dbHelpers.find(collection, {})
      const caseInsensitiveMatch = allRecords.find(r => 
        String(r[field] || '').toLowerCase() === normalizedIdentifier.toLowerCase()
      )
      if (caseInsensitiveMatch) return caseInsensitiveMatch
    }
  }

  if (LEGACY_OBJECT_ID_PATTERN.test(normalizedIdentifier)) {
    const records = await dbHelpers.find(collection, {})
    const byLegacyObjectId = records.find((record) => String(record?._id) === normalizedIdentifier)
    if (byLegacyObjectId) {
      return byLegacyObjectId
    }
  }

  return null
}

export async function resolveInternalIdByIdentifier(dbHelpers, collection, identifier, options = {}) {
  const entity = await findEntityByIdentifier(dbHelpers, collection, identifier, options)
  return getInternalId(entity)
}

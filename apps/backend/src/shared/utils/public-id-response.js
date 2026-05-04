import { parseNumericId } from './db-utils.js'

const sanitizeIdentifierFields = (record, options = {}) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record
  }

  const cleaned = { ...record }

  if (options.keepPublicId !== true) {
    delete cleaned.publicId
  }

  if (options.keepInternalId !== true) {
    delete cleaned._id
    delete cleaned.publicIdUuid
    delete cleaned.public_id_uuid
    delete cleaned._legacyId
    delete cleaned._publicId
  }

  return cleaned
}

export function serializeEntityForResponse(dbHelpers, collection, record, options = {}) {
  if (!record || typeof record !== 'object') {
    return record
  }

  const entityType = dbHelpers?.getTableName?.(collection) || collection
  const allowFallback = options.allowFallback !== false

  try {
    const serialized = dbHelpers?.toApi
      ? dbHelpers.toApi(record, entityType, { allowFallback })
      : record

    return sanitizeIdentifierFields(serialized, options)
  } catch {
    return sanitizeIdentifierFields(record, options)
  }
}

export function getPublicResponseId(dbHelpers, collection, recordOrValue, fallback = null) {
  if (recordOrValue === undefined || recordOrValue === null) {
    return fallback
  }

  if (typeof recordOrValue === 'string') {
    const trimmed = recordOrValue.trim()
    if (!trimmed) {
      return fallback
    }

    const entityType = dbHelpers?.getTableName?.(collection) || collection
    if (dbHelpers?.isValidPublicId?.(trimmed, entityType)) {
      return trimmed
    }

    const numeric = parseNumericId(trimmed)
    return numeric ?? fallback ?? trimmed
  }

  if (typeof recordOrValue === 'number') {
    return fallback ?? recordOrValue
  }

  const serialized = serializeEntityForResponse(dbHelpers, collection, recordOrValue, {
    allowFallback: true
  })

  return serialized?.id ?? fallback
}

export async function buildPublicIdLookup(dbHelpers, collection, ids = []) {
  const numericIds = Array.from(
    new Set(
      ids
        .map((value) => parseNumericId(value))
        .filter((value) => value !== null)
    )
  )

  if (numericIds.length === 0) {
    return new Map()
  }

  const records = await dbHelpers.find(collection, {
    id: { $in: numericIds }
  })

  const lookup = new Map()
  for (const record of records) {
    const internalId = parseNumericId(record?.id ?? record?._id)
    if (internalId === null) {
      continue
    }

    lookup.set(String(internalId), getPublicResponseId(dbHelpers, collection, record, internalId))
  }

  return lookup
}

export function mapLookupId(value, lookup, fallback = value) {
  if (value === undefined || value === null) {
    return fallback
  }

  return lookup.get(String(value)) ?? fallback
}

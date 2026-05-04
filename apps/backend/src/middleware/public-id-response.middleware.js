const isPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const transformPayload = (value, shouldUsePublicId) => {
  if (Array.isArray(value)) {
    return value.map((item) => transformPayload(item, shouldUsePublicId))
  }

  if (!isPlainObject(value)) {
    return value
  }

  const transformed = {}

  for (const [key, childValue] of Object.entries(value)) {
    if (key === 'publicIdUuid' || key === 'public_id_uuid') {
      continue
    }

    if (key === 'publicId' && typeof childValue === 'string') {
      continue
    }

    if (key === '_publicId' || key === '_legacyId') {
      continue
    }

    // CRITICAL: We preserve _id for relationship mapping in the admin panel
    // Keep internal mapping for now to avoid breaking existing UI components
    /*
    if (shouldUsePublicId && key === '_id') {
      continue
    }
    */

    transformed[key] = transformPayload(childValue, shouldUsePublicId)
  }

  if (shouldUsePublicId && typeof value.publicId === 'string' && value.publicId.trim()) {
    transformed.id = value.publicId
  }

  return transformed
}

export function publicIdResponseMiddleware(req, res, next) {
  const originalJson = res.json.bind(res)

  res.json = (body) => {
    const shouldUsePublicId = global.dbHelpers?.shouldUsePublicId?.() !== false
    return originalJson(transformPayload(body, shouldUsePublicId))
  }

  next()
}

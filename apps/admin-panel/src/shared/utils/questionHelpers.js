export const idsEqual = (a, b) => {
  if (a === b) return true
  if (a == null || b == null) return false
  return String(a) === String(b)
}

export const getEntityId = (item) => item?._id ?? item?.id ?? null

export const coerceArray = (value) => {
  if (Array.isArray(value)) return value
  if (value !== null && value !== undefined && typeof value !== 'string') return [value]
  if (typeof value !== 'string' || !value.trim()) return []
  const trimmed = value.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).split(',').map(part => part.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  }
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return trimmed.split(',').map(part => part.trim()).filter(Boolean)
  }
}

export const flattenCategories = (categories = []) => {
  const flattened = []
  const walk = (items, parentId = '') => {
    items.forEach(item => {
      const id = getEntityId(item)
      flattened.push({ ...item, parentId: item.parentId ?? item.parent_id ?? parentId })
      if (Array.isArray(item.children) && item.children.length > 0) walk(item.children, id)
    })
  }
  walk(Array.isArray(categories) ? categories : [])
  return flattened
}

export const normalizeKey = (str) =>
  String(str ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const refsFrom = (values) => {
  const refs = new Set()
  values.filter(Boolean).forEach(value => {
    refs.add(String(value))
    refs.add(normalizeKey(value))
  })
  return refs
}

export const buildCategorySelectionRefs = (categoryId, flatCategories = []) => {
  if (!categoryId) return new Set()
  const refs = refsFrom([categoryId])
  const seed = flatCategories.find(cat =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .some(value => idsEqual(value, categoryId))
  )
  if (!seed) return refs
  ;[seed.id, seed._id, seed.slug, seed.name, seed.label, seed.categoryId]
    .filter(Boolean)
    .forEach(value => {
      refs.add(String(value))
      refs.add(normalizeKey(value))
    })
  const childrenByParent = new Map()
  flatCategories.forEach(cat => {
    const key = String(cat.parentId || cat.parent_id || '')
    if (!childrenByParent.has(key)) childrenByParent.set(key, [])
    childrenByParent.get(key).push(cat)
  })
  const queue = [...(childrenByParent.get(String(getEntityId(seed) || '')) || [])]
  const seen = new Set([String(getEntityId(seed) || seed.categoryId || seed.slug || seed.name || categoryId)])
  while (queue.length > 0) {
    const cat = queue.shift()
    const id = String(getEntityId(cat) || cat.categoryId || cat.slug || cat.name || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    ;[cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })
    ;(childrenByParent.get(String(getEntityId(cat) || '')) || []).forEach(child => queue.push(child))
  }
  return refs
}

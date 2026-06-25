export function slugify(input) {
  if (input == null) return ''
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export function toSlug(input) {
  return slugify(input)
}

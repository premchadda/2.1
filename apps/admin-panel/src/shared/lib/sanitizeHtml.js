import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify - a battle-tested HTML sanitizer
 */

export function sanitizeHtml(input) {
  if (input == null) return ''
  const dirty = String(input)
  
  // Use DOMPurify with default strict configuration
  // This removes XSS vectors: script tags, event handlers, javascript: URLs, etc.
  return DOMPurify.sanitize(dirty)
}

export default sanitizeHtml

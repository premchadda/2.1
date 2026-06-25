import * as LucideIcons from 'lucide-react'
import { Menu } from 'lucide-react'

/**
 * Resolve a Lucide icon by name. Accepts strings like "BookOpen", "trophy",
 * "arrow-up-right", "Trophy", etc., and normalises them to the PascalCase
 * export from lucide-react. Falls back to a generic Menu icon if the name
 * doesn't match anything we know about so the page never crashes on an
 * unknown value.
 */
const FALLBACK = Menu
export const resolveLucideIcon = (name) => {
  if (!name || typeof name !== 'string') return FALLBACK
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('')
  return LucideIcons[pascal] || LucideIcons[name] || FALLBACK
}

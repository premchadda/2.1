// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest'
import { resolveLucideIcon } from './iconResolver.js'
import { Menu, BookOpen, Trophy } from 'lucide-react'

describe('resolveLucideIcon', () => {
  test('resolves PascalCase names to the real Lucide component', () => {
    expect(resolveLucideIcon('BookOpen')).toBe(BookOpen)
    expect(resolveLucideIcon('Trophy')).toBe(Trophy)
  })

  test('resolves kebab-case / snake_case names by normalising to PascalCase', () => {
    expect(resolveLucideIcon('book-open')).toBe(BookOpen)
    expect(resolveLucideIcon('book_open')).toBe(BookOpen)
    expect(resolveLucideIcon('BOOK OPEN')).toBe(BookOpen)
  })

  test('falls back to Menu for unknown names so the page never crashes', () => {
    expect(resolveLucideIcon('not-a-real-icon')).toBe(Menu)
    expect(resolveLucideIcon('xyz123')).toBe(Menu)
  })

  test('falls back to Menu for null/empty/non-string input', () => {
    expect(resolveLucideIcon(null)).toBe(Menu)
    expect(resolveLucideIcon(undefined)).toBe(Menu)
    expect(resolveLucideIcon('')).toBe(Menu)
    expect(resolveLucideIcon(123)).toBe(Menu)
  })
})

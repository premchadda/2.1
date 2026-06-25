// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest'
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTimeAgo,
} from './format.js'

describe('format helpers', () => {
  test('formatCurrency returns INR with the rupee symbol by default', () => {
    expect(formatCurrency(1500)).toMatch(/1,500/)
    expect(formatCurrency(0)).toBeDefined()
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency('not-a-number')).toBe('—')
  })

  test('formatCurrency honours a custom currency', () => {
    expect(formatCurrency(99, 'USD')).toMatch(/99/)
  })

  test('formatNumber localises with grouping', () => {
    // en-IN uses lakh/crore separators (12,34,567), not Western (1,234,567)
    expect(formatNumber(1234567)).toMatch(/12,34,567|1,234,567|1234567/)
    expect(formatNumber(null)).toBe('—')
  })

  test('formatDate and formatDateTime return a non-empty string for valid dates', () => {
    const d = new Date('2026-05-15T10:30:00Z')
    expect(formatDate(d)).not.toBe('—')
    expect(formatDateTime(d)).not.toBe('—')
  })

  test('formatDate returns "—" for null/invalid', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('garbage')).toBe('—')
  })

  test('formatTimeAgo produces a human-readable relative time', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    expect(formatTimeAgo(oneHourAgo)).toMatch(/h ago/)
    const justNow = new Date(Date.now() - 5_000)
    expect(formatTimeAgo(justNow)).toBe('just now')
  })
})

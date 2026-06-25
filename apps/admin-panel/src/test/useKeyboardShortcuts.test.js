import { describe, it, expect, vi } from 'vitest'

// Mock document.querySelector for keyboard shortcuts
const mockQuerySelector = vi.fn()
document.querySelector = mockQuerySelector

describe('useKeyboardShortcuts', () => {
  it('exports a function', async () => {
    const mod = await import('../shared/hooks/useKeyboardShortcuts')
    expect(mod.useKeyboardShortcuts).toBeDefined()
    expect(typeof mod.useKeyboardShortcuts).toBe('function')
  })
})

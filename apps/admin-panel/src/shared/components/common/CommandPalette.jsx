import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Command, ArrowRight, Sun, Moon, Activity, PlusCircle, Trash2, Settings } from 'lucide-react'
import { getFlatNavItems } from '../../config/adminNavConfig'
import { useTheme } from '../../context/ThemeContext'
import { toast } from 'react-hot-toast'

const CMD_KEY = navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'

function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()

  const navItems = useMemo(() => getFlatNavItems(), [])

  const actions = useMemo(() => [
    {
      id: 'toggle-theme',
      name: 'Toggle Dark/Light Theme',
      description: 'Switch between light and dark visual themes',
      icon: isDarkMode ? Sun : Moon,
      type: 'action',
      shortcut: 'T',
      action: () => {
        toggleDarkMode()
        toast.success(`Switched to ${!isDarkMode ? 'dark' : 'light'} theme`, { id: 'theme-toggle' })
      }
    },
    {
      id: 'create-question',
      name: 'Create New Question',
      description: 'Open the question creator interface',
      icon: PlusCircle,
      type: 'action',
      shortcut: 'Q',
      action: () => {
        navigate('/admin/questions?create=true')
      }
    },
    {
      id: 'create-test',
      name: 'Create New Test',
      description: 'Open the test creator interface',
      icon: PlusCircle,
      type: 'action',
      shortcut: 'N',
      action: () => {
        navigate('/admin/tests?create=true')
      }
    },
    {
      id: 'check-health',
      name: 'Check System Health',
      description: 'View database, cache, and background queue status',
      icon: Activity,
      type: 'action',
      shortcut: 'H',
      action: () => {
        navigate('/admin/system-health')
      }
    },
    {
      id: 'clear-cache',
      name: 'Clear Local Cache',
      description: 'Reset local storage preferences and search history',
      icon: Trash2,
      type: 'action',
      shortcut: 'C',
      action: () => {
        const theme = localStorage.getItem('theme') // Preserve theme
        localStorage.clear()
        if (theme) localStorage.setItem('theme', theme)
        toast.success('Local preferences reset successfully')
      }
    }
  ], [isDarkMode, toggleDarkMode, navigate])

  const items = useMemo(() => {
    return [...actions, ...navItems]
  }, [actions, navItems])

  const results = useMemo(() => {
    if (!query.trim()) return items.slice(0, 12)
    const q = query.toLowerCase()
    return items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.id?.toLowerCase().includes(q)
    ).slice(0, 15)
  }, [query, items])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      const selected = results[selectedIndex]
      if (selected.action) {
        selected.action()
      } else {
        navigate(selected.path)
      }
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    } else if (!query.trim()) {
      // Hotkeys when command palette is open with empty query
      const key = e.key.toUpperCase()
      const matchedAction = actions.find(a => a.shortcut === key)
      if (matchedAction) {
        e.preventDefault()
        matchedAction.action()
        onClose()
      }
    }
  }, [results, selectedIndex, navigate, onClose, query, actions])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 text-lg outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
            <Command className="w-3 h-3" />K
          </kbd>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close command palette">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              No results for "{query}"
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.id || idx}
                onClick={() => { 
                  if (item.action) {
                    item.action()
                  } else {
                    navigate(item.path)
                  }
                  onClose() 
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                role="option"
                aria-selected={idx === selectedIndex}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  idx === selectedIndex
                    ? 'bg-indigo-100 dark:bg-indigo-800/50'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.type === 'action' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-md">
                        Action
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-400 truncate">{item.description}</p>
                  )}
                </div>
                {item.shortcut ? (
                  <kbd className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded border border-gray-200 dark:border-gray-700 uppercase shrink-0">
                    {item.shortcut}
                  </kbd>
                ) : (
                  <ArrowRight className={`w-4 h-4 shrink-0 ${
                    idx === selectedIndex ? 'text-indigo-500' : 'text-gray-300 dark:text-gray-600'
                  }`} />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">↵</kbd> Open</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">Esc</kbd> Close</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Quick Hotkeys: <span className="font-semibold text-gray-500">T</span> (Theme), <span className="font-semibold text-gray-500">Q</span> (Question)
          </span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette

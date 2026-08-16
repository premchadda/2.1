import { useState, useEffect, useCallback, useRef } from 'react'
import { X, StickyNote, Save, Trash2, Clock } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

const STORAGE_KEY_PREFIX = 'trstprep_question_notes_'

function getStorageKey(contextId) {
  return `${STORAGE_KEY_PREFIX}${contextId}`
}

function loadNotes(contextId) {
  try {
    const raw = localStorage.getItem(getStorageKey(contextId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotes(contextId, notes) {
  try {
    localStorage.setItem(getStorageKey(contextId), JSON.stringify(notes))
  } catch {
    // storage full or unavailable
  }
}

function formatTimestamp(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function QuestionNotes({
  isOpen,
  onClose,
  questionId,
  contextId = 'default',
  className = '',
}) {
  const [notes, setNotes] = useState([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const textareaRef = useRef(null)
  const editRef = useRef(null)

  const storageKey = `${contextId}_${questionId}`

  useEffect(() => {
    if (isOpen) {
      setNotes(loadNotes(storageKey))
      setDraft('')
      setEditingId(null)
    }
  }, [isOpen, storageKey])

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  const handleSave = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) return
    const newNote = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [newNote, ...notes]
    setNotes(updated)
    saveNotes(storageKey, updated)
    setDraft('')
  }, [draft, notes, storageKey])

  const handleDelete = useCallback((id) => {
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated)
    saveNotes(storageKey, updated)
    if (editingId === id) {
      setEditingId(null)
      setEditDraft('')
    }
  }, [notes, storageKey, editingId])

  const handleEditSave = useCallback((id) => {
    const trimmed = editDraft.trim()
    if (!trimmed) return
    const updated = notes.map(n =>
      n.id === id ? { ...n, text: trimmed, updatedAt: Date.now() } : n
    )
    setNotes(updated)
    saveNotes(storageKey, updated)
    setEditingId(null)
    setEditDraft('')
  }, [editDraft, notes, storageKey])

  const focusTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    }
  }, [])

  const startEditing = useCallback((note) => {
    setEditingId(note.id)
    setEditDraft(note.text)
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    focusTimerRef.current = setTimeout(() => editRef.current?.focus(), 50)
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  const handleEditKeyDown = useCallback((e, id) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleEditSave(id)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditDraft('')
    }
  }, [handleEditSave])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        role="dialog"
        aria-label="Question Notes"
        aria-modal="true"
        className={twMerge(
          'relative w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col animate-slide-in-right',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">My Notes</h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                {notes.length} note{notes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close notes panel"
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Draft Input */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a note... (Ctrl+Enter to save)"
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900/40 outline-none resize-none transition-all"
            aria-label="Write a note"
          />
          <button
            onClick={handleSave}
            disabled={!draft.trim()}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 text-xs font-bold transition-colors"
          >
            <Save className="w-3 h-3" />
            Save Note
          </button>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {notes.length === 0 ? (
            <div className="text-center py-12">
              <StickyNote className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                No notes yet
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                Add your first note above
              </p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 hover:border-amber-200 dark:hover:border-amber-800 transition-colors"
              >
                {editingId === note.id ? (
                  <div>
                    <textarea
                      ref={editRef}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                      rows={3}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/40 outline-none resize-none"
                      aria-label="Edit note"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEditSave(note.id)}
                        className="flex-1 px-2 py-1 rounded-md bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditDraft('') }}
                        className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                      {note.text}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-600">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(note.updatedAt || note.createdAt)}
                        {note.updatedAt > note.createdAt && ' (edited)'}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(note)}
                          aria-label="Edit note"
                          className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          aria-label="Delete note"
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default QuestionNotes

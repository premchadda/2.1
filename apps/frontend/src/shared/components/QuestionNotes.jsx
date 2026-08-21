import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, StickyNote, Save, Trash2, Clock, Edit2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

const STORAGE_KEY_PREFIX = "trstprep_question_notes_";

function getStorageKey(contextId) {
  return `${STORAGE_KEY_PREFIX}${contextId}`;
}

function loadNotes(contextId) {
  try {
    const raw = localStorage.getItem(getStorageKey(contextId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(contextId, notes) {
  try {
    localStorage.setItem(getStorageKey(contextId), JSON.stringify(notes));
  } catch {
    // storage full or unavailable
  }
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function QuestionNotes({
  isOpen,
  onClose,
  questionId,
  contextId = "default",
  className = "",
  title = "",
}) {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const textareaRef = useRef(null);
  const editRef = useRef(null);

  const storageKey = `${contextId}_${questionId}`;

  useEffect(() => {
    if (isOpen) {
      setNotes(loadNotes(storageKey));
      setDraft("");
      setEditingId(null);
    }
  }, [isOpen, storageKey]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const newNote = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    saveNotes(storageKey, updated);
    setDraft("");
  }, [draft, notes, storageKey]);

  const handleDelete = useCallback(
    (id) => {
      const updated = notes.filter((n) => n.id !== id);
      setNotes(updated);
      saveNotes(storageKey, updated);
      if (editingId === id) {
        setEditingId(null);
        setEditDraft("");
      }
    },
    [notes, storageKey, editingId],
  );

  const handleEditSave = useCallback(
    (id) => {
      const trimmed = editDraft.trim();
      if (!trimmed) return;
      const updated = notes.map((n) =>
        n.id === id ? { ...n, text: trimmed, updatedAt: Date.now() } : n,
      );
      setNotes(updated);
      saveNotes(storageKey, updated);
      setEditingId(null);
      setEditDraft("");
    },
    [editDraft, notes, storageKey],
  );

  const focusTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  const startEditing = useCallback((note) => {
    setEditingId(note.id);
    setEditDraft(note.text);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => editRef.current?.focus(), 50);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  const handleEditKeyDown = useCallback(
    (e, id) => {
      if (e.key === "Escape") {
        setEditingId(null);
        setEditDraft("");
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleEditSave(id);
      }
    },
    [handleEditSave],
  );

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-end animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        role="dialog"
        aria-label="Question Notes"
        aria-modal="true"
        className={twMerge(
          "relative w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col",
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
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Question Notes
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {title
                  ? `${title}`
                  : `${notes.length} note${notes.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close notes"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Draft Input */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-950/10 shrink-0">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note, formula, or shortcut for this question... (Ctrl+Enter to save)"
              rows={3}
              className="w-full text-sm p-3 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/50 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-400 outline-none resize-none placeholder:text-gray-400 text-gray-900 dark:text-gray-100 transition-all"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Saved automatically to this device
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={!draft.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-xs shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              Save Note
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-gray-400 dark:text-gray-500">
              <StickyNote className="w-10 h-10 mb-2 stroke-1 text-amber-300 dark:text-amber-600" />
              <p className="text-sm font-medium">No notes yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Write down key concepts, formulas, or why you got this question
                wrong for quick revision.
              </p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group relative p-3.5 bg-amber-50/60 dark:bg-gray-800/80 border border-amber-200/70 dark:border-gray-700 rounded-xl transition-all hover:border-amber-300 dark:hover:border-amber-500/40"
              >
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      ref={editRef}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                      rows={3}
                      className="w-full text-xs p-2 bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-gray-100"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                        className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEditSave(note.id)}
                        className="px-2.5 py-1 text-xs bg-amber-500 text-white rounded font-medium hover:bg-amber-600"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-100 dark:border-gray-700/60">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(note.updatedAt || note.createdAt)}
                        {note.updatedAt > note.createdAt && " (edited)"}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(note)}
                          className="px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-gray-700 rounded flex items-center gap-0.5"
                          title="Edit note"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
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
    </div>,
    document.body,
  );
}

export default QuestionNotes;

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  StickyNote,
  Save,
  Trash2,
  Clock,
  Edit2,
  Loader2,
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { apiClient } from "../lib/dataService";

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
  const [syncing, setSyncing] = useState(false);
  const textareaRef = useRef(null);
  const editRef = useRef(null);

  const storageKey = `${contextId}_${questionId}`;

  useEffect(() => {
    if (!isOpen) return;
    // 1. Instant local load
    const cached = loadNotes(storageKey);
    setNotes(cached);
    setDraft("");
    setEditingId(null);

    // 2. Live remote load from /api/notes
    if (questionId) {
      const controller = new AbortController();
      setSyncing(true);
      apiClient
        .get("/api/notes", {
          params: {
            questionId: String(questionId),
            contextId: String(contextId),
          },
          signal: controller.signal,
        })
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.data)) {
            const remoteNotes = res.data.data.map((n) => ({
              id: n.id,
              text: n.noteText || n.text,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
            }));
            if (remoteNotes.length > 0) {
              setNotes(remoteNotes);
              saveNotes(storageKey, remoteNotes);
            }
          }
        })
        .catch(() => {
          // Unauthenticated or network error — fallback quietly to cached notes
        })
        .finally(() => {
          if (!controller.signal.aborted) setSyncing(false);
        });

      return () => controller.abort();
    }
  }, [isOpen, storageKey, questionId, contextId]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Escape closes the panel; restore focus to whatever opened it on close.
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    const prevFocused = document.activeElement;
    return () => {
      document.removeEventListener("keydown", handleEsc);
      if (
        prevFocused &&
        typeof prevFocused.focus === "function" &&
        document.contains(prevFocused)
      ) {
        prevFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const tempId =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const optimisticNote = {
      id: tempId,
      text: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [optimisticNote, ...notes];
    setNotes(updated);
    saveNotes(storageKey, updated);
    setDraft("");

    // Sync to backend live endpoint
    try {
      const res = await apiClient.post("/api/notes", {
        questionId: String(questionId),
        contextId: String(contextId),
        noteText: trimmed,
      });
      if (res.data?.data?.id) {
        const serverNote = {
          id: res.data.data.id,
          text: res.data.data.noteText || trimmed,
          createdAt: res.data.data.createdAt,
          updatedAt: res.data.data.updatedAt,
        };
        setNotes((prev) => {
          const synced = prev.map((n) => (n.id === tempId ? serverNote : n));
          saveNotes(storageKey, synced);
          return synced;
        });
      }
    } catch {
      // Retained in localStorage if server is offline
    }
  }, [draft, notes, storageKey, questionId, contextId]);

  const handleDelete = useCallback(
    async (id) => {
      const updated = notes.filter((n) => n.id !== id);
      setNotes(updated);
      saveNotes(storageKey, updated);
      if (editingId === id) {
        setEditingId(null);
        setEditDraft("");
      }

      // Sync deletion to backend
      try {
        await apiClient.delete(`/api/notes/${id}`);
      } catch {
        // Handled silently
      }
    },
    [notes, storageKey, editingId],
  );

  const handleEditSave = useCallback(
    async (id) => {
      const trimmed = editDraft.trim();
      if (!trimmed) return;
      const updated = notes.map((n) =>
        n.id === id ? { ...n, text: trimmed, updatedAt: Date.now() } : n,
      );
      setNotes(updated);
      saveNotes(storageKey, updated);
      setEditingId(null);
      setEditDraft("");

      // Sync update to backend
      try {
        await apiClient.put(`/api/notes/${id}`, { noteText: trimmed });
      } catch {
        // Handled silently
      }
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
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Question Notes
                </h3>
                {syncing ? (
                  <Loader2
                    className="w-3 h-3 text-amber-500 animate-spin"
                    title="Syncing..."
                  />
                ) : (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    ● Cloud Synced
                  </span>
                )}
              </div>
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
              aria-label="Draft"
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a personal note or shortcut trick for this question..."
              rows={3}
              className="w-full text-sm bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 pr-10 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none transition-all"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Ctrl+Enter to save
            </span>
            <button
              onClick={handleSave}
              disabled={!draft.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Note</span>
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 dark:text-gray-500">
              <StickyNote className="w-10 h-10 mb-2 stroke-1 opacity-50" />
              <p className="text-sm font-medium">No notes yet</p>
              <p className="text-xs mt-1">
                Jot down key formulas, trap options, or your own solution
                methods.
              </p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group relative bg-amber-50/30 dark:bg-gray-750 border border-amber-100 dark:border-gray-700/80 rounded-xl p-3.5 transition-all hover:shadow-xs"
              >
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      aria-label="Edit note"
                      ref={editRef}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                      rows={3}
                      className="w-full text-sm bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-600 rounded-lg p-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                        className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEditSave(note.id)}
                        className="px-2.5 py-1 bg-amber-500 text-white text-xs font-semibold rounded-md shadow-xs hover:bg-amber-600"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-amber-100/60 dark:border-gray-700/50">
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatTimestamp(note.updatedAt || note.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(note)}
                          className="p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                          title="Delete"
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
    </div>,
    document.body,
  );
}

export default QuestionNotes;

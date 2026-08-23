import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  MessageSquare,
  Send,
  Trash2,
  Edit3,
  Clock,
  User,
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { apiClient } from "../lib/dataService";
import { useAuth } from "../providers/AuthContext";
import toast from "react-hot-toast";

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

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function CommentItem({ comment, currentUser, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(
    comment.text || comment.content || "",
  );
  const editRef = useRef(null);
  const isOwn =
    currentUser &&
    (comment.userId === currentUser.id ||
      comment.userId === currentUser._id ||
      comment.user?._id === currentUser.id ||
      comment.user?._id === currentUser._id);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    onEdit(comment.id || comment._id, trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setEditing(false);
      setEditDraft(comment.text || comment.content || "");
    }
  };

  const userName =
    comment.user?.name ||
    comment.user?.fullName ||
    comment.userName ||
    "Anonymous";
  const userAvatar =
    comment.user?.avatar || comment.user?.avatarUrl || comment.userAvatar;

  return (
    <div className="group flex gap-2.5 py-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 border-2 border-white dark:border-gray-800 shadow-sm">
        {userAvatar ? (
          <img
            loading="lazy"
            decoding="async"
            src={userAvatar}
            alt={userName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span className="text-[10px] font-black text-white">
            {getInitials(userName)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
            {userName}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 font-medium shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatTimestamp(comment.createdAt || comment.timestamp)}
          </span>
        </div>

        {editing ? (
          <div>
            <textarea
              ref={editRef}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/40 outline-none resize-none"
              aria-label="Edit comment"
            />
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleSave}
                className="px-2 py-0.5 rounded bg-indigo-500 text-white text-[11px] font-bold hover:bg-indigo-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditDraft(comment.text || comment.content || "");
                }}
                className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-[11px] font-bold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {comment.text || comment.content || ""}
          </p>
        )}

        {/* Actions */}
        {isOwn && !editing && (
          <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={() => onDelete(comment.id || comment._id)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionDiscussions({
  isOpen,
  onClose,
  questionId,
  contextId = "default",
  apiEndpoint = null,
  className = "",
}) {
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  const listRef = useRef(null);

  const fetchComments = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = apiEndpoint || `/api/questions/${questionId}/comments`;
      const res = await apiClient.get(endpoint, { params: { limit: 50 } });
      setComments(res.data?.data || res.data?.comments || []);
    } catch (err) {
      if (err?.response?.status === 404) {
        setComments([]);
      } else {
        setError("Failed to load discussions");
      }
    } finally {
      setLoading(false);
    }
  }, [questionId, apiEndpoint]);

  useEffect(() => {
    if (isOpen && questionId) {
      fetchComments();
      setDraft("");
    }
  }, [isOpen, questionId, fetchComments]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [comments.length]);

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const endpoint = apiEndpoint || `/api/questions/${questionId}/comments`;
      const res = await apiClient.post(endpoint, {
        text: trimmed,
        contextId,
      });
      const newComment = res.data?.data || res.data?.comment;
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
      } else {
        await fetchComments();
      }
      setDraft("");
      toast.success("Comment posted");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId, newText) => {
    try {
      const endpoint = apiEndpoint || `/api/questions/${questionId}/comments`;
      await apiClient.put(`${endpoint}/${commentId}`, { text: newText });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId || c._id === commentId
            ? { ...c, text: newText, updatedAt: Date.now() }
            : c,
        ),
      );
      toast.success("Comment updated");
    } catch {
      toast.error("Failed to update comment");
    }
  };

  const handleDelete = async (commentId) => {
    try {
      const endpoint = apiEndpoint || `/api/questions/${questionId}/comments`;
      await apiClient.delete(`${endpoint}/${commentId}`);
      setComments((prev) => prev.filter((c) => (c.id || c._id) !== commentId));
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

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
        aria-label="Question Discussions"
        aria-modal="true"
        className={twMerge(
          "relative w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col animate-slide-in-right",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
              <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Discussions
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                {comments.length} comment{comments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close discussions panel"
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Comment Input */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0">
              {currentUser?.avatar ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={currentUser.avatar}
                  alt={currentUser?.name || "User avatar"}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or share insight... (Ctrl+Enter to post)"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 outline-none resize-none transition-all"
                aria-label="Write a comment"
              />
              <button
                onClick={handleSubmit}
                disabled={!draft.trim() || submitting}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 text-xs font-bold transition-colors"
              >
                <Send className="w-3 h-3" />
                {submitting ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 divide-y divide-gray-100 dark:divide-gray-700/50"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <MessageSquare className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-red-500 dark:text-red-400">
                {error}
              </p>
              <button
                onClick={fetchComments}
                className="mt-2 text-xs text-indigo-500 hover:underline font-medium"
              >
                Retry
              </button>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                No discussions yet
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                Be the first to start a discussion
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id || comment._id}
                comment={comment}
                currentUser={currentUser}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default QuestionDiscussions;

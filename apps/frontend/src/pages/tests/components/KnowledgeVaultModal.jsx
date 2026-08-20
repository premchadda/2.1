import { useState } from "react";
import { createPortal } from "react-dom";
import { practiceAPI } from "../../../shared/lib/practiceAPI";
import { toast } from "react-hot-toast";
import { Bookmark, X, Tag, FileText, Check } from "lucide-react";

const SAVE_REASONS = [
  {
    id: "new_concept",
    label: "New Concept",
    icon: "🧠",
    desc: "First time encountering this concept",
  },
  {
    id: "hard_question",
    label: "Hard Question",
    icon: "🔥",
    desc: "Complex problem requiring repeat solving",
  },
  {
    id: "important_pyq",
    label: "Important PYQ",
    icon: "⭐",
    desc: "High probability exam question",
  },
  {
    id: "good_shortcut",
    label: "Good Shortcut",
    icon: "⚡",
    desc: "Exemplary speed trick or formula",
  },
  {
    id: "needs_revision",
    label: "Needs Revision",
    icon: "📖",
    desc: "Schedule for spaced repetition review",
  },
  {
    id: "mistake",
    label: "Mistake Made",
    icon: "❌",
    desc: "Track error pattern for correction",
  },
  {
    id: "favourite",
    label: "Favourite",
    icon: "❤️",
    desc: "Saved for high-value reference",
  },
];

export default function KnowledgeVaultModal({ questionId, isOpen, onClose }) {
  const [selectedReason, setSelectedReason] = useState("needs_revision");
  const [collection, setCollection] = useState("Default");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen || typeof document === "undefined") return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      await practiceAPI.saveToVault({
        questionId,
        saveReason: selectedReason,
        collectionName: collection,
        userNotes: notes,
      });
      toast.success("Question added to Knowledge Vault!");
      onClose();
    } catch {
      toast.error("Failed to save to Knowledge Vault");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-gray-700 overflow-hidden my-auto max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center text-base">
            <Bookmark className="w-5 h-5 text-indigo-600 mr-2" /> Add to
            Knowledge Vault
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Why are you saving this question?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SAVE_REASONS.map((reason) => {
                const active = selectedReason === reason.id;
                return (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.id)}
                    className={`flex items-center p-2.5 rounded-xl border text-left transition ${
                      active
                        ? "border-indigo-600 bg-indigo-50/60 text-indigo-900 font-semibold ring-1 ring-indigo-500"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <span className="text-xl mr-2">{reason.icon}</span>
                    <span className="text-xs font-medium">{reason.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
              <Tag className="w-3.5 h-3.5 mr-1 text-slate-400" /> Collection
              Name
            </label>
            <input
              type="text"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="e.g. Hard Quant, Percentage Mastery"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" /> Personal
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your key takeaway or formula reminder..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-slate-50 border-t border-slate-100 gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition inline-flex items-center"
          >
            <Check className="w-4 h-4 mr-1.5" /> Save to Vault
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

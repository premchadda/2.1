import React from "react";
import PropTypes from "prop-types";
import {
  Plus,
  Eye,
  Edit2,
  X,
  CheckCircle,
  Trash2,
  FileText,
} from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";
import { Badge } from "./Badge";
import EmptyState from "../../../../shared/components/ui/EmptyState";
import MathRenderer from "../../../../shared/components/MathRenderer";
import { DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";
import {
  QUESTION_TYPES,
  STATUS_OPTIONS,
} from "../../../../shared/config/questionConstants.js";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Level 3: Question Detail Cards & Listing Component
 * Displays section filter tabs, question cards with full math rendering,
 * options, solutions, metadata tags, bulk actions, and pagination controls.
 */
export default function QuestionDetailList({
  testQuestions = [],
  filteredTestQuestions = [],
  paginatedQuestions = [],
  selectedSection = "all",
  setSelectedSection,
  sectionCounts = new Map(),
  currentPage = 1,
  setCurrentPage,
  totalPages = 1,
  questionsPerPage = 10,
  testQuestionsLoading = false,
  selectedIds = [],
  setSelectedIds,
  onBulkDifficulty,
  onBulkDelete,
  onQuestionPreview,
  onEditQuestion,
  onToggleStatus,
  onDeleteQuestion,
  onAddQuestion,
  selectedTest = null,
}) {
  return (
    <div>
      {/* Section Tabs */}
      <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setSelectedSection?.("all");
            setCurrentPage?.(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedSection === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All Sections ({testQuestions.length})
        </button>
        {[...sectionCounts.entries()].map(([section, count]) => (
          <button
            key={section}
            type="button"
            onClick={() => {
              setSelectedSection?.(section);
              setCurrentPage?.(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedSection === section
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {section} ({count})
          </button>
        ))}
      </div>

      {/* Summary Header & Add Question Action */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          padding: "12px 16px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <span style={{ fontSize: "14px", color: "#64748b" }}>
          <strong style={{ color: "#1e293b" }}>
            {filteredTestQuestions.length}
          </strong>{" "}
          questions
          {selectedSection !== "all"
            ? ` in ${selectedSection}`
            : " in this test"}
        </span>
        <button
          type="button"
          onClick={onAddQuestion}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            backgroundColor: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "inherit",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#4f46e5")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#6366f1")
          }
        >
          <Plus style={{ width: "16px", height: "16px" }} />
          Add Question
        </button>
      </div>

      {/* Questions Content */}
      {testQuestionsLoading && filteredTestQuestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-3">
          <LoadingSpinner />
          <p className="text-sm font-medium text-gray-500">
            Loading questions for this test...
          </p>
        </div>
      ) : filteredTestQuestions.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Bulk Action Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 12px",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
            }}
          >
            <input
              type="checkbox"
              aria-label="Select all questions on this page"
              checked={
                selectedIds.length === paginatedQuestions.length &&
                paginatedQuestions.length > 0
              }
              onChange={(e) =>
                setSelectedIds?.(
                  e.target.checked
                    ? paginatedQuestions.map((q) => q._id || q.id)
                    : [],
                )
              }
              style={{
                width: "16px",
                height: "16px",
                accentColor: "#6366f1",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                color: "#64748b",
                fontWeight: 500,
              }}
            >
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : "Select all"}
            </span>
            {selectedIds.length > 0 && (
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  Bulk Actions:
                </span>
                <button
                  type="button"
                  onClick={() => onBulkDifficulty?.("easy")}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Set Easy
                </button>
                <button
                  type="button"
                  onClick={() => onBulkDifficulty?.("medium")}
                  className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  Set Medium
                </button>
                <button
                  type="button"
                  onClick={() => onBulkDifficulty?.("hard")}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  Set Hard
                </button>
                <button
                  type="button"
                  onClick={onBulkDelete}
                  style={{
                    padding: "5px 12px",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#dc2626")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#ef4444")
                  }
                >
                  Delete ({selectedIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds?.([])}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Question Cards Mapping */}
          {paginatedQuestions.map((q, idx) => {
            const actualIdx = (currentPage - 1) * questionsPerPage + idx;
            const difficulty =
              DIFFICULTY_LEVELS.find((d) => d.value === q.difficulty) ||
              DIFFICULTY_LEVELS[1];
            const status =
              STATUS_OPTIONS.find((s) => s.value === q.status) ||
              STATUS_OPTIONS[1];
            const type =
              QUESTION_TYPES.find((t) => t.value === q.type) ||
              QUESTION_TYPES[0];

            return (
              <div
                key={q._id || q.id || idx}
                style={{
                  padding: "20px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "#cbd5e1")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "#e2e8f0")
                }
              >
                {/* Question header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select question ${q._id || q.id}`}
                      checked={selectedIds.includes(q._id || q.id)}
                      onChange={(e) => {
                        const qId = q._id || q.id;
                        if (e.target.checked)
                          setSelectedIds?.([...selectedIds, qId]);
                        else
                          setSelectedIds?.(
                            selectedIds.filter((id) => id !== qId),
                          );
                      }}
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "#6366f1",
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        backgroundColor: "#eef2ff",
                        color: "#6366f1",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {actualIdx + 1}
                    </span>
                    <Badge variant="info">{type.label}</Badge>
                    <Badge className={difficulty.color}>
                      {difficulty.label}
                    </Badge>
                    <Badge className={status.color}>{status.label}</Badge>
                    {q.marks && (
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        <strong style={{ color: "#059669" }}>+{q.marks}</strong>
                        {q.negativeMarks > 0 && (
                          <span style={{ color: "#dc2626" }}>
                            {" "}
                            / -{q.negativeMarks}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onQuestionPreview?.(q)}
                      style={{
                        padding: "6px",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#94a3b8",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#ecfdf5";
                        e.currentTarget.style.color = "#10b981";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#94a3b8";
                      }}
                      title="Preview"
                      aria-label="Preview question"
                    >
                      <Eye style={{ width: "16px", height: "16px" }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditQuestion?.(q)}
                      style={{
                        padding: "6px",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#94a3b8",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#eef2ff";
                        e.currentTarget.style.color = "#6366f1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#94a3b8";
                      }}
                      title="Edit"
                      aria-label="Edit question"
                    >
                      <Edit2 style={{ width: "16px", height: "16px" }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleStatus?.(q)}
                      style={{
                        padding: "6px",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#94a3b8",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f0fdf4";
                        e.currentTarget.style.color = "#16a34a";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#94a3b8";
                      }}
                      title={q.status === "active" ? "Deactivate" : "Activate"}
                      aria-label={
                        q.status === "active" ? "Deactivate" : "Activate"
                      }
                    >
                      {q.status === "active" ? (
                        <X style={{ width: "16px", height: "16px" }} />
                      ) : (
                        <CheckCircle
                          style={{ width: "16px", height: "16px" }}
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteQuestion?.(q._id || q.id)}
                      style={{
                        padding: "6px",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#94a3b8",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#fef2f2";
                        e.currentTarget.style.color = "#dc2626";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#94a3b8";
                      }}
                      title="Delete"
                      aria-label="Delete question"
                    >
                      <Trash2 style={{ width: "16px", height: "16px" }} />
                    </button>
                  </div>
                </div>

                {/* Question text with MathRenderer */}
                <div
                  style={{
                    fontSize: "15px",
                    color: "#1e293b",
                    lineHeight: 1.6,
                    marginBottom: q.options?.length > 0 ? "16px" : "0",
                  }}
                >
                  <MathRenderer content={q.questionText} />
                </div>

                {/* Options */}
                {q.options?.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "8px",
                      marginBottom: q.explanation ? "14px" : "0",
                    }}
                  >
                    {q.options.map((opt, oi) => {
                      const isCorrect = Array.isArray(q.correctOption)
                        ? q.correctOption.includes(oi)
                        : q.correctOption === oi;

                      return (
                        <div
                          key={oi}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            border: `1px solid ${isCorrect ? "#86efac" : "#f1f5f9"}`,
                            backgroundColor: isCorrect ? "#f0fdf4" : "#f8fafc",
                            fontSize: "14px",
                            color: isCorrect ? "#166534" : "#475569",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              backgroundColor: isCorrect
                                ? "#22c55e"
                                : "#e2e8f0",
                              color: isCorrect ? "#fff" : "#64748b",
                              fontSize: "12px",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {isCorrect ? "✓" : LETTERS[oi]}
                          </span>
                          <MathRenderer content={opt} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div
                    style={{
                      padding: "12px 16px",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "10px",
                      fontSize: "13px",
                      color: "#92400e",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "#b45309",
                      }}
                    >
                      Solution Explanation:
                    </strong>
                    <MathRenderer content={q.explanation} />
                  </div>
                )}

                {/* Tags & Metadata footer */}
                {(q.subject || q.tags?.length > 0) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "14px",
                      paddingTop: "12px",
                      borderTop: "1px solid #f1f5f9",
                      flexWrap: "wrap",
                    }}
                  >
                    {q.subject && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          backgroundColor: "#f5f3ff",
                          color: "#7c3aed",
                          borderRadius: "6px",
                        }}
                      >
                        {q.subjectName || q.subject}
                      </span>
                    )}
                    {q.chapter && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          padding: "3px 8px",
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          borderRadius: "6px",
                        }}
                      >
                        {q.chapter}
                      </span>
                    )}
                    {q.tags?.map((tag, ti) => (
                      <span
                        key={ti}
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          padding: "3px 8px",
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          borderRadius: "6px",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "20px",
                padding: "16px",
                backgroundColor: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                Showing {(currentPage - 1) * questionsPerPage + 1} -{" "}
                {Math.min(
                  currentPage * questionsPerPage,
                  filteredTestQuestions.length,
                )}{" "}
                of {filteredTestQuestions.length} questions
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage?.(1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    opacity: currentPage === 1 ? 0.5 : 1,
                    fontSize: "13px",
                    color: "#374151",
                  }}
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage?.((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    opacity: currentPage === 1 ? 0.5 : 1,
                    fontSize: "13px",
                    color: "#374151",
                  }}
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage?.(pageNum)}
                      style={{
                        width: "32px",
                        height: "32px",
                        backgroundColor:
                          currentPage === pageNum ? "#6366f1" : "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: currentPage === pageNum ? 700 : 500,
                        color: currentPage === pageNum ? "#fff" : "#374151",
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage?.((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    fontSize: "13px",
                    color: "#374151",
                  }}
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage?.(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    fontSize: "13px",
                    color: "#374151",
                  }}
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No Questions in this Test"
          description={`"${selectedTest?.title || selectedTest?.name || "This test"}" has no questions yet. Add your first question.`}
          action={
            <button
              type="button"
              onClick={onAddQuestion}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          }
        />
      )}
    </div>
  );
}

QuestionDetailList.propTypes = {
  testQuestions: PropTypes.array,
  filteredTestQuestions: PropTypes.array,
  paginatedQuestions: PropTypes.array,
  selectedSection: PropTypes.string,
  setSelectedSection: PropTypes.func,
  sectionCounts: PropTypes.instanceOf(Map),
  currentPage: PropTypes.number,
  setCurrentPage: PropTypes.func,
  totalPages: PropTypes.number,
  questionsPerPage: PropTypes.number,
  testQuestionsLoading: PropTypes.bool,
  selectedIds: PropTypes.array,
  setSelectedIds: PropTypes.func,
  onBulkDifficulty: PropTypes.func,
  onBulkDelete: PropTypes.func,
  onQuestionPreview: PropTypes.func,
  onEditQuestion: PropTypes.func,
  onToggleStatus: PropTypes.func,
  onDeleteQuestion: PropTypes.func,
  onAddQuestion: PropTypes.func,
  selectedTest: PropTypes.object,
};

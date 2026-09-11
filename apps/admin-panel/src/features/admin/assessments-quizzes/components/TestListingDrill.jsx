import React from "react";
import PropTypes from "prop-types";
import { FileText, ChevronRight, Clock } from "lucide-react";
import EmptyState from "../../../../shared/components/ui/EmptyState";
import { getEntityId, getTestId } from "./questionHelpers";

/**
 * Level 2: Test Listing Drill Grid
 * Displays subcategory filter pills (Levels 1-3) and cards for all tests
 * belonging to the selected test series / subcategory.
 */
export default function TestListingDrill({
  subCategoryOptionsLevel1 = [],
  subCategoryOptionsLevel2 = [],
  subCategoryOptionsLevel3 = [],
  subCategoryLevel1 = "",
  subCategoryLevel2 = "",
  subCategoryLevel3 = "",
  setSubCategoryLevel1,
  setSubCategoryLevel2,
  setSubCategoryLevel3,
  setSubCategoryLevel4,
  setSelectedTestSubCategoryId,
  seriesTests = [],
  getCategoryTestCount,
  getCategoryLabel,
  workspaceTests = [],
  testStatsMap = new Map(),
  onSelectTest,
  selectedSeries = null,
}) {
  const handleClearAllSubCategories = () => {
    setSubCategoryLevel1?.("");
    setSubCategoryLevel2?.("");
    setSubCategoryLevel3?.("");
    setSubCategoryLevel4?.("");
    setSelectedTestSubCategoryId?.("all");
  };

  const handleSelectLevel1 = (catId, isSelected) => {
    const newVal = isSelected ? "" : catId;
    setSubCategoryLevel1?.(newVal);
    setSubCategoryLevel2?.("");
    setSubCategoryLevel3?.("");
    setSubCategoryLevel4?.("");
    setSelectedTestSubCategoryId?.(newVal || "all");
  };

  const handleSelectLevel2 = (catId, isSelected) => {
    const newVal = isSelected ? "" : catId;
    setSubCategoryLevel2?.(newVal);
    setSubCategoryLevel3?.("");
    setSubCategoryLevel4?.("");
    setSelectedTestSubCategoryId?.(newVal || subCategoryLevel1);
  };

  const handleSelectLevel3 = (catId, isSelected) => {
    const newVal = isSelected ? "" : catId;
    setSubCategoryLevel3?.(newVal);
    setSubCategoryLevel4?.("");
    setSelectedTestSubCategoryId?.(
      newVal || subCategoryLevel2 || subCategoryLevel1,
    );
  };

  return (
    <div className="space-y-4">
      {/* Subcategory Navigation Pills */}
      {(subCategoryOptionsLevel1.length > 0 ||
        subCategoryOptionsLevel2.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-xs">
          {/* Level 1 Subcategories (e.g. Year Based, Sectional) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
              Category:
            </span>
            <button
              type="button"
              onClick={handleClearAllSubCategories}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                !subCategoryLevel1
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              All ({seriesTests.length})
            </button>
            {subCategoryOptionsLevel1.map((cat) => {
              const catId = getEntityId(cat) || "";
              const isSelected = subCategoryLevel1 === catId;
              const count = getCategoryTestCount
                ? getCategoryTestCount(catId)
                : 0;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => handleSelectLevel1(catId, isSelected)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {getCategoryLabel
                    ? getCategoryLabel(cat)
                    : cat?.name || catId}{" "}
                  ({count})
                </button>
              );
            })}
          </div>

          {/* Level 2 Subcategories (e.g. 2025, 2024, 2023, 2022, 2021, 2020, 2019) */}
          {subCategoryLevel1 && subCategoryOptionsLevel2.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
                Sub Level:
              </span>
              <button
                type="button"
                onClick={() => {
                  setSubCategoryLevel2?.("");
                  setSubCategoryLevel3?.("");
                  setSubCategoryLevel4?.("");
                  setSelectedTestSubCategoryId?.(subCategoryLevel1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                  !subCategoryLevel2
                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                    : "bg-amber-50/50 text-amber-900 border-amber-200 hover:bg-amber-100/60"
                }`}
              >
                All (
                {getCategoryTestCount
                  ? getCategoryTestCount(subCategoryLevel1)
                  : 0}
                )
              </button>
              {subCategoryOptionsLevel2.map((cat) => {
                const catId = getEntityId(cat) || "";
                const isSelected = subCategoryLevel2 === catId;
                const count = getCategoryTestCount
                  ? getCategoryTestCount(catId)
                  : 0;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => handleSelectLevel2(catId, isSelected)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                      isSelected
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-amber-50/50 text-amber-900 border-amber-200 hover:bg-amber-100/60"
                    }`}
                  >
                    {getCategoryLabel
                      ? getCategoryLabel(cat)
                      : cat?.name || catId}{" "}
                    ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Level 3 Subcategories */}
          {subCategoryLevel2 && subCategoryOptionsLevel3.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
                Shift / Paper:
              </span>
              {subCategoryOptionsLevel3.map((cat) => {
                const catId = getEntityId(cat) || "";
                const isSelected = subCategoryLevel3 === catId;
                const count = getCategoryTestCount
                  ? getCategoryTestCount(catId)
                  : 0;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => handleSelectLevel3(catId, isSelected)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    {getCategoryLabel
                      ? getCategoryLabel(cat)
                      : cat?.name || catId}{" "}
                    ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Test Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {workspaceTests.length > 0 ? (
          workspaceTests.map((test) => {
            const testId = getTestId(test);
            const testStat = testStatsMap.get(String(testId ?? "")) || {
              totalCount: 0,
              activeCount: 0,
            };
            const qCount = testStat.totalCount;
            const activeCount = testStat.activeCount;
            const isPublished =
              test.status === "published" || test.status === "active";

            return (
              <div
                key={testId}
                role="button"
                tabIndex={0}
                onClick={() => onSelectTest?.(test)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTest?.(test);
                  }
                }}
                style={{
                  padding: "20px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#a78bfa";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px -4px rgba(139, 92, 246, 0.15)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                }}
              >
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
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background:
                        qCount > 0
                          ? "linear-gradient(135deg, #dcfce7, #bbf7d0)"
                          : "linear-gradient(135deg, #fef3c7, #fde68a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText
                      style={{
                        width: "20px",
                        height: "20px",
                        color: qCount > 0 ? "#16a34a" : "#d97706",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: isPublished ? "#22c55e" : "#94a3b8",
                      }}
                    />
                    <ChevronRight
                      style={{
                        width: "18px",
                        height: "18px",
                        color: "#cbd5e1",
                      }}
                    />
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "4px",
                    lineHeight: 1.3,
                  }}
                >
                  {test.title || test.name || "Untitled Test"}
                </h3>

                {test.description && (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#94a3b8",
                      marginBottom: "14px",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {test.description}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: test.description ? "0" : "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                      borderRadius: "6px",
                    }}
                  >
                    {qCount} questions
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      backgroundColor: activeCount > 0 ? "#f0fdf4" : "#fef2f2",
                      color: activeCount > 0 ? "#166534" : "#991b1b",
                      borderRadius: "6px",
                    }}
                  >
                    {activeCount} active
                  </span>
                  {(test.duration || test.time_limit) && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "3px 10px",
                        backgroundColor: "#eff6ff",
                        color: "#1e40af",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Clock style={{ width: "12px", height: "12px" }} />
                      {test.duration || test.time_limit} min
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ gridColumn: "1 / -1" }}>
            <EmptyState
              icon={FileText}
              title="No Tests in this Category"
              description={`No tests found in "${selectedSeries?.title || selectedSeries?.name || "this series"}" for the selected subcategory.`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

TestListingDrill.propTypes = {
  subCategoryOptionsLevel1: PropTypes.array,
  subCategoryOptionsLevel2: PropTypes.array,
  subCategoryOptionsLevel3: PropTypes.array,
  subCategoryLevel1: PropTypes.string,
  subCategoryLevel2: PropTypes.string,
  subCategoryLevel3: PropTypes.string,
  setSubCategoryLevel1: PropTypes.func,
  setSubCategoryLevel2: PropTypes.func,
  setSubCategoryLevel3: PropTypes.func,
  setSubCategoryLevel4: PropTypes.func,
  setSelectedTestSubCategoryId: PropTypes.func,
  seriesTests: PropTypes.array,
  getCategoryTestCount: PropTypes.func,
  getCategoryLabel: PropTypes.func,
  workspaceTests: PropTypes.array,
  testStatsMap: PropTypes.instanceOf(Map),
  onSelectTest: PropTypes.func,
  selectedSeries: PropTypes.object,
};

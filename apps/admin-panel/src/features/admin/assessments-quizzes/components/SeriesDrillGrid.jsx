import { memo } from "react";
import { FolderOpen, List, FileText, ChevronRight } from "lucide-react";
import EmptyState from "../../../../shared/components/ui/EmptyState";
import { getSeriesId } from "./questionHelpers.js";

function SeriesDrillGrid({
  seriesList = [],
  seriesStatsMap = new Map(),
  onSelectSeries,
}) {
  if (!seriesList || seriesList.length === 0) {
    return (
      <div style={{ gridColumn: "1 / -1" }}>
        <EmptyState
          icon={FolderOpen}
          title="No Test Series Found"
          description="No test series match the selected test category, exam category, exam, and stage filters."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {seriesList.map((series) => {
        const seriesId = getSeriesId(series);
        const seriesStat = seriesStatsMap.get(String(seriesId ?? "")) || {
          testsCount: 0,
          questionsCount: 0,
        };
        const testsCount = seriesStat.testsCount;
        const questionsCount = seriesStat.questionsCount;

        return (
          <div
            key={seriesId}
            onClick={() => onSelectSeries(series)}
            className="group bg-white border border-gray-200 rounded-xl cursor-pointer transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden hover:border-indigo-300 hover:shadow-md"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
            }}
          >
            {/* Top gradient accent */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(to right, #6366f1, #8b5cf6)",
                borderRadius: "16px 16px 0 0",
              }}
            />
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <FolderOpen
                  style={{
                    width: "22px",
                    height: "22px",
                    color: "#6366f1",
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "6px",
                    lineHeight: 1.3,
                  }}
                >
                  {series.title || series.name || "Untitled Series"}
                </h3>

                <p
                  style={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    marginBottom: "16px",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {series.description || "No description available"}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "8px",
                }}
              >
                <List
                  style={{
                    width: "14px",
                    height: "14px",
                    color: "#6366f1",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  {testsCount} tests
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  backgroundColor: "#f0fdf4",
                  borderRadius: "8px",
                }}
              >
                <FileText
                  style={{
                    width: "14px",
                    height: "14px",
                    color: "#16a34a",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#166534",
                  }}
                >
                  {questionsCount} Qs
                </span>
              </div>
              {series.category && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "4px 10px",
                    backgroundColor: "#faf5ff",
                    color: "#7c3aed",
                    borderRadius: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {series.category}
                </span>
              )}
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 hidden md:block" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(SeriesDrillGrid);

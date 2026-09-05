import React from "react";
import PropTypes from "prop-types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

export default function LeaderboardCharts({
  rankHistory = [],
  userRanking,
  perfData,
  filteredRankings = [],
  radarData = [],
  ExportMenu,
}) {
  return (
    <>
      {/* Rank Progress Chart Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all p-5 md:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Rank Progress
          </h3>
          {ExportMenu && (
            <ExportMenu
              columns={["Rank", "Name", "Score"]}
              rows={filteredRankings.map((r, i) => [
                r.rank || i + 1,
                r.userName || r.name || "",
                r.score ?? r.accuracy ?? 0,
              ])}
              filename="leaderboard-rankings"
            />
          )}
        </div>
        {rankHistory.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rankHistory} margin={{ left: -20 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  reversed
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#475569" }}
                />
                <Line
                  type="monotone"
                  dataKey="rank"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ fill: "#4f46e5", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 font-bold uppercase tracking-wider">
              Lower rank is better — current rank: #
              {userRanking?.rank || perfData?.rank || "—"}.
            </p>
          </>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs font-medium">
            No rank history recorded yet. Complete tests to track performance
            over time.
          </div>
        )}
      </div>

      {/* Peer Comparison Radar Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
          You vs Peer Average
        </h3>
        {radarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={9} />
              <Radar
                name="You"
                dataKey="you"
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.3}
              />
              <Radar
                name="Peer Avg"
                dataKey="peer"
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0.15}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs font-medium text-center">
            No subject breakdown available yet.
          </div>
        )}
      </div>
    </>
  );
}

LeaderboardCharts.propTypes = {
  rankHistory: PropTypes.array,
  userRanking: PropTypes.object,
  perfData: PropTypes.object,
  filteredRankings: PropTypes.array,
  radarData: PropTypes.array,
  ExportMenu: PropTypes.elementType,
};

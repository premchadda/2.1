import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Trophy, Crown, Sparkles, Users, Search } from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService";
import { getAvatarGradient } from "@trstprep/shared-config";

export default function TestLeaderboardTab({
  testId,
  seriesId,
  result,
  isProUser = false,
  sectionRef,
}) {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all' | 'top10'

  useEffect(() => {
    let isMounted = true;
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch leaderboard for this test with fallback to seriesId
        let res = null;
        if (testId) {
          try {
            res = await apiClient.get(`/api/leaderboards?testId=${testId}`);
          } catch {
            // Ignore testId error and try series fallback
          }
        }

        if (!res?.data?.data?.length && !res?.data?.length && seriesId) {
          try {
            res = await apiClient.get(`/api/leaderboards?seriesId=${seriesId}`);
          } catch {
            // Both failed
          }
        }

        if (!isMounted) return;

        let rawList = [];
        if (res?.data?.data) {
          rawList = res.data.data;
        } else if (Array.isArray(res?.data)) {
          rawList = res.data;
        }

        // If response is populated leaderboards array with nested rankings
        if (rawList.length > 0 && rawList[0]?.rankings) {
          rawList = rawList[0].rankings;
        }

        // Normalize rankings array
        const normalized = (rawList || []).map((entry, idx) => {
          const entryRank = entry.rank || idx + 1;
          const entryPercentile = entry.percentile
            ? parseFloat(entry.percentile).toFixed(1)
            : rawList.length > 1
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    // (N - rank) / (N - 1): rank 1 → 100th percentile, last
                    // rank → 0th — the previous (N - rank)/N gave rank 1 of 2
                    // a nonsensical 50%ile.
                    Math.round(
                      ((rawList.length - entryRank) / (rawList.length - 1)) *
                        100,
                    ),
                  ),
                ).toFixed(1)
              : null;
          return {
            rank: entryRank,
            name: entry.name || entry.userName || `Student #${entryRank}`,
            score: parseFloat(entry.score ?? 0),
            percentile: entryPercentile,
            accuracy:
              entry.accuracy !== undefined && entry.accuracy !== null
                ? Math.round(entry.accuracy)
                : null,
            timeSpent: entry.timeSpent ?? entry.timeTaken ?? null,
            isCurrentUser:
              entry.isCurrentUser ||
              (result?.rank &&
                (entry.rank === result.rank || entry.score === result?.score)),
            isPro: entry.isPro || false,
          };
        });

        // If no rankings were returned or current user is not present, construct from user result
        if (normalized.length === 0 && result) {
          const userRank = result.rank || 1;
          const userTotal = result.totalParticipants || 1;
          const calcPercentile = result.percentile
            ? parseFloat(result.percentile).toFixed(1)
            : userTotal > 1
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      ((userTotal - userRank) / (userTotal - 1)) * 100,
                    ),
                  ),
                ).toFixed(1)
              : null;
          const userEntry = {
            rank: userRank,
            name: "You",
            score: parseFloat(result.score || 0),
            percentile: calcPercentile,
            accuracy:
              result.accuracy !== undefined && result.accuracy !== null
                ? Math.round(result.accuracy)
                : result.totalQuestions > 0
                  ? Math.round(
                      ((result.correct || 0) / result.totalQuestions) * 100,
                    )
                  : null,
            timeSpent: result.timeSpent || result.timeTaken || 0,
            isCurrentUser: true,
            isPro: isProUser,
          };
          setLeaderboardData([userEntry]);
        } else {
          // Ensure current user entry is marked or injected
          const hasUser = normalized.some((e) => e.isCurrentUser);
          if (!hasUser && result && result.score !== undefined) {
            const userScore = parseFloat(result.score || 0);
            const userRank = result.rank || normalized.length + 1;
            const userTotal = result.totalParticipants || normalized.length + 1;
            const calcPercentile = result.percentile
              ? parseFloat(result.percentile).toFixed(1)
              : userTotal > 1
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round(
                        ((userTotal - userRank) / (userTotal - 1)) * 100,
                      ),
                    ),
                  ).toFixed(1)
                : null;
            const userItem = {
              rank: userRank,
              name: "You",
              score: userScore,
              percentile: calcPercentile,
              accuracy:
                result.accuracy !== undefined && result.accuracy !== null
                  ? Math.round(result.accuracy)
                  : result.totalQuestions > 0
                    ? Math.round(
                        ((result.correct || 0) / result.totalQuestions) * 100,
                      )
                    : null,
              timeSpent: result.timeSpent || 0,
              isCurrentUser: true,
              isPro: isProUser,
            };
            normalized.push(userItem);
            normalized.sort((a, b) =>
              b.score !== a.score ? b.score - a.score : a.rank - b.rank,
            );
            normalized.forEach((item, idx) => {
              item.rank = idx + 1;
            });
          }
          setLeaderboardData(normalized);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Leaderboard fetch error:", err);
        // Fallback to result data
        if (result) {
          const userRank = result.rank || 1;
          const userTotal = result.totalParticipants || 1;
          const calcPercentile = result.percentile
            ? parseFloat(result.percentile).toFixed(1)
            : userTotal > 1
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      ((userTotal - userRank) / (userTotal - 1)) * 100,
                    ),
                  ),
                ).toFixed(1)
              : null;
          setLeaderboardData([
            {
              rank: userRank,
              name: "You",
              score: parseFloat(result.score || 0),
              percentile: calcPercentile,
              accuracy:
                result.accuracy !== undefined && result.accuracy !== null
                  ? Math.round(result.accuracy)
                  : result.totalQuestions > 0
                    ? Math.round(
                        ((result.correct || 0) / result.totalQuestions) * 100,
                      )
                    : null,
              isCurrentUser: true,
              isPro: isProUser,
            },
          ]);
        } else {
          setError("Unable to load leaderboard data");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [testId, seriesId, result, isProUser]);

  const maxScore =
    result?.maxScore ||
    result?.totalMarks ||
    (result?.totalQuestions || 0) *
      (result?.marksPerQuestion || result?.positiveMarks || 2) ||
    null;

  const totalParticipants =
    result?.totalParticipants || Math.max(leaderboardData.length, 1);
  const userRank =
    result?.rank || leaderboardData.find((r) => r.isCurrentUser)?.rank || null;
  const userPercentile = result?.percentile
    ? parseFloat(result.percentile).toFixed(1)
    : totalParticipants > 1 && userRank
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((totalParticipants - userRank) / (totalParticipants - 1)) * 100,
            ),
          ),
        ).toFixed(1)
      : null;

  // Filtered entries
  const filteredList = leaderboardData.filter((entry) => {
    if (searchQuery.trim()) {
      return entry.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());
    }
    if (filterType === "top10") {
      return entry.rank <= 10;
    }
    return true;
  });

  const topThree = leaderboardData.slice(0, 3);

  return (
    <React.Fragment>
      <section
        ref={sectionRef}
        data-section-id="leaderboard"
        className="scroll-mt-4 space-y-6"
      >
        {/* ── User Standing Card ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl border border-indigo-800/40">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20 flex-shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-amber-400 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-300">
                    Your Standing
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Live Rank
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-baseline gap-2">
                  {userRank ? `Rank #${userRank}` : "Participant"}
                  {totalParticipants > 1 && (
                    <span className="text-xs font-semibold text-slate-400">
                      / {totalParticipants.toLocaleString()} aspirants
                    </span>
                  )}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:justify-end w-full sm:w-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-3.5 py-2 border border-white/10 flex-1 sm:flex-initial text-center">
                <div className="text-[10px] uppercase font-bold text-slate-300">
                  Score
                </div>
                <div className="text-base font-black text-amber-300">
                  {parseFloat(result?.score || 0).toFixed(1)}{" "}
                  {maxScore ? (
                    <span className="text-xs text-slate-300 font-normal">
                      / {maxScore}
                    </span>
                  ) : null}
                </div>
              </div>
              {userPercentile !== null && (
                <div className="bg-white/10 backdrop-blur-md rounded-xl px-3.5 py-2 border border-white/10 flex-1 sm:flex-initial text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-300">
                    Percentile
                  </div>
                  <div className="text-base font-black text-indigo-200 flex items-center justify-center gap-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    {userPercentile}%ile
                  </div>
                </div>
              )}
              {result?.categoryRank && (
                <div className="bg-white/10 backdrop-blur-md rounded-xl px-3.5 py-2 border border-white/10 flex-1 sm:flex-initial text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-300">
                    Category
                  </div>
                  <div className="text-base font-black text-emerald-300">
                    #{result.categoryRank}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Top 3 Podium (Hall of Fame) ── */}
        {topThree.length >= 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Top Performers Podium
                </h3>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {leaderboardData.length} Candidates
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-4 pb-2">
              {/* Rank 2 (Silver) */}
              {topThree[1] && (
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                        topThree[1].name,
                      )} flex items-center justify-center text-white font-black text-sm sm:text-base shadow-md`}
                    >
                      {topThree[1].name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[11px] font-black">
                      2
                    </div>
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate max-w-full">
                    {topThree[1].isCurrentUser ? "You" : topThree[1].name}
                  </div>
                  <div className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                    {topThree[1].score} pts
                  </div>
                  {topThree[1].percentile && (
                    <div className="text-[10px] text-gray-400">
                      {topThree[1].percentile}%ile
                    </div>
                  )}
                  <div className="h-16 sm:h-20 w-full mt-2 rounded-t-xl bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700/60 border-t-2 border-slate-300 dark:border-slate-600 flex items-center justify-center font-black text-slate-400 text-xs">
                    2ND
                  </div>
                </div>
              )}

              {/* Rank 1 (Gold) */}
              {topThree[0] && (
                <div className="flex flex-col items-center text-center">
                  <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500 mb-1 animate-bounce" />
                  <div className="relative mb-2">
                    <div
                      className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                        topThree[0].name,
                      )} flex items-center justify-center text-white font-black text-base sm:text-xl shadow-lg ring-4 ring-amber-400/30`}
                    >
                      {topThree[0].name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400 text-amber-950 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-black shadow-xs">
                      1
                    </div>
                  </div>
                  <div className="font-black text-xs sm:text-sm text-gray-900 dark:text-white truncate max-w-full">
                    {topThree[0].isCurrentUser
                      ? "You (Winner! 🎉)"
                      : topThree[0].name}
                  </div>
                  <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">
                    {topThree[0].score} pts
                  </div>
                  {topThree[0].percentile && (
                    <div className="text-[10px] text-gray-400">
                      {topThree[0].percentile}%ile
                    </div>
                  )}
                  <div className="h-24 sm:h-28 w-full mt-2 rounded-t-xl bg-gradient-to-t from-amber-200 to-yellow-100 dark:from-amber-900/40 dark:to-amber-800/30 border-t-2 border-amber-400 flex items-center justify-center font-black text-amber-600 dark:text-amber-400 text-sm shadow-xs">
                    1ST
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze) */}
              {topThree[2] && (
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                        topThree[2].name,
                      )} flex items-center justify-center text-white font-black text-sm sm:text-base shadow-md`}
                    >
                      {topThree[2].name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-amber-100 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[11px] font-black">
                      3
                    </div>
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate max-w-full">
                    {topThree[2].isCurrentUser ? "You" : topThree[2].name}
                  </div>
                  <div className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                    {topThree[2].score} pts
                  </div>
                  {topThree[2].percentile && (
                    <div className="text-[10px] text-gray-400">
                      {topThree[2].percentile}%ile
                    </div>
                  )}
                  <div className="h-12 sm:h-16 w-full mt-2 rounded-t-xl bg-gradient-to-t from-orange-200 to-amber-100 dark:from-orange-950/40 dark:to-amber-900/20 border-t-2 border-orange-300 dark:border-orange-700/60 flex items-center justify-center font-black text-orange-600 dark:text-orange-400 text-xs">
                    3RD
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Rankings List & Filters ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === "all"
                    ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                All ({leaderboardData.length})
              </button>
              <button
                onClick={() => setFilterType("top10")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === "top10"
                    ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Top 10
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                aria-label="Search candidate name"
                type="text"
                placeholder="Search candidate name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* List Entries */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {loading ? (
              <div className="py-8 text-center text-gray-400">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading leaderboard rankings...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-10 text-center text-gray-400 px-4">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                  No matching rankings found
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Try clearing your search query.
                </p>
              </div>
            ) : (
              filteredList.map((entry) => {
                const isFirst = entry.rank === 1;
                const isSecond = entry.rank === 2;
                const isThird = entry.rank === 3;
                const isCurrent = entry.isCurrentUser;

                return (
                  <div
                    key={`${entry.rank}-${entry.name}`}
                    className={`flex items-center gap-3 p-3 sm:px-4 sm:py-3.5 transition-colors ${
                      isCurrent
                        ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600"
                        : "hover:bg-slate-50/80 dark:hover:bg-gray-700/30"
                    }`}
                  >
                    {/* Rank Column */}
                    <div className="w-7 sm:w-8 flex-shrink-0 flex items-center justify-center font-black">
                      {isFirst ? (
                        <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-400/20 text-amber-600 dark:text-amber-300 flex items-center justify-center text-xs">
                          👑 1
                        </span>
                      ) : isSecond ? (
                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs">
                          2
                        </span>
                      ) : isThird ? (
                        <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 flex items-center justify-center text-xs">
                          3
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          #{entry.rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                        entry.name,
                      )} text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-2xs`}
                    >
                      {entry.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name & Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                          {entry.name}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-600 text-white uppercase tracking-wider flex-shrink-0">
                            You
                          </span>
                        )}
                        {entry.isPro && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 uppercase">
                            PRO
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                        {entry.percentile && (
                          <span>{entry.percentile}%ile</span>
                        )}
                        {entry.percentile && entry.accuracy !== null && (
                          <span>•</span>
                        )}
                        {entry.accuracy !== null && (
                          <span>{entry.accuracy}% Accuracy</span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs sm:text-sm font-black text-gray-900 dark:text-white">
                        {entry.score}
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">
                        Marks
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </React.Fragment>
  );
}

TestLeaderboardTab.propTypes = {
  testId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  seriesId: PropTypes.string,
  result: PropTypes.object,
  isProUser: PropTypes.bool,
  sectionRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};

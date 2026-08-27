import { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  ChevronRight,
  Video,
  BookOpen,
  Target,
  Flame,
  Users,
  ChevronDown,
  Medal,
  BarChart3,
  Play,
  CheckCircle2,
} from "lucide-react";

import { useAuth } from "../../shared/providers/AuthContext";
import {
  userAPI,
  getTopPerformersLeaderboard,
  getIntelligenceLeaderboard,
} from "../../shared/lib/dataService";

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, trend }) {
  return (
    <GlassCard className="p-4 relative overflow-hidden group hover:border-cyan-400/30 transition-colors">
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-cyan-400/10 blur-2xl group-hover:bg-cyan-400/20 transition-colors" />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {label}
          </p>
          <p
            className="text-2xl font-semibold text-white mt-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg bg-cyan-400/10 flex items-center justify-center text-cyan-400 shrink-0">
          <Icon size={18} />
        </div>
      </div>
      {trend !== undefined && (
        <div
          className={`flex items-center gap-1 text-xs mt-2 ${trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-slate-400"}`}
        >
          {trend > 0 ? (
            <TrendingUp size={13} />
          ) : trend < 0 ? (
            <TrendingDown size={13} />
          ) : (
            <Minus size={13} />
          )}
          <span>
            {trend !== 0 ? `${Math.abs(trend)} this week` : "No change"}
          </span>
        </div>
      )}
    </GlassCard>
  );
}

function ExportMenu({ label = "Export" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 text-xs font-medium hover:bg-white/10 hover:border-cyan-400/30 transition-colors"
      >
        <Download size={13} /> {label}
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-white/10 bg-[#0b1220] shadow-xl z-20 overflow-hidden">
          {[
            { icon: FileSpreadsheet, label: "Export as CSV" },
            { icon: FileText, label: "Export as PDF" },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-300 transition-colors"
            >
              <opt.icon size={13} /> {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
        active
          ? "bg-cyan-400/15 border-cyan-400/40 text-cyan-300"
          : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function BadgeIcon({ badge }) {
  const colors = { gold: "#facc15", silver: "#cbd5e1", bronze: "#d97757" };
  if (!badge) return null;
  return <Medal size={15} style={{ color: colors[badge] }} />;
}

// ---------- Main Component ----------
export default function UserLeaderboard() {
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id || null;
  const [period, setPeriod] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [rankHistory, setRankHistory] = useState([]);
  const [testHistory, setTestHistory] = useState([]);
  const [practiceSubjects, setPracticeSubjects] = useState([]);
  const [radarData, setRadarData] = useState([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [nearbyLeaderboard, setNearbyLeaderboard] = useState([]);
  const [videosWatched, setVideosWatched] = useState([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    Promise.allSettled([
      userAPI
        .getAnalytics()
        .then((r) => r.data)
        .catch(() => null),
      userAPI
        .getAttempts()
        .then((r) => r.data?.data || [])
        .catch(() => []),
      getTopPerformersLeaderboard(5)
        .then((r) => r.data?.data || r.data || [])
        .catch(() => []),
      getIntelligenceLeaderboard({ type: "overall", limit: 200 })
        .then((r) => r.data?.entries || r.data || [])
        .catch(() => []),
    ]).then((results) => {
      const analytics = results[0];
      const attempts = results[1];
      const globalLeaderboard = results[2];
      const overallEntries = results[3];

      // Set current user profile from real analytics
      if (analytics) {
        const rank = analytics.rank ?? null;
        const percentile =
          analytics.percentile !== null && analytics.percentile !== undefined
            ? analytics.percentile
            : null;
        const streak =
          analytics.streak !== null && analytics.streak !== undefined
            ? analytics.streak
            : 0;
        const examCategory = analytics.strongSubjects?.[0]?.name || "—";

        setCurrentUser({
          name: user.name || analytics.name || "—",
          handle:
            user.handle || "@" + (user.email || "").split("@")[0] || "user",
          avatar: user.initialials ? user.initialials.substring(0, 2) : "—",
          overallRank: rank,
          totalUsers: analytics.totalUsers ?? null,
          percentile,
          streak,
          examCategory,
        });
      }

      // Process test history from user attempts
      if (attempts && attempts.length > 0) {
        const recent = attempts
          .slice(0, 15)
          .map((a) => ({
            id: a.id || a._id,
            name: a.title || a.testTitle || "Test",
            date: a.submittedAt || a.date,
            score: a.score || 0,
            maxScore: a.totalMarks ?? null,
            rank:
              a.rank !== "-" && a.rank !== null && a.rank !== undefined
                ? `#${a.rank}`
                : "—",
            totalParticipants: a.totalParticipants ?? null,
            percentile: a.percentile ?? analytics.percentile ?? null,
            timeTaken:
              a.timeTaken ||
              (a.timeSpent ? `${Math.round(a.timeSpent / 60)}m` : null),
            accuracy:
              a.accuracy !== null && a.accuracy !== undefined
                ? Math.round(Number(a.accuracy))
                : null,
          }))
          .filter((t) => t.name && t.name !== "Test");
        setTestHistory(recent);
      }

      // Process practice subjects from analytics subjectWise or fallback
      const practiceData = analytics?.subjectWise || [];
      if (practiceData && practiceData.length > 0) {
        const subjects = practiceData.map((s) => ({
          subject: s.name || s.subject || "General",
          solved: s.attempted || 0,
          accuracy: s.accuracy !== null ? s.accuracy : 0,
          peerAccuracy: null, // no peer data available — show only user accuracy
        }));
        setPracticeSubjects(subjects);
      }

      // Process radar data from subject-wise accuracy
      if (analytics?.subjectWise) {
        const radar = analytics.subjectWise.map((s) => ({
          subject: s.name || s.subject || "Subject",
          you: s.accuracy !== null ? s.accuracy : 0,
          peer: null,
        }));
        setRadarData(radar);
      }

      // Process global leaderboard
      if (globalLeaderboard && globalLeaderboard.length > 0) {
        setGlobalLeaderboard(globalLeaderboard.slice(0, 5));
      }

      // Process nearby leaderboard - find current user in overall entries
      if (overallEntries && currentUser) {
        const userEntry = overallEntries.find(
          (e) =>
            String(e.userId) === String(currentUserId || user?.id || user?._id),
        );
        if (userEntry) {
          const userRank = userEntry.rank;
          // Show 3 ranks above and below the current user
          const rankRange = overallEntries.filter(
            (e) => e.rank >= userRank - 3 && e.rank <= userRank + 3,
          );
          setNearbyLeaderboard(rankRange);
        }
      }

      setLoading(false);
    });
  }, [user]);

  // Helper: format time ago for videos (no real endpoint, use date from attempt)
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div
        className="min-h-screen w-full text-slate-100"
        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
      >
        <div
          className="min-h-screen w-full relative"
          style={{ background: "#060b14" }}
        >
          <div className="max-w-6xl mx-auto px-5 py-8">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`}</style>
            <GlassCard className="p-5 mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Loading Leaderboard...
              </p>
              <h1 className="text-2xl font-semibold text-white">
                My Performance & Rankings
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Track your tests, practice, and video progress against fellow
                aspirants
              </p>
            </GlassCard>
            <GlassCard className="p-5 md:col-span-2">
              <p className="text-xs text-slate-500">Rank progress...</p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-xs text-slate-500">You vs Peer Average...</p>
            </GlassCard>
            <GlassCard className="p-5 md:col-span-3">
              <p className="text-xs text-slate-500">Nearby Rivals...</p>
            </GlassCard>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen w-full text-slate-100"
        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
      >
        <div
          className="min-h-screen w-full relative"
          style={{ background: "#060b14" }}
        >
          <div className="max-w-6xl mx-auto px-5 py-8">
            <p className="text-center text-rose-400 mb-4">
              Failed to load leaderboard data
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-brand-start to-brand-end hover:shadow-glow text-white font-semibold rounded-xl hover:opacity-95 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full text-slate-100"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`}</style>
      <div
        className="min-h-screen w-full relative"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% -10%, rgba(34,211,238,0.08), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(8,145,178,0.10), transparent 55%), #060b14",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 py-8">
          {/* Hero Header Section with Left / Right Layout */}
          <div className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-cyan-950/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 mb-6 border border-cyan-500/20 shadow-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left Column: Heading, Subtitle, Periods */}
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <Trophy size={14} className="text-cyan-400" /> Leaderboard &
                  Rankings
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  My Performance & Rankings
                </h1>
                <p className="text-sm text-slate-300 mt-1 mb-4 max-w-lg">
                  Track your tests, practice, and video progress against fellow
                  aspirants
                </p>

                <div className="flex items-center gap-2">
                  {["week", "month", "all"].map((p) => (
                    <Pill
                      key={p}
                      active={period === p}
                      onClick={() => setPeriod(p)}
                    >
                      {p === "week"
                        ? "This Week"
                        : p === "month"
                          ? "This Month"
                          : "All Time"}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Right Column: Profile & Rank Strip */}
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 shadow-inner flex-shrink-0 lg:max-w-[95vw] sm:max-w-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-slate-950 font-black text-base shrink-0 shadow-md">
                    {currentUser?.avatar ||
                      currentUser?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase() ||
                      "AU"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-white text-sm truncate">
                      {currentUser?.name || "Admin User"}
                    </p>
                    <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                      @{currentUser?.handle || "admin"} ·{" "}
                      {currentUser?.examCategory || "Competitive Exam"}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-10 bg-white/10" />

                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-black text-sm shadow-inner"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {currentUser?.overallRank != null
                      ? `#${currentUser.overallRank}`
                      : "—"}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Overall Rank
                    </p>
                    <p className="text-xs font-black text-white whitespace-nowrap">
                      {currentUser?.totalUsers != null
                        ? `of ${currentUser.totalUsers.toLocaleString()} aspirants · `
                        : "Participant data unavailable · "}
                      <span className="text-cyan-300">
                        Top{" "}
                        {currentUser?.overallRank != null &&
                        currentUser?.totalUsers
                          ? Math.max(
                              1,
                              Math.min(
                                100,
                                Math.round(
                                  (currentUser.overallRank /
                                    currentUser.totalUsers) *
                                    100,
                                ),
                              ),
                            )
                          : "—"}
                        {currentUser?.overallRank != null &&
                        currentUser?.totalUsers
                          ? "%"
                          : ""}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="hidden xl:block w-px h-10 bg-white/10" />

                <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold whitespace-nowrap">
                    <TrendingUp size={14} /> Up {currentUser?.streak || 0} ranks
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[11px] font-bold whitespace-nowrap">
                    <Flame size={14} /> {currentUser?.streak || 0} day streak
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stat cards - using real data */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {currentUser && (
              <div>
                <StatCard
                  icon={Target}
                  label="Tests Taken"
                  value={currentUser.totalTests || "0"}
                  sub={`Avg score ${((currentUser.avgAccuracy || 0) * 100).toFixed(0)}%`}
                  trend={
                    currentUser.improvement != null
                      ? `${currentUser.improvement > 0 ? "+" : ""}${currentUser.improvement}%`
                      : undefined
                  }
                />
                <StatCard
                  icon={BookOpen}
                  label="Practice Qs Solved"
                  value={(currentUser.totalQuestions || 0).toLocaleString()}
                  sub="Practice questions solved"
                  trend={0}
                />
                <StatCard
                  icon={Video}
                  label="Videos Watched"
                  value={"—"}
                  sub="Video progress tracking coming soon"
                  trend={0}
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Overall Accuracy"
                  value={
                    currentUser.avgAccuracy != null
                      ? `${Math.round(currentUser.avgAccuracy * 100)}%`
                      : "—%"
                  }
                  sub="Your overall accuracy"
                  trend={0}
                />
              </div>
            )}
            {!currentUser && (
              <div>
                <StatCard
                  icon={Target}
                  label="Tests Taken"
                  value="0"
                  sub="—"
                  trend={0}
                />
                <StatCard
                  icon={BookOpen}
                  label="Practice Qs Solved"
                  value="0"
                  sub="—"
                  trend={0}
                />
                <StatCard
                  icon={Video}
                  label="Videos Watched"
                  value="—"
                  sub="—"
                  trend={0}
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Overall Accuracy"
                  value="—%"
                  sub="—%"
                  trend={0}
                />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-5 border-b border-white/10 pb-3 overflow-x-auto">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "tests", label: "Tests", icon: Target },
              { id: "practice", label: "Practice Questions", icon: BookOpen },
              { id: "videos", label: "Videos", icon: Video },
              { id: "global", label: "Global Leaderboard", icon: Trophy },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="grid md:grid-cols-3 gap-5">
              <GlassCard className="p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">
                    Rank Progress (Last 8 Weeks)
                  </h3>
                  <ExportMenu />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  {rankHistory.length > 0 ? (
                    <LineChart data={rankHistory} margin={{ left: -20 }}>
                      <CartesianGrid
                        stroke="rgba(255,255,255,0.06)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        reversed
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0b1220",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#94a3b8" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rank"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        dot={{ fill: "#22d3ee", r: 3 }}
                      />
                    </LineChart>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">
                      Weekly rank progress will appear here as you complete
                      tests.
                    </p>
                  )}
                </ResponsiveContainer>
                {rankHistory.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Complete tests to see your rank progression over time.
                  </p>
                )}
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-white mb-4">
                  Subject Accuracy
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  {radarData.length > 0 ? (
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        stroke="#94a3b8"
                        fontSize={10.5}
                      />
                      <Radar
                        name="You"
                        dataKey="you"
                        stroke="#22d3ee"
                        fill="#22d3ee"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">
                      Subject data will appear here as you practice.
                    </p>
                  )}
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard className="p-5 md:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users size={15} className="text-cyan-400" /> Nearby Rivals
                  </h3>
                  {nearbyLeaderboard && nearbyLeaderboard.length > 0 ? (
                    <span className="text-xs text-slate-500">
                      Ranks #{Math.max(1, nearbyLeaderboard[0]?.rank)}-#
                      {Math.max(
                        1,
                        nearbyLeaderboard[nearbyLeaderboard.length - 1]?.rank,
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">
                      No rival data available yet
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {nearbyLeaderboard && nearbyLeaderboard.length > 0 ? (
                    nearbyLeaderboard.map((u) => (
                      <div
                        key={u.rank}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${String(u.userId) === String(currentUserId || user?.id || user?._id) ? "bg-cyan-400/10 border border-cyan-400/30" : "hover:bg-white/[0.03]"}`}
                      >
                        <span
                          className="w-8 text-xs font-mono text-slate-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {u.rank}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-slate-200">
                          {u.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${String(u.userId) === String(currentUserId || user?.id || user?._id) ? "text-cyan-300" : "text-slate-200"}`}
                          >
                            {u.name || "Unknown"}
                            {String(u.userId) ===
                              String(currentUserId || user?.id || user?._id) &&
                              " (You)"}
                          </p>
                          <p className="text-xs text-slate-500">
                            @{u.handle || "unknown"}
                          </p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p
                            className="text-sm font-medium text-white"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {u.score || "—"}
                          </p>
                          <p className="text-xs text-slate-500">score</p>
                        </div>
                        <div className="text-right hidden sm:block w-16">
                          <p className="text-sm font-medium text-white">
                            {u.accuracy != null ? `${u.accuracy}%` : "—"}%
                          </p>
                          <p className="text-xs text-slate-500">accuracy</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 bg-white/[0.03] dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700/60">
                      <p className="text-sm text-slate-400">
                        No nearby rival data available. Complete tests to appear
                        on leaderboards.
                      </p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          )}

          {/* TESTS TAB */}
          {activeTab === "tests" && (
            <GlassCard className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="relative w-full sm:w-72">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    value=""
                    onChange={() => {}}
                    placeholder="Search tests..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 text-xs hover:bg-white/10">
                    <Filter size={13} /> Filter
                  </button>
                  <ExportMenu label="Export Tests" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/10">
                      <th className="pb-2 font-medium">Test</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Score</th>
                      <th className="pb-2 font-medium">Rank</th>
                      <th className="pb-2 font-medium">Percentile</th>
                      <th className="pb-2 font-medium">Accuracy</th>
                      <th className="pb-2 font-medium">Time</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {testHistory.length > 0 ? (
                      testHistory.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-white/[0.05] hover:bg-white/[0.03]"
                        >
                          <td className="py-3 pr-3">
                            <p className="text-slate-200 font-medium">
                              {t.name}
                            </p>
                            <p className="text-xs text-slate-500">{t.id}</p>
                          </td>
                          <td className="py-3 text-slate-400 text-xs">
                            {t.date}
                          </td>
                          <td
                            className="py-3 font-medium text-white"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {t.score}/{t.maxScore ?? "—"}
                          </td>
                          <td className="py-3">
                            <span className="text-cyan-300 font-medium">
                              {t.rank}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {" "}
                              {t.totalParticipants != null
                                ? ` /${t.totalParticipants.toLocaleString()}`
                                : ""}
                            </span>
                          </td>
                          <td className="py-3 text-slate-300">
                            {t.percentile != null ? `${t.percentile}%` : "—"}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-400 to-teal-400"
                                  style={{
                                    width: `${t.accuracy != null ? t.accuracy : 0}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-slate-400">
                                {t.accuracy != null ? `${t.accuracy}%` : "—"}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-slate-400 text-xs">
                            {t.timeTaken || "—"}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              className="text-cyan-400 hover:text-cyan-300"
                              onClick={() => {}}
                              aria-label="View test details"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="8"
                          className="text-center py-8 text-slate-400"
                        >
                          No tests attempted yet. Start practicing to see
                          progress here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* PRACTICE TAB */}
          {activeTab === "practice" && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Practice Questions — Subject-wise Breakdown
                </h3>
                <ExportMenu label="Export Practice" />
              </div>
              <div className="space-y-4">
                {practiceSubjects.length > 0 ? (
                  practiceSubjects.map((s) => (
                    <div
                      key={s.subject}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">
                          {s.subject}
                        </p>
                        <span className="text-xs text-slate-500">
                          {s.solved} solved
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Questions Solved</span>
                            <span className="text-cyan-300">{s.solved}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-teal-400"
                              style={{
                                width: `${Math.min(100, (s.solved / 100) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Accuracy</span>
                            <span className="text-emerald-300">
                              {s.accuracy}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400"
                              style={{ width: `${s.accuracy}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No practice data yet. Complete practice sessions to track
                    subject progress.
                  </p>
                )}
              </div>
            </GlassCard>
          )}

          {/* VIDEOS TAB */}
          {activeTab === "videos" && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Videos Watched
                </h3>
                <ExportMenu label="Export Videos" />
              </div>
              <div className="space-y-2.5">
                {videosWatched.length > 0 ? (
                  videosWatched.map((v) => (
                    <div
                      key={v.title}
                      className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-cyan-400/20"
                    >
                      <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center text-cyan-400 shrink-0">
                        <Play size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {v.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {v.topic} · watched {v.watched} of {v.duration} ·{" "}
                          {v.watchedOn}
                        </p>
                      </div>
                      <div className="w-28 hidden sm:block">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>You</span>
                          <span>{v.completion}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-cyan-400"
                            style={{ width: `${v.completion}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-28 hidden md:block">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Peer avg</span>
                          <span>{v.peerCompletion}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-slate-500"
                            style={{ width: `${v.peerCompletion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Video watch progress is being tracked. Check back later for
                    details.
                  </p>
                )}
              </div>
            </GlassCard>
          )}

          {/* GLOBAL LEADERBOARD TAB */}
          {activeTab === "global" && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Top Performers — {currentUser?.examCategory || "All Users"}
                </h3>
                <ExportMenu label="Export Leaderboard" />
              </div>
              <div className="space-y-1.5 mb-3">
                {globalLeaderboard.map((u) => (
                  <div
                    key={u.rank}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03]"
                  >
                    <span
                      className="w-7 text-sm font-semibold text-slate-300"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {u.rank}
                    </span>
                    <BadgeIcon badge={u.badge} />
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-slate-200">
                      {u.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {u.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        @{u.handle} · {u.tests} tests
                      </p>
                    </div>
                    <p
                      className="text-sm font-medium text-white w-16 text-right"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {u.score}
                    </p>
                    <p className="text-sm text-slate-400 w-16 text-right">
                      {u.accuracy != null ? `${u.accuracy}%` : "—"}%
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-white/10 pt-3 flex items-center justify-center gap-2 text-slate-500 text-xs">
                <Minus size={12} /> ranks 6–242 hidden <Minus size={12} />
              </div>
              <div className="mt-2 space-y-1.5">
                {nearbyLeaderboard && nearbyLeaderboard.length > 0 ? (
                  nearbyLeaderboard.map((u) => (
                    <div
                      key={u.rank}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${String(u.userId) === String(currentUserId || user?.id || user?._id) ? "bg-cyan-400/10 border border-cyan-400/30" : "hover:bg-white/[0.03]"}`}
                    >
                      <span
                        className="w-7 text-sm font-semibold text-slate-300"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {u.rank}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-slate-200">
                        {u.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${String(u.userId) === String(currentUserId || user?.id || user?._id) ? "text-cyan-300" : "text-slate-200"}`}
                        >
                          {u.name || "Unknown"}
                          {String(u.userId) ===
                            String(currentUserId || user?.id || user?._id) &&
                            " (You)"}
                        </p>
                        <p className="text-xs text-slate-500">@{u.handle}</p>
                      </div>
                      <p
                        className="text-sm font-medium text-white w-16 text-right"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {u.score}
                      </p>
                      <p className="text-sm text-slate-400 w-16 text-right">
                        {u.accuracy != null ? `${u.accuracy}%` : "—"}%
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 bg-white/[0.03] dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700/60">
                    <p className="text-sm text-slate-400">
                      No leaderboard data available yet. Complete tests to
                      appear on global rankings.
                    </p>
                  </div>
                )}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

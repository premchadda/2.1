import { useNavigate } from "react-router-dom";
import {
  Trophy,
  BarChart2,
  Brain,
  Target,
  Gift,
  Users,
  Share2,
  Rocket,
  LineChart,
  Download,
  PieChart as PieChartIcon,
  Sparkles,
  Clock,
  Star,
  Flame,
} from "lucide-react";
import { SectionLabel, CompactFeatureCard } from "../ProfilePrimitives";

function ProfileFeaturesTab({ userStats, user }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6" style={{ animation: "fadeIn 0.35s ease both" }}>
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: "Study Hours",
            value: userStats.timeSpent,
            icon: Clock,
            color: "#007AFF",
            bg: "from-blue-400 to-indigo-500",
          },
          {
            label: "Accuracy",
            value: `${userStats.avgAccuracy || 0}%`,
            icon: Target,
            color: "#34C759",
            bg: "from-green-400 to-emerald-500",
          },
          {
            label: "Rank",
            value: userStats.rank || "--",
            icon: Star,
            color: "#AF52DE",
            bg: "from-purple-400 to-pink-500",
          },
          {
            label: "Streak",
            value: `${userStats.streak}d`,
            icon: Flame,
            color: "#FF9500",
            bg: "from-orange-400 to-red-500",
          },
        ].map(({ label, value, icon: Icon, color: _color, bg }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700"
          >
            <div
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${bg} flex items-center justify-center mb-2`}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-lg font-black text-gray-900 dark:text-white">
              {value}
            </div>
            <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div>
        <SectionLabel>Learning & Study</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CompactFeatureCard
            icon={<Trophy className="w-5 h-5 text-yellow-500" />}
            iconBg="#FEF3C7"
            title="Achievements & Badges"
            description="Track your milestones"
            onClick={() => navigate("/achievements")}
            badge="New"
          />
          <CompactFeatureCard
            icon={<BarChart2 className="w-5 h-5 text-blue-500" />}
            iconBg="#DBEAFE"
            title="Study Analytics"
            description="Performance insights"
            onClick={() => navigate("/analysis")}
          />
          <CompactFeatureCard
            icon={<Brain className="w-5 h-5 text-purple-500" />}
            iconBg="#EDE9FE"
            title="AI Study Planner"
            description="Personalized schedules"
            onClick={() => navigate("/dashboard/ai-planner")}
          />
          <CompactFeatureCard
            icon={<Target className="w-5 h-5 text-red-500" />}
            iconBg="#FEE2E2"
            title="Weak Area Analysis"
            description="Focus on weak topics"
            onClick={() => navigate("/dashboard/insights")}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Social & Community</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CompactFeatureCard
            icon={<Gift className="w-5 h-5 text-green-500" />}
            iconBg="#D1FAE5"
            title="Refer & Earn"
            description="Invite friends"
            onClick={() => navigate("/refer-and-earn")}
            badge="New"
          />
          <CompactFeatureCard
            icon={<Users className="w-5 h-5 text-indigo-500" />}
            iconBg="#E0E7FF"
            title="Community"
            description="Learn together"
            onClick={() => navigate("/community")}
          />
          <CompactFeatureCard
            icon={<Share2 className="w-5 h-5 text-pink-500" />}
            iconBg="#FCE7F3"
            title="Leaderboard Sharing"
            description="Share your rank"
            comingSoon
          />
        </div>
      </div>

      <div>
        <SectionLabel>
          <span>Pro Features</span>
          <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold rounded-full">
            PRO
          </span>
        </SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CompactFeatureCard
            icon={<Rocket className="w-5 h-5 text-orange-500" />}
            iconBg="#FFEDD5"
            title="Priority Support"
            description="Faster responses"
            badge="Pro"
            comingSoon={!user?.hasProPass}
          />
          <CompactFeatureCard
            icon={<LineChart className="w-5 h-5 text-emerald-500" />}
            iconBg="#D1FAE5"
            title="Advanced Analytics"
            description="Deep performance data"
            badge="Pro"
            onClick={() => navigate("/analysis")}
          />
          <CompactFeatureCard
            icon={<Download className="w-5 h-5 text-violet-500" />}
            iconBg="#EDE9FE"
            title="Offline Access"
            description="Download tests"
            badge="Pro"
            comingSoon
          />
          <CompactFeatureCard
            icon={<PieChartIcon className="w-5 h-5 text-rose-500" />}
            iconBg="#FFE4E6"
            title="Custom Test Builder"
            description="Create your own tests"
            badge="Pro"
            comingSoon
          />
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-xl -translate-x-1/2 translate-y-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-bold">
              More Features Coming Soon!
            </span>
          </div>
          <p className="text-sm text-white/80 mb-4">
            We're constantly working on new features.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Mobile App",
              "Video Lectures",
              "AI Tutor",
              "Mock Interviews",
              "Doubt Sessions",
            ].map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileFeaturesTab;

import { BookOpen, Users, FileText, Clock } from "lucide-react";
import { getPublicStats } from "../../shared/lib/dataService";
import { useEffect, useState } from "react";

export default function QuickStats({ stats: initialStats }) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    if (!initialStats) {
      const fetchStats = async () => {
        try {
          const data = await getPublicStats();
          if (data) {
            setStats({
              tests: data.mockTests || 0,
              questions: data.practiceQuestions || 0,
              users: data.activeLearners || 0,
              averageScore: null,
            });
          }
        } catch (error) {
          console.error("Failed to fetch stats for QuickStats:", error);
        }
      };
      fetchStats();
    }
  }, [initialStats]);
  const defaultStats = {
    tests: 0,
    questions: 0,
    users: 0,
    averageScore: null,
  };

  const displayStats = stats || defaultStats;

  const formatValue = (value, isPercentage = false) => {
    if (value === null || value === undefined) return "N/A";
    if (isPercentage) return `${value}%`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const statItems = [
    {
      icon: FileText,
      label: "Total Tests",
      value: formatValue(displayStats.tests),
      color: "bg-blue-100 text-blue-600",
    },
    {
      icon: BookOpen,
      label: "Questions",
      value: formatValue(displayStats.questions),
      color: "bg-green-100 text-green-600",
    },
    {
      icon: Users,
      label: "Active Users",
      value: formatValue(displayStats.users),
      color: "bg-purple-100 text-purple-600",
    },
    {
      icon: Clock,
      label: "Avg. Score",
      value: formatValue(displayStats.averageScore, true),
      color: "bg-orange-100 text-orange-600",
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {statItems.map((item, idx) => (
          <div key={idx} className="text-center p-4 bg-gray-50 rounded-lg">
            <div className={`inline-flex p-2 rounded-lg mb-2 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <p className="text-lg font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { HelpCircle, Link2, Layers, BookOpen, Bookmark } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const DEFAULT_STATS = [
  {
    key: "totalQuestions",
    label: "Questions",
    value: 0,
    icon: HelpCircle,
    color: "blue",
  },
  {
    key: "linkedTests",
    label: "Linked Tests",
    value: 0,
    icon: Link2,
    color: "green",
  },
  {
    key: "testSeries",
    label: "Test Series",
    value: 0,
    icon: Layers,
    color: "purple",
  },
  {
    key: "subjects",
    label: "Subjects",
    value: 0,
    icon: BookOpen,
    color: "orange",
  },
  {
    key: "chapters",
    label: "Chapters",
    value: 0,
    icon: Bookmark,
    color: "pink",
  },
];

const colorMap = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    iconBg: "bg-blue-100 dark:bg-blue-500/20",
    iconText: "text-blue-600 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-500/10",
    iconBg: "bg-green-100 dark:bg-green-500/20",
    iconText: "text-green-600 dark:text-green-400",
    value: "text-green-700 dark:text-green-300",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-500/10",
    iconBg: "bg-purple-100 dark:bg-purple-500/20",
    iconText: "text-purple-600 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    iconBg: "bg-orange-100 dark:bg-orange-500/20",
    iconText: "text-orange-600 dark:text-orange-400",
    value: "text-orange-700 dark:text-orange-300",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-500/10",
    iconBg: "bg-pink-100 dark:bg-pink-500/20",
    iconText: "text-pink-600 dark:text-pink-400",
    value: "text-pink-700 dark:text-pink-300",
  },
};

export default function CompactStatsCards({ stats = {}, customStats }) {
  const cards = (customStats || DEFAULT_STATS).map((item) => ({
    ...item,
    value: stats[item.key] ?? item.value ?? 0,
  }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const colors = colorMap[card.color] || colorMap.blue;
        return (
          <div
            key={card.key}
            className={`flex items-center gap-2.5 rounded-2xl border border-gray-100/80 dark:border-gray-800/80 px-3 py-2.5 transition-all card-hover-transitive tap-feedback shadow-xs ${colors.bg}`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-xl ${colors.iconBg} shrink-0 shadow-xs`}
            >
              <Icon className={`w-4 h-4 ${colors.iconText}`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className={`text-sm sm:text-base font-black leading-tight ${colors.value}`}
              >
                {card.value}
              </span>
              <span
                className="text-[10px] sm:text-[11px] font-bold leading-tight text-gray-500 dark:text-gray-400 truncate"
                title={card.label}
              >
                {card.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

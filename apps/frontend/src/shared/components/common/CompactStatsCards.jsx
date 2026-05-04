import { HelpCircle, Link2, Layers, BookOpen, Bookmark } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const DEFAULT_STATS = [
  { key: 'totalQuestions', label: 'Questions', value: 0, icon: HelpCircle, color: 'blue' },
  { key: 'linkedTests', label: 'Linked Tests', value: 0, icon: Link2, color: 'green' },
  { key: 'testSeries', label: 'Test Series', value: 0, icon: Layers, color: 'purple' },
  { key: 'subjects', label: 'Subjects', value: 0, icon: BookOpen, color: 'orange' },
  { key: 'chapters', label: 'Chapters', value: 0, icon: Bookmark, color: 'pink' },
]

const colorMap = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    iconBg: 'bg-blue-100 dark:bg-blue-500/20',
    iconText: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-500/10',
    iconBg: 'bg-green-100 dark:bg-green-500/20',
    iconText: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    iconBg: 'bg-purple-100 dark:bg-purple-500/20',
    iconText: 'text-purple-600 dark:text-purple-400',
    value: 'text-purple-700 dark:text-purple-300',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-500/10',
    iconBg: 'bg-orange-100 dark:bg-orange-500/20',
    iconText: 'text-orange-600 dark:text-orange-400',
    value: 'text-orange-700 dark:text-orange-300',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-500/10',
    iconBg: 'bg-pink-100 dark:bg-pink-500/20',
    iconText: 'text-pink-600 dark:text-pink-400',
    value: 'text-pink-700 dark:text-pink-300',
  },
}

export default function CompactStatsCards({ stats = {} }) {
  const { isDarkMode } = useTheme()

  const cards = DEFAULT_STATS.map((item) => ({
    ...item,
    value: stats[item.key] ?? item.value,
  }))

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-5 md:gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        const colors = colorMap[card.color]
        return (
          <div
            key={card.key}
            className={`flex items-center gap-2.5 rounded-lg border border-gray-100 dark:border-gray-700/60 px-3 py-2.5 min-w-[140px] md:min-w-0 shrink-0 ${colors.bg}`}
          >
            <div className={`flex items-center justify-center w-8 h-8 rounded-md ${colors.iconBg} shrink-0`}>
              <Icon className={`w-4 h-4 ${colors.iconText}`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-base font-bold leading-tight ${colors.value}`}>
                {card.value}
              </span>
              <span className="text-[10px] leading-tight text-gray-500 dark:text-gray-400 truncate">
                {card.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

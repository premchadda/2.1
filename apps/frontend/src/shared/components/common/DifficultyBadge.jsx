import { Target } from 'lucide-react'
import { Badge } from '../ui/Badge'

const LEVEL_CONFIG = {
  easy: {
    label: 'Easy',
    variant: 'success',
    color: 'text-green-600 dark:text-green-400',
    barColor: 'bg-green-500',
    barWidth: '25%',
  },
  medium: {
    label: 'Medium',
    variant: 'warning',
    color: 'text-amber-600 dark:text-amber-400',
    barColor: 'bg-amber-500',
    barWidth: '55%',
  },
  hard: {
    label: 'Hard',
    variant: 'error',
    color: 'text-red-600 dark:text-red-400',
    barColor: 'bg-red-500',
    barWidth: '85%',
  },
}

/**
 * DifficultyBadge – shows a small badge indicating the adaptive
 * difficulty level for the current topic.
 *
 * @param {{ level: string, score: number, showBar?: boolean, className?: string }} props
 */
export default function DifficultyBadge({ level, score, showBar = false, className = '' }) {
  if (!level) return null

  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.medium

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <Badge variant={cfg.variant} size="sm" dot>
        <Target className="w-3 h-3 mr-0.5" />
        {cfg.label}
        {typeof score === 'number' && (
          <span className="opacity-70 ml-0.5">({Math.round(score)})</span>
        )}
      </Badge>

      {showBar && (
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${cfg.barColor}`}
            style={{ width: cfg.barWidth }}
          />
        </div>
      )}
    </div>
  )
}

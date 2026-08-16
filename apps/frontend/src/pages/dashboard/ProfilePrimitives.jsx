import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

// Toggle Switch Component
export function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

// Section Label Component
export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{children}</span>
      {right}
    </div>
  )
}

// Cell Component
export function Cell({ icon, iconBg, label, sub, right, onClick, danger, last }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div onClick={onClick}
      onPointerDown={() => onClick && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`flex items-center gap-3 px-5 py-4 ${!last ? 'border-b border-gray-100 dark:border-gray-700' : ''} ${onClick ? 'cursor-pointer' : ''} transition-colors ${pressed ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}>
      {icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg || '#F2F2F7' }}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-medium ${danger ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

// Compact Feature Card Component
export function CompactFeatureCard({ icon, iconBg, title, description, onClick, comingSoon, badge, _color = '#007AFF' }) {
  return (
    <div onClick={!comingSoon ? onClick : undefined}
      className={`relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 transition-all duration-200 ${comingSoon ? 'opacity-75' : 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 cursor-pointer'}`}>
      {comingSoon && (<div className="absolute top-2 right-2"><span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-bold rounded-full shadow-sm">Coming Soon</span></div>)}
      {badge && !comingSoon && (<div className="absolute top-2 right-2"><span className={`px-2 py-0.5 text-white text-[9px] font-bold rounded-full shadow-sm ${badge === 'New' ? 'bg-green-500' : badge === 'Pro' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gray-500'}`}>{badge}</span></div>)}
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{description}</p>
        </div>
        {!comingSoon && (<ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />)}
      </div>
    </div>
  )
}

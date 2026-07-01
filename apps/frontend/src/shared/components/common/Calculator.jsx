import { useState, useEffect, useCallback, useRef } from 'react'
import { Calculator as CalcIcon, X } from 'lucide-react'

/**
 * Lightweight on-screen calculator for the test interface.
 * Supports +, -, *, /, %, decimals, clear, backspace.
 * Opens via a floating button and closes on Escape or the X button.
 */
export default function Calculator({ isOpen, onToggle }) {
  const [display, setDisplay] = useState('0')
  const [expr, setExpr] = useState('')
  const inputRef = useRef(null)

  const clear = useCallback(() => {
    setDisplay('0')
    setExpr('')
  }, [])

  const backspace = useCallback(() => {
    setExpr(prev => prev.slice(0, -1))
    setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'))
  }, [])

  const append = useCallback((val) => {
    setExpr(prev => prev + val)
    setDisplay(prev => {
      if (prev === '0' && /[0-9.]/.test(val)) return val
      return prev + val
    })
  }, [])

  const evaluate = useCallback(() => {
    try {
      if (!expr) return
      const sanitized = expr.replace(/[^0-9+\-*/%.() ]/g, '')
      if (!sanitized) return
      // eslint-disable-next-line no-new-func
      const result = Function('"use strict";return (' + sanitized + ')')()
      if (result === undefined || result === null || isNaN(result)) return
      const rounded = Math.round(result * 10000) / 10000
      setDisplay(String(rounded))
      setExpr(String(rounded))
    } catch {
      setDisplay('Error')
    }
  }, [expr])

  const handleKey = useCallback((e) => {
    const key = e.key
    if (/[0-9.]/.test(key)) { e.preventDefault(); append(key) }
    else if (['+', '-', '*', '/', '%', '(', ')'].includes(key)) { e.preventDefault(); append(key) }
    else if (key === 'Enter' || key === '=') { e.preventDefault(); evaluate() }
    else if (key === 'Backspace') { e.preventDefault(); backspace() }
    else if (key === 'Escape') { e.preventDefault(); onToggle() }
  }, [append, evaluate, backspace, onToggle])

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, handleKey])

  if (!isOpen) return null

  const buttons = [
    { label: 'C', action: clear, className: 'bg-red-50 text-red-600 hover:bg-red-100' },
    { label: '⌫', action: backspace, className: 'bg-gray-50 text-gray-600 hover:bg-gray-100' },
    { label: '%', action: () => append('%'), className: 'bg-gray-50 text-gray-600 hover:bg-gray-100' },
    { label: '÷', action: () => append('/'), className: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { label: '7', action: () => append('7') },
    { label: '8', action: () => append('8') },
    { label: '9', action: () => append('9') },
    { label: '×', action: () => append('*'), className: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { label: '4', action: () => append('4') },
    { label: '5', action: () => append('5') },
    { label: '6', action: () => append('6') },
    { label: '−', action: () => append('-'), className: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { label: '1', action: () => append('1') },
    { label: '2', action: () => append('2') },
    { label: '3', action: () => append('3') },
    { label: '+', action: () => append('+'), className: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { label: '0', action: () => append('0'), className: 'col-span-2' },
    { label: '.', action: () => append('.') },
    { label: '=', action: evaluate, className: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
  ]

  return (
    <div className="fixed bottom-20 right-4 z-[100] w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-in-right">
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-600 text-white">
        <div className="flex items-center gap-1.5">
          <CalcIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-bold">Calculator</span>
        </div>
        <button onClick={onToggle} className="hover:bg-white/20 rounded p-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-2 text-right">
          {expr && <div className="text-[10px] text-gray-400 truncate">{expr}</div>}
          <div className="text-xl font-bold text-gray-900 dark:text-white truncate">{display}</div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${btn.className || 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
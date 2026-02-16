/**
 * ClickerInput Component
 * Large touch targets for eyes-free scoring: left = decrement, right = increment
 */
'use client'

import { useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHaptics } from '@/lib/hooks/use-haptics'

interface ClickerInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  isInteger?: boolean
  variant?: 'default' | 'destructive'
  className?: string
}

function clampValue(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function roundToStep(v: number, step: number) {
  return Math.round(v / step) * step
}

export default function ClickerInput({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  isInteger = false,
  variant = 'default',
  className,
}: ClickerInputProps) {
  const { triggerClick, triggerLimit } = useHaptics()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleIncrement = () => {
    const newValue = clampValue(roundToStep(value + step, step), min, max)
    if (newValue !== value) {
      triggerClick()
      onChange(newValue)
    } else if (value >= max) {
      triggerLimit()
    }
  }

  const handleDecrement = () => {
    const newValue = clampValue(roundToStep(value - step, step), min, max)
    if (newValue !== value) {
      triggerClick()
      onChange(newValue)
    } else if (value <= min) {
      triggerLimit()
    }
  }

  const startLongPress = (action: 'increment' | 'decrement') => {
    const doAction = action === 'increment' ? handleIncrement : handleDecrement
    longPressTimer.current = setTimeout(() => {
      longPressInterval.current = setInterval(doAction, 100)
    }, 500)
  }

  const stopLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (longPressInterval.current) {
      clearInterval(longPressInterval.current)
      longPressInterval.current = null
    }
  }

  const isDestructive = variant === 'destructive'
  const displayValue = isInteger ? value.toString() : value.toFixed(1)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span
        className={cn(
          'text-sm font-medium text-muted-foreground',
          isDestructive && 'text-destructive'
        )}
      >
        {label}
      </span>
      <div className="flex items-stretch rounded-xl overflow-hidden border border-border bg-card tap-highlight-none">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className={cn(
            'flex-1 min-h-[56px] flex items-center justify-center touch-manipulation active:opacity-80 transition-opacity',
            isDestructive
              ? 'bg-destructive/20 text-destructive border-r border-destructive/30'
              : 'bg-destructive/10 text-destructive border-r border-destructive/20 dark:bg-destructive/15 dark:border-destructive/25'
          )}
          onClick={handleDecrement}
          onMouseDown={() => startLongPress('decrement')}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress('decrement')}
          onTouchEnd={stopLongPress}
          onTouchCancel={stopLongPress}
          disabled={value <= min}
        >
          <Minus className="h-8 w-8" strokeWidth={2.5} />
        </button>
        <div
          className={cn(
            'min-w-[80px] flex items-center justify-center font-mono text-2xl font-bold tabular-nums bg-muted/50',
            isDestructive && 'text-destructive'
          )}
        >
          {displayValue}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className={cn(
            'flex-1 min-h-[56px] flex items-center justify-center touch-manipulation active:opacity-80 transition-opacity',
            'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-l border-emerald-500/30'
          )}
          onClick={handleIncrement}
          onMouseDown={() => startLongPress('increment')}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress('increment')}
          onTouchEnd={stopLongPress}
          onTouchCancel={stopLongPress}
          disabled={value >= max}
        >
          <Plus className="h-8 w-8" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

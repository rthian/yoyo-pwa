/**
 * FE category score slider with haptic feedback on step changes.
 * Callers: components/judge/ScoringForm.tsx (Freestyle Evaluation section)
 * User: FE slider + phone vibrate; TE side-by-side
 */
'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useHaptics } from '@/lib/hooks/use-haptics'

interface ScoreSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

export default function ScoreSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.5,
  className,
}: ScoreSliderProps) {
  const { triggerClick } = useHaptics()
  const lastStepRef = useRef(value)

  useEffect(() => {
    lastStepRef.current = value
  }, [value])

  const handleChange = (raw: number) => {
    const stepped = Math.round(raw / step) * step
    const clamped = Math.min(max, Math.max(min, stepped))
    if (clamped !== lastStepRef.current) {
      lastStepRef.current = clamped
      triggerClick()
    }
    onChange(clamped)
  }

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium leading-tight">{label}</label>
        <span className="text-lg font-bold font-mono tabular-nums text-primary shrink-0">
          {value.toFixed(step < 1 ? 1 : 0)}
          <span className="text-xs font-normal text-muted-foreground"> / {max}</span>
        </span>
      </div>

      <div className="relative pt-1 pb-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => handleChange(Number(e.target.value))}
          onPointerDown={() => {
            lastStepRef.current = value
            triggerClick()
          }}
          className={cn(
            'w-full h-10 appearance-none bg-transparent cursor-pointer touch-manipulation',
            '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full',
            '[&::-webkit-slider-runnable-track]:bg-muted',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-7',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
            '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background',
            '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:-mt-2',
            '[&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:transition-transform',
            '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted',
            '[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2',
            '[&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-md'
          )}
          style={{
            background: `linear-gradient(to right, var(--primary) ${pct}%, var(--muted) ${pct}%)`,
            backgroundSize: '100% 12px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-0.5">
        <span>{min}</span>
        <span>{(min + max) / 2}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

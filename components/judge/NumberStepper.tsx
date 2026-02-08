/**
 * Number Stepper Component
 * Mobile-optimized number input with increment/decrement buttons
 */
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils/haptics'

interface NumberStepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  isInteger?: boolean
  variant?: 'default' | 'destructive'
}

export default function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  isInteger = false,
  variant = 'default',
}: NumberStepperProps) {
  const [inputValue, setInputValue] = useState(value.toString())
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const longPressInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setInputValue(isInteger ? value.toString() : value.toFixed(1))
  }, [value, isInteger])

  const clampValue = (v: number) => {
    return Math.min(max, Math.max(min, v))
  }

  const roundToStep = (v: number) => {
    return Math.round(v / step) * step
  }

  const handleIncrement = () => {
    const newValue = clampValue(roundToStep(value + step))
    if (newValue !== value) {
      haptic('light')
      onChange(newValue)
    }
  }

  const handleDecrement = () => {
    const newValue = clampValue(roundToStep(value - step))
    if (newValue !== value) {
      haptic('light')
      onChange(newValue)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const parsed = parseFloat(inputValue)
    if (!isNaN(parsed)) {
      const clamped = clampValue(roundToStep(parsed))
      onChange(clamped)
      setInputValue(isInteger ? clamped.toString() : clamped.toFixed(1))
    } else {
      setInputValue(isInteger ? value.toString() : value.toFixed(1))
    }
  }

  // Long press handling for rapid increment/decrement
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

  return (
    <div className="flex items-center justify-between gap-4">
      <label className={cn(
        "text-sm font-medium flex-1",
        isDestructive && "text-destructive"
      )}>
        {label}
      </label>
      
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={isDestructive ? "destructive" : "outline"}
          size="icon"
          className="h-10 w-10 rounded-full touch-manipulation"
          onClick={handleDecrement}
          onMouseDown={() => startLongPress('decrement')}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress('decrement')}
          onTouchEnd={stopLongPress}
          disabled={value <= min}
        >
          <Minus className="h-4 w-4" />
        </Button>
        
        <Input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className={cn(
            "w-16 text-center text-lg font-bold h-10 touch-manipulation",
            isDestructive && "border-destructive text-destructive"
          )}
        />
        
        <Button
          type="button"
          variant={isDestructive ? "destructive" : "outline"}
          size="icon"
          className="h-10 w-10 rounded-full touch-manipulation"
          onClick={handleIncrement}
          onMouseDown={() => startLongPress('increment')}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress('increment')}
          onTouchEnd={stopLongPress}
          disabled={value >= max}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

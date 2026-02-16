/**
 * useHaptics Hook
 * Exposes haptic feedback for judge scoring (clicks + limit feedback)
 */
'use client'

import { useCallback, useMemo } from 'react'
import {
  haptic,
  hapticWarning,
  isHapticsSupported,
} from '@/lib/utils/haptics'

export function useHaptics() {
  const isSupported = useMemo(() => isHapticsSupported(), [])

  const triggerClick = useCallback(() => {
    haptic('light')
  }, [])

  const triggerLimit = useCallback(() => {
    hapticWarning()
  }, [])

  return {
    isSupported,
    triggerClick,
    triggerLimit,
  }
}

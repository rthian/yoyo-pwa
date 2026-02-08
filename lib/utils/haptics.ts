/**
 * Haptic Feedback Utilities
 * Provides tactile feedback on supported mobile devices
 */

type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'

type VibratePattern = number | number[]

/**
 * Check if haptic feedback is supported
 */
export function isHapticsSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'vibrate' in navigator
}

/**
 * Trigger haptic feedback
 */
export function haptic(type: HapticType = 'light'): void {
  if (!isHapticsSupported()) return

  // Vibration patterns in milliseconds
  const patterns: Record<HapticType, VibratePattern> = {
    light: 10,
    medium: 25,
    heavy: 50,
    selection: 5,
    success: [10, 50, 20],
    warning: [20, 30, 20, 30],
    error: [50, 100, 50],
  }

  try {
    navigator.vibrate(patterns[type])
  } catch {
    // Silently fail if vibration is blocked
  }
}

/**
 * Haptic feedback for button press
 */
export function hapticButton(): void {
  haptic('light')
}

/**
 * Haptic feedback for selection change
 */
export function hapticSelect(): void {
  haptic('selection')
}

/**
 * Haptic feedback for success action
 */
export function hapticSuccess(): void {
  haptic('success')
}

/**
 * Haptic feedback for error
 */
export function hapticError(): void {
  haptic('error')
}

/**
 * Haptic feedback for warning
 */
export function hapticWarning(): void {
  haptic('warning')
}

/**
 * Create a haptic-enabled click handler
 */
export function withHaptic<T extends (...args: unknown[]) => unknown>(
  handler: T,
  type: HapticType = 'light'
): T {
  return ((...args: Parameters<T>) => {
    haptic(type)
    return handler(...args)
  }) as T
}

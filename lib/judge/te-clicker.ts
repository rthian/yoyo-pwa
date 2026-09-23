/**
 * Live TE clicker state: positives/negatives → net ex_clicks.
 * Majors (STOP/DISCARD/DETACH) are tracked separately for IYYF MD columns.
 * Callers: TeClickerScreen, ScoringForm
 * User: "yes" (Worlds-aligned majors)
 */

export const MAJOR_STOP = 1
export const MAJOR_DISCARD = 3
export const MAJOR_DETACH = 5

export type MajorKind = 'stop' | 'discard' | 'detach'

export interface TeClickerState {
  positives: number
  negatives: number
}

export interface MajorDeductionState {
  stopCount: number
  discardCount: number
  detachCount: number
}

export function createEmptyTeState(): TeClickerState {
  return { positives: 0, negatives: 0 }
}

export function createEmptyMajors(): MajorDeductionState {
  return { stopCount: 0, discardCount: 0, detachCount: 0 }
}

/**
 * Hydrate from stored ex_clicks. Split history is not persisted —
 * net ≥ 0 → all positives; net < 0 → all negatives.
 */
export function hydrateTeFromExClicks(exClicks: number | null | undefined): TeClickerState {
  const net = Math.trunc(Number(exClicks) || 0)
  if (net >= 0) {
    return { positives: net, negatives: 0 }
  }
  return { positives: 0, negatives: Math.abs(net) }
}

export function hydrateMajors(input: {
  md_stop_count?: number | null
  md_discard_count?: number | null
  md_detach_count?: number | null
}): MajorDeductionState {
  return {
    stopCount: Math.max(0, Math.trunc(input.md_stop_count ?? 0)),
    discardCount: Math.max(0, Math.trunc(input.md_discard_count ?? 0)),
    detachCount: Math.max(0, Math.trunc(input.md_detach_count ?? 0)),
  }
}

export function teNet(state: TeClickerState): number {
  return state.positives - state.negatives
}

export function majorPoints(state: MajorDeductionState): number {
  return (
    state.stopCount * MAJOR_STOP +
    state.discardCount * MAJOR_DISCARD +
    state.detachCount * MAJOR_DETACH
  )
}

export function addPositive(state: TeClickerState, n = 1): TeClickerState {
  return { ...state, positives: Math.max(0, state.positives + n) }
}

export function addNegative(state: TeClickerState, n = 1): TeClickerState {
  return { ...state, negatives: Math.max(0, state.negatives + n) }
}

/** IYYF: majors are separate counters (not TE negatives). */
export function bumpMajor(
  state: MajorDeductionState,
  kind: MajorKind
): MajorDeductionState {
  if (kind === 'stop') return { ...state, stopCount: state.stopCount + 1 }
  if (kind === 'discard') return { ...state, discardCount: state.discardCount + 1 }
  return { ...state, detachCount: state.detachCount + 1 }
}

/**
 * AP-style: majors absorbed into TE negatives.
 * Also increments the display counter when provided.
 */
export function applyMajorIntoNegatives(
  te: TeClickerState,
  majors: MajorDeductionState,
  kind: MajorKind
): { te: TeClickerState; majors: MajorDeductionState } {
  const nextMajors = bumpMajor(majors, kind)
  const pts =
    kind === 'stop' ? MAJOR_STOP : kind === 'discard' ? MAJOR_DISCARD : MAJOR_DETACH
  return {
    te: addNegative(te, pts),
    majors: nextMajors,
  }
}

export function resetTeState(): TeClickerState {
  return createEmptyTeState()
}

export function resetMajors(): MajorDeductionState {
  return createEmptyMajors()
}

export const DEFAULT_TE_KEYS = {
  negative: ['z', 'Z', 'ArrowLeft', '-'],
  positive: ['/', 'ArrowRight', '=', '+'],
} as const

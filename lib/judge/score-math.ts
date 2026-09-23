/**
 * Worlds / IYYF-aligned score totals.
 * TE = clicker net → /60; FE cats → /40; majors after E.Total.
 * Callers: app/api/scores/route.ts, scores/sync, ScoringForm.tsx
 * User: "yes" (align judging to WYYC sheet)
 */

export interface ScoreFields {
  ex_clicks: number
  ex_pv: number
  ex_ch: number
  ex_cons: number
  ex_space: number
  ex_body: number
  ex_showman: number
  ex_music: number
  ex_construct: number
  ex_trick_div: number
  ex_deductions?: number
  md_stop_count?: number
  md_discard_count?: number
  md_detach_count?: number
}

/** Map FE category ids → existing score columns (no rename migration). */
export const FE_FIELD_MAP: Record<string, keyof ScoreFields> = {
  execution: 'ex_pv',
  control: 'ex_cons',
  trick_diversity: 'ex_trick_div',
  space_emphasis: 'ex_space',
  music_choreography: 'ex_ch',
  choreography: 'ex_ch',
  music_construction: 'ex_construct',
  body_control: 'ex_body',
  showmanship: 'ex_showman',
  performance_quality: 'ex_showman',
  musicality: 'ex_music',
  uniqueness: 'ex_pv',
}

export const FE_LABELS: Record<string, string> = {
  execution: 'Execution',
  control: 'Control',
  trick_diversity: 'Trick Diversity',
  space_emphasis: 'Space Use & Emphasis',
  music_choreography: 'Choreography',
  choreography: 'Choreography',
  music_construction: 'Construction',
  body_control: 'Body Control',
  showmanship: 'Showmanship',
  performance_quality: 'Performance Quality',
  musicality: 'Musicality',
  uniqueness: 'Uniqueness',
}

export interface ScoringConfigLike {
  te_weight?: number
  fe_weight?: number
  fe_categories_final?: string[]
  fe_categories_prelim?: string[]
  major_deductions?: Record<string, number | string> | null
  integrated_deductions?: Record<string, number> | null
}

export type RoundKind = 'wildcard' | 'prelim' | 'semi_final' | 'final' | string

export interface ComputedScores {
  technical: number
  performance: number
  eTotal: number
  majorPoints: number
  total: number
  majorMode: 'separate' | 'integrated' | 'legacy'
  feCategoryKeys: string[]
}

const DEFAULT_FINAL_FE = [
  'execution',
  'control',
  'trick_diversity',
  'space_emphasis',
  'music_choreography',
  'music_construction',
  'body_control',
  'showmanship',
]

const DEFAULT_PRELIM_FE = ['execution', 'control', 'choreography', 'body_control']

export function feCategoriesForRound(
  config: ScoringConfigLike | null | undefined,
  roundType: RoundKind | null | undefined
): string[] {
  const isFinal = roundType === 'final' || !roundType
  if (isFinal) {
    return config?.fe_categories_final?.length
      ? config.fe_categories_final
      : DEFAULT_FINAL_FE
  }
  return config?.fe_categories_prelim?.length
    ? config.fe_categories_prelim
    : DEFAULT_PRELIM_FE
}

export function majorDeductionPoints(fields: ScoreFields): number {
  const stop = Math.max(0, Math.trunc(fields.md_stop_count ?? 0))
  const discard = Math.max(0, Math.trunc(fields.md_discard_count ?? 0))
  const detach = Math.max(0, Math.trunc(fields.md_detach_count ?? 0))
  return stop * 1 + discard * 3 + detach * 5
}

export function majorsAreSeparate(
  config: ScoringConfigLike | null | undefined
): boolean {
  return config?.major_deductions != null && typeof config.major_deductions === 'object'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * IYYF: TE = clamp(net_clicks * 0.1, 0, te_weight).
 * FE final (8×10): sum/2 → /40. Prelim/semi (4×10): sum → /40.
 * Final = TE + FE − majors.
 */
export function computeScores(
  fields: ScoreFields,
  config: ScoringConfigLike | null | undefined,
  roundType: RoundKind | null | undefined
): ComputedScores {
  const teWeight = typeof config?.te_weight === 'number' ? config.te_weight : 60
  const feWeight = typeof config?.fe_weight === 'number' ? config.fe_weight : 40
  const hasSeparateMajors = majorsAreSeparate(config)
  const hasIntegrated =
    config?.integrated_deductions != null &&
    typeof config.integrated_deductions === 'object'

  const clicks = Number(fields.ex_clicks) || 0
  const feKeys = feCategoriesForRound(config, roundType)

  if (!hasSeparateMajors && !hasIntegrated && !config?.fe_categories_final) {
    const technical =
      clicks * 0.1 +
      (fields.ex_pv || 0) +
      (fields.ex_ch || 0) +
      (fields.ex_cons || 0)
    const performance =
      (fields.ex_space || 0) +
      (fields.ex_body || 0) +
      (fields.ex_showman || 0) +
      (fields.ex_music || 0) +
      (fields.ex_construct || 0) +
      (fields.ex_trick_div || 0)
    const majorPoints = Number(fields.ex_deductions) || 0
    const eTotal = technical + performance
    return {
      technical: Math.max(0, technical),
      performance: Math.max(0, performance),
      eTotal: Math.max(0, eTotal),
      majorPoints,
      total: Math.max(0, eTotal - majorPoints),
      majorMode: 'legacy',
      feCategoryKeys: feKeys,
    }
  }

  const technical = Math.min(teWeight, Math.max(0, clicks * 0.1))

  let feSum = 0
  for (const key of feKeys) {
    const col = FE_FIELD_MAP[key]
    if (!col) continue
    feSum += Number(fields[col]) || 0
  }
  const performance =
    feKeys.length >= 8
      ? Math.min(feWeight, feSum / 2)
      : Math.min(feWeight, feSum)

  const eTotal = technical + performance

  if (hasSeparateMajors) {
    const majorPoints = majorDeductionPoints(fields)
    return {
      technical: round2(technical),
      performance: round2(performance),
      eTotal: round2(eTotal),
      majorPoints,
      total: round2(Math.max(0, eTotal - majorPoints)),
      majorMode: 'separate',
      feCategoryKeys: feKeys,
    }
  }

  const majorPoints = Number(fields.ex_deductions) || 0
  return {
    technical: round2(technical),
    performance: round2(performance),
    eTotal: round2(eTotal),
    majorPoints,
    total: round2(Math.max(0, eTotal - majorPoints)),
    majorMode: hasIntegrated ? 'integrated' : 'legacy',
    feCategoryKeys: feKeys,
  }
}

/**
 * TypeSafe soft-lock / finalize readiness cues.
 * Callers: app/api/divisions/[id]/lock-readiness/route.ts,
 *          app/api/admin/events/[id]/finalize/route.ts
 * Advisory only — hard lock/finalize stay code-gated.
 * User: "yes please" (soft lock/finalize cues)
 */
import { choice, noul, score } from '@typesafe-ai/sdk'
import { getTypeSafeClient, isTypeSafeConfigured } from '@/lib/typesafe/client'

/** Below this, treat cue as wait (do not trust ready). */
export const CUE_CONFIDENCE_FLOOR = 0.5
/** Submitted cell ratio under this → force wait. */
export const WAIT_COMPLETION_RATIO = 0.9
/** Submitted cell ratio under this → force caution at best. */
export const CAUTION_COMPLETION_RATIO = 0.98

export type LockCue = 'ready' | 'caution' | 'wait'

export interface LockPanelFacts {
  divisionName: string
  scoringLocked: boolean
  participantCount: number
  countingJudgeCount: number
  expectedScoreCells: number
  submittedScoreCount: number
  draftScoreCount: number
  missingScoreCount: number
  outlierCount: number
  excludedJudgeCount: number
  submittedRatio: number
}

export interface LockReadinessResult {
  configured: boolean
  cue: LockCue
  confidence: number
  probabilities: Record<string, number>
  integrityRisk: number
  completenessScore: number
  /** Code-built copy for UI (not model-generated). */
  headline: string
  reasons: string[]
  facts: LockPanelFacts
  thresholds: {
    cueConfidenceFloor: number
    waitCompletionRatio: number
    cautionCompletionRatio: number
  }
}

export interface FinalizeEventFacts {
  eventName: string
  divisionCount: number
  lockedDivisionCount: number
  unlockedDivisionNames: string[]
  totalOutliersAcrossLocked: number
  excludedJudgeCount: number
  hardBlockers: { code: string; message: string }[]
}

export interface FinalizeReadinessResult {
  configured: boolean
  cue: LockCue
  confidence: number
  probabilities: Record<string, number>
  integrityRisk: number
  headline: string
  reasons: string[]
  facts: FinalizeEventFacts
}

function buildLockReasons(facts: LockPanelFacts): string[] {
  const reasons: string[] = []
  if (facts.scoringLocked) reasons.push('Division is already scoring-locked.')
  if (facts.missingScoreCount > 0) {
    reasons.push(
      `${facts.missingScoreCount} score cell${facts.missingScoreCount === 1 ? '' : 's'} still missing.`
    )
  }
  if (facts.draftScoreCount > 0) {
    reasons.push(
      `${facts.draftScoreCount} draft score${facts.draftScoreCount === 1 ? '' : 's'} not submitted.`
    )
  }
  if (facts.outlierCount > 0) {
    reasons.push(
      `${facts.outlierCount} outlier mark${facts.outlierCount === 1 ? '' : 's'} on the panel.`
    )
  }
  if (facts.excludedJudgeCount > 0) {
    reasons.push(
      `${facts.excludedJudgeCount} judge${facts.excludedJudgeCount === 1 ? '' : 's'} excluded from leaderboard.`
    )
  }
  if (facts.submittedRatio >= CAUTION_COMPLETION_RATIO && facts.outlierCount === 0) {
    reasons.push('Panel looks complete with no open outliers.')
  }
  return reasons
}

function forceCueFromFacts(facts: LockPanelFacts, modelCue: LockCue): LockCue {
  if (facts.scoringLocked) return 'ready'
  if (facts.submittedRatio < WAIT_COMPLETION_RATIO || facts.missingScoreCount > 0) {
    return 'wait'
  }
  if (
    facts.submittedRatio < CAUTION_COMPLETION_RATIO ||
    facts.draftScoreCount > 0 ||
    facts.outlierCount > 0
  ) {
    return modelCue === 'ready' ? 'caution' : modelCue
  }
  return modelCue
}

function headlineFor(cue: LockCue, kind: 'lock' | 'finalize'): string {
  if (kind === 'finalize') {
    if (cue === 'ready') return 'Looks safe to finalize season points.'
    if (cue === 'caution') return 'You can finalize, but review the notes first.'
    return 'Not ready to finalize yet.'
  }
  if (cue === 'ready') return 'Panel looks ready to lock.'
  if (cue === 'caution') return 'You can lock, but check the notes first.'
  return 'Wait — panel still incomplete.'
}

function parseChoiceAnswer(
  raw: unknown
): { choice: LockCue; confidence: number; probabilities: Record<string, number> } {
  const fallback = {
    choice: 'caution' as LockCue,
    confidence: 0,
    probabilities: {} as Record<string, number>,
  }
  if (!raw || typeof raw !== 'object') return fallback
  const obj = raw as {
    choice?: unknown
    confidence?: unknown
    probabilities?: unknown
  }
  const c = obj.choice
  const choiceOk = c === 'ready' || c === 'caution' || c === 'wait'
  return {
    choice: choiceOk ? c : 'caution',
    confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
    probabilities:
      obj.probabilities && typeof obj.probabilities === 'object'
        ? (obj.probabilities as Record<string, number>)
        : {},
  }
}

function parseScore(raw: unknown): number {
  if (
    raw &&
    typeof raw === 'object' &&
    'score' in raw &&
    typeof (raw as { score: unknown }).score === 'number'
  ) {
    return (raw as { score: number }).score
  }
  return 0
}

function parseNoul(raw: unknown): number {
  if (
    raw &&
    typeof raw === 'object' &&
    'noul' in raw &&
    typeof (raw as { noul: unknown }).noul === 'number'
  ) {
    return (raw as { noul: number }).noul
  }
  return 0
}

/**
 * Soft cue before hard lock. Never locks — UI only.
 */
export async function assessLockReadiness(
  facts: LockPanelFacts
): Promise<LockReadinessResult> {
  const thresholds = {
    cueConfidenceFloor: CUE_CONFIDENCE_FLOOR,
    waitCompletionRatio: WAIT_COMPLETION_RATIO,
    cautionCompletionRatio: CAUTION_COMPLETION_RATIO,
  }
  const reasons = buildLockReasons(facts)

  if (!isTypeSafeConfigured()) {
    const cue = forceCueFromFacts(facts, facts.outlierCount > 0 ? 'caution' : 'ready')
    return {
      configured: false,
      cue,
      confidence: 0,
      probabilities: {},
      integrityRisk: 0,
      completenessScore: facts.submittedRatio,
      headline: headlineFor(cue, 'lock'),
      reasons,
      facts,
      thresholds,
    }
  }

  const state = {
    division_name: facts.divisionName,
    context: {
      what: 'Head judge deciding whether to soft-check before locking division scoring.',
      policy:
        'Hard lock is always a human action. This cue only warns: wait (incomplete), caution (review), ready (looks fine).',
      meanings: {
        ready: 'Panel complete enough to lock; residual risk looks normal.',
        caution: 'Lock is allowed but head judge should glance at drafts/outliers first.',
        wait: 'Do not lock yet — missing or draft scores would freeze incomplete results.',
      },
    },
    panel: {
      scoring_locked: facts.scoringLocked,
      participant_count: facts.participantCount,
      counting_judge_count: facts.countingJudgeCount,
      expected_score_cells: facts.expectedScoreCells,
      submitted_score_count: facts.submittedScoreCount,
      draft_score_count: facts.draftScoreCount,
      missing_score_count: facts.missingScoreCount,
      submitted_ratio: facts.submittedRatio,
      outlier_count: facts.outlierCount,
      excluded_judge_count: facts.excludedJudgeCount,
    },
  }

  try {
    const client = getTypeSafeClient()
    const response = await client.systemOne({
      model: 'jev-latest',
      state,
      questions: {
        lock_cue: choice(
          {
            question: 'Given `panel` and `context.meanings`, which soft-lock cue should the UI show?',
            focus:
              'Completeness and integrity risk for locking — not whether the head judge is confident personally.',
            inspect: ['`panel`', '`context.meanings`', '`context.policy`'],
          },
          {
            ready: {
              what: 'Show ready — locking looks appropriate',
              not_for: 'Missing cells, many drafts, or serious unresolved outliers',
              examples: ['All scores submitted, zero or mild outliers'],
            },
            caution: {
              what: 'Show caution — locking is possible after a quick review',
              not_for: 'Clearly incomplete panels or clean complete panels',
              examples: ['A few drafts left', 'A couple outliers still open'],
            },
            wait: {
              what: 'Show wait — locking now would freeze incomplete results',
              not_for: 'Near-complete panels with only polish left',
              examples: ['Many missing cells', 'Submitted ratio well under 90%'],
            },
          }
        ),
        completeness: score(
          {
            question: 'How complete is `panel` for locking scoring?',
            focus: 'Coverage of expected submitted scores, not artistic quality.',
            inspect: [
              '`panel.submitted_ratio`',
              '`panel.missing_score_count`',
              '`panel.draft_score_count`',
            ],
          },
          [
            {
              what: 'Incomplete — large gaps remain',
              signals: ['submitted_ratio well below 0.9', 'Many missing cells'],
            },
            {
              what: 'Mostly complete — small leftovers',
              signals: ['A few drafts or missing cells', 'Ratio near 0.95'],
            },
            {
              what: 'Fully covered — ready to freeze',
              signals: ['submitted_ratio near 1', 'No missing cells'],
            },
          ]
        ),
        integrity_risk: noul({
          question:
            'Does `panel` still carry unresolved integrity risk that a head judge should review before locking?',
          focus: 'Outliers and excluded judges, not ordinary variance.',
          inspect: ['`panel.outlier_count`', '`panel.excluded_judge_count`'],
        }),
      },
    })

    const parsed = parseChoiceAnswer(response.answers.lock_cue)
    let cue = parsed.choice
    if (parsed.confidence < CUE_CONFIDENCE_FLOOR) {
      cue = 'caution'
    }
    cue = forceCueFromFacts(facts, cue)

    return {
      configured: true,
      cue,
      confidence: parsed.confidence,
      probabilities: parsed.probabilities,
      integrityRisk: parseNoul(response.answers.integrity_risk),
      completenessScore: parseScore(response.answers.completeness),
      headline: headlineFor(cue, 'lock'),
      reasons,
      facts,
      thresholds,
    }
  } catch (err) {
    console.error('assessLockReadiness TypeSafe failed:', err)
    const cue = forceCueFromFacts(facts, facts.outlierCount > 0 ? 'caution' : 'ready')
    return {
      configured: false,
      cue,
      confidence: 0,
      probabilities: {},
      integrityRisk: 0,
      completenessScore: facts.submittedRatio,
      headline: headlineFor(cue, 'lock'),
      reasons: [...reasons, 'TypeSafe unavailable — showing deterministic cue.'],
      facts,
      thresholds,
    }
  }
}

function buildFinalizeReasons(facts: FinalizeEventFacts): string[] {
  const reasons: string[] = []
  for (const b of facts.hardBlockers) reasons.push(b.message)
  if (facts.unlockedDivisionNames.length > 0) {
    reasons.push(
      `Unlocked: ${facts.unlockedDivisionNames.slice(0, 5).join(', ')}${
        facts.unlockedDivisionNames.length > 5 ? '…' : ''
      }`
    )
  }
  if (facts.totalOutliersAcrossLocked > 0) {
    reasons.push(
      `${facts.totalOutliersAcrossLocked} outlier mark${
        facts.totalOutliersAcrossLocked === 1 ? '' : 's'
      } across locked divisions.`
    )
  }
  if (facts.excludedJudgeCount > 0) {
    reasons.push(
      `${facts.excludedJudgeCount} excluded judge assignment${
        facts.excludedJudgeCount === 1 ? '' : 's'
      }.`
    )
  }
  if (
    facts.hardBlockers.length === 0 &&
    facts.totalOutliersAcrossLocked === 0 &&
    facts.lockedDivisionCount === facts.divisionCount
  ) {
    reasons.push('All category divisions locked; no open outliers flagged.')
  }
  return reasons
}

/**
 * Soft cue before finalize. Hard blockers still come from getFinalizeBlockers.
 */
export async function assessFinalizeReadiness(
  facts: FinalizeEventFacts
): Promise<FinalizeReadinessResult> {
  const reasons = buildFinalizeReasons(facts)

  if (facts.hardBlockers.length > 0) {
    return {
      configured: isTypeSafeConfigured(),
      cue: 'wait',
      confidence: 1,
      probabilities: { wait: 1 },
      integrityRisk: 0,
      headline: headlineFor('wait', 'finalize'),
      reasons,
      facts,
    }
  }

  if (!isTypeSafeConfigured()) {
    const cue: LockCue =
      facts.totalOutliersAcrossLocked > 0 || facts.excludedJudgeCount > 0
        ? 'caution'
        : 'ready'
    return {
      configured: false,
      cue,
      confidence: 0,
      probabilities: {},
      integrityRisk: 0,
      headline: headlineFor(cue, 'finalize'),
      reasons,
      facts,
    }
  }

  const state = {
    event_name: facts.eventName,
    context: {
      what: 'Admin awarding season ranking points after divisions are locked.',
      policy: 'Hard finalize remains a human POST. Cue only advises ready/caution/wait.',
      meanings: {
        ready: 'Safe to award points.',
        caution: 'Allowed, but review outliers/exclusions first.',
        wait: 'Hard rules still block finalize (should not reach here).',
      },
    },
    event: {
      division_count: facts.divisionCount,
      locked_division_count: facts.lockedDivisionCount,
      unlocked_names: facts.unlockedDivisionNames,
      outlier_marks_on_locked: facts.totalOutliersAcrossLocked,
      excluded_judge_assignments: facts.excludedJudgeCount,
      hard_blocker_count: facts.hardBlockers.length,
    },
  }

  try {
    const client = getTypeSafeClient()
    const response = await client.systemOne({
      model: 'jev-latest',
      state,
      questions: {
        finalize_cue: choice(
          {
            question: 'Given `event` and `context.meanings`, which finalize cue should the UI show?',
            focus: 'Integrity of locked panels for writing season points.',
            inspect: ['`event`', '`context.meanings`'],
          },
          {
            ready: {
              what: 'Show ready to finalize',
              not_for: 'Open integrity issues on locked panels',
              examples: ['All locked, no outliers'],
            },
            caution: {
              what: 'Show caution — finalize after a glance',
              not_for: 'Hard blockers or clean panels',
              examples: ['Locked with residual outliers', 'Some judges excluded'],
            },
            wait: {
              what: 'Show wait — do not finalize',
              not_for: 'When hard blockers are already empty and panels look fine',
              examples: ['Unlocked divisions still present'],
            },
          }
        ),
        integrity_risk: noul({
          question:
            'Does awarding season points now carry unresolved integrity risk from outliers or exclusions?',
          inspect: ['`event.outlier_marks_on_locked`', '`event.excluded_judge_assignments`'],
        }),
      },
    })

    const parsed = parseChoiceAnswer(response.answers.finalize_cue)
    let cue = parsed.choice
    if (parsed.confidence < CUE_CONFIDENCE_FLOOR) cue = 'caution'
    if (facts.hardBlockers.length > 0) cue = 'wait'
    else if (cue === 'wait') cue = 'caution' // hard path clear — never soft-block
    else if (facts.totalOutliersAcrossLocked > 0 && cue === 'ready') cue = 'caution'

    return {
      configured: true,
      cue,
      confidence: parsed.confidence,
      probabilities: parsed.probabilities,
      integrityRisk: parseNoul(response.answers.integrity_risk),
      headline: headlineFor(cue, 'finalize'),
      reasons,
      facts,
    }
  } catch (err) {
    console.error('assessFinalizeReadiness TypeSafe failed:', err)
    const cue: LockCue =
      facts.totalOutliersAcrossLocked > 0 || facts.excludedJudgeCount > 0
        ? 'caution'
        : 'ready'
    return {
      configured: false,
      cue,
      confidence: 0,
      probabilities: {},
      integrityRisk: 0,
      headline: headlineFor(cue, 'finalize'),
      reasons: [...reasons, 'TypeSafe unavailable — showing deterministic cue.'],
      facts,
    }
  }
}

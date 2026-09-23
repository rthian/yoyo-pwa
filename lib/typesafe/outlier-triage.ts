/**
 * TypeSafe outlier triage for head-judge visualiser.
 * Callers: app/api/divisions/[id]/outlier-triage/route.ts
 * Deterministic outliers come from lib/utils/judge-analytics; Jev only classifies action.
 * User: "Lets start" (outlier triage)
 */
import { choice, noul, score } from '@typesafe-ai/sdk'
import { createHmac } from 'crypto'
import { getTypeSafeClient, isTypeSafeConfigured } from '@/lib/typesafe/client'
import type { OutlierInfo, JudgeScoreSummary, VisualiserJudge } from '@/lib/types/visualiser'

/** Exclude from leaderboard only at high confidence (high stakes). */
export const EXCLUDE_CONFIDENCE_MIN = 0.85
/** Below this, treat any pick as review / do not act. */
export const ACT_CONFIDENCE_FLOOR = 0.5

export type TriageDecision = 'ok' | 'review' | 'exclude'

export interface OutlierTriageItem {
  key: string
  judgeId: string
  judgeName: string
  divisionMemberId: string
  participantName: string
  score: number
  panelMean: number
  deviation: number
  isSubmitted: boolean
  judgeType: string
  currentlyIncluded: boolean
  decision: TriageDecision
  confidence: number
  probabilities: Record<string, number>
  severity: number
  severityConfidence: number
  looksLikeMistake: number
  /** Code policy: may call apply without extra confirm */
  canAutoExclude: boolean
  /** Exclude suggested but confidence below auto threshold */
  needsConfirmToExclude: boolean
}

export interface OutlierTriageResult {
  configured: boolean
  items: OutlierTriageItem[]
  thresholds: {
    excludeConfidenceMin: number
    actConfidenceFloor: number
  }
}

function outlierKey(o: OutlierInfo): string {
  return `${o.judge_id}:${o.division_member_id}`
}

export async function triageOutliers(input: {
  divisionName: string
  outliers: OutlierInfo[]
  judgeSummaries: JudgeScoreSummary[]
  judges: VisualiserJudge[]
}): Promise<OutlierTriageResult> {
  const thresholds = {
    excludeConfidenceMin: EXCLUDE_CONFIDENCE_MIN,
    actConfidenceFloor: ACT_CONFIDENCE_FLOOR,
  }

  if (!isTypeSafeConfigured()) {
    return { configured: false, items: [], thresholds }
  }

  const capped = input.outliers.slice(0, 20)
  if (capped.length === 0) {
    return { configured: true, items: [], thresholds }
  }

  const judgeById = new Map(input.judges.map((j) => [j.id, j]))
  const summaryById = new Map(input.judgeSummaries.map((j) => [j.judge_id, j]))

  const state = {
    division_name: input.divisionName,
    context: {
      what: 'Yo-yo freestyle panel scoring. Counting judges score the same competitors.',
      outlier_rule:
        'A score is an outlier when |deviation from panel mean| exceeds max(1.5×stdDev, 2.0).',
      action_meanings: {
        ok: 'Leave the score/judge counting as-is; deviation looks normal or explainable.',
        review: 'Head judge should inspect before changing include-in-results.',
        exclude:
          'Strong evidence the judge should be excluded from leaderboard averages (not just one quirky mark).',
      },
    },
    judges: input.judges.map((j) => ({
      id: j.id,
      name: j.full_name,
      type: j.judge_type,
      included_in_leaderboard: j.scores_included_in_leaderboard !== false,
      avg_deviation: summaryById.get(j.id)?.avgDeviation ?? null,
      outlier_count: summaryById.get(j.id)?.outlierCount ?? 0,
    })),
    outliers: capped.map((o) => {
      const j = judgeById.get(o.judge_id)
      const summary = summaryById.get(o.judge_id)
      return {
        key: outlierKey(o),
        judge_id: o.judge_id,
        judge_name: o.judge_name,
        judge_type: j?.judge_type ?? 'unknown',
        currently_included: j?.scores_included_in_leaderboard !== false,
        participant_name: o.participant_name,
        division_member_id: o.division_member_id,
        score: o.score,
        panel_mean: o.panel_mean,
        deviation: o.deviation,
        abs_deviation: Math.abs(o.deviation),
        is_submitted: o.is_submitted,
        judge_avg_deviation: summary?.avgDeviation ?? null,
        judge_outlier_count: summary?.outlierCount ?? 0,
      }
    }),
  }

  const questions: Record<
    string,
    ReturnType<typeof choice> | ReturnType<typeof score> | ReturnType<typeof noul>
  > = {}

  for (const o of state.outliers) {
    const path = `outliers[key=${o.key}]`
    questions[`action_${o.key}`] = choice(
      {
        question: `For outlier \`${path}\`, what should the head judge do about this judge's counting status?`,
        focus:
          'Judge whether this is a one-off mark, needs human review, or warrants excluding the judge from leaderboard averages.',
        inspect: [`\`${path}\``, '`judges`', '`context.action_meanings`'],
      },
      {
        ok: {
          what: 'Keep counting this judge; deviation is normal variance or explainable',
          not_for: 'Systematic bias or training mistakes that harm the panel average',
          examples: ['Slightly high but consistent with style', 'Single competitor quirk'],
        },
        review: {
          what: 'Needs head-judge eyes before changing include-in-results',
          not_for: 'Clear keep or clear exclude cases',
          examples: ['Large swing on one player only', 'Draft score still changing'],
        },
        exclude: {
          what: 'Exclude this judge from leaderboard averages',
          not_for: 'One debatable mark when the rest of their sheet is fine',
          examples: [
            'Many outliers and high avg deviation',
            'Looks like mis-clicker or wrong competitor',
          ],
        },
      }
    )

    questions[`severity_${o.key}`] = score(
      {
        question: `How severe is outlier \`${path}\` for panel integrity?`,
        focus: 'Severity of distorting the panel average, not how angry anyone is.',
        inspect: [`\`${path}.abs_deviation\``, `\`${path}.judge_outlier_count\``],
      },
      [
        {
          what: 'Mild — within noisy freestyle variance',
          signals: ['|deviation| near threshold', 'Judge otherwise aligned'],
        },
        {
          what: 'Notable — worth checking',
          signals: ['Clear swing on this competitor', 'A few outliers for the judge'],
        },
        {
          what: 'Severe — likely distorts standings if left counting',
          signals: ['Large |deviation|', 'Repeated outliers for same judge'],
        },
      ]
    )

    questions[`mistake_${o.key}`] = noul({
      question: `Does outlier \`${path}\` look like a scoring mistake or training error rather than a legitimate artistic disagreement?`,
      inspect: [`\`${path}\``, '`judges`'],
      focus: 'Mistake/mis-entry/wrong player vs honest hard/soft marking.',
    })
  }

  const client = getTypeSafeClient()
  const response = await client.systemOne({
    model: 'jev-latest',
    state,
    questions,
  })

  const items: OutlierTriageItem[] = capped.map((o) => {
    const key = outlierKey(o)
    const j = judgeById.get(o.judge_id)
    const actionRaw = response.answers[`action_${key}`]
    const severityRaw = response.answers[`severity_${key}`]
    const mistakeRaw = response.answers[`mistake_${key}`]

    const actionChoice =
      actionRaw &&
      typeof actionRaw === 'object' &&
      'choice' in actionRaw &&
      (actionRaw.choice === 'ok' ||
        actionRaw.choice === 'review' ||
        actionRaw.choice === 'exclude')
        ? (actionRaw.choice as TriageDecision)
        : ('review' as TriageDecision)
    const confidence =
      actionRaw &&
      typeof actionRaw === 'object' &&
      'confidence' in actionRaw &&
      typeof actionRaw.confidence === 'number'
        ? actionRaw.confidence
        : 0
    const probabilities =
      actionRaw &&
      typeof actionRaw === 'object' &&
      'probabilities' in actionRaw &&
      actionRaw.probabilities &&
      typeof actionRaw.probabilities === 'object'
        ? (actionRaw.probabilities as Record<string, number>)
        : {}

    let decision = actionChoice
    if (confidence < ACT_CONFIDENCE_FLOOR) {
      decision = 'review'
    }

    const severity =
      severityRaw &&
      typeof severityRaw === 'object' &&
      'score' in severityRaw &&
      typeof severityRaw.score === 'number'
        ? severityRaw.score
        : 0
    const severityConfidence =
      severityRaw &&
      typeof severityRaw === 'object' &&
      'confidence' in severityRaw &&
      typeof severityRaw.confidence === 'number'
        ? severityRaw.confidence
        : 0
    const looksLikeMistake =
      mistakeRaw &&
      typeof mistakeRaw === 'object' &&
      'noul' in mistakeRaw &&
      typeof mistakeRaw.noul === 'number'
        ? mistakeRaw.noul
        : 0

    const canAutoExclude =
      decision === 'exclude' &&
      confidence >= EXCLUDE_CONFIDENCE_MIN &&
      j?.judge_type !== 'shadow' &&
      j?.scores_included_in_leaderboard !== false

    const needsConfirmToExclude =
      decision === 'exclude' &&
      confidence >= ACT_CONFIDENCE_FLOOR &&
      confidence < EXCLUDE_CONFIDENCE_MIN &&
      j?.scores_included_in_leaderboard !== false

    return {
      key,
      judgeId: o.judge_id,
      judgeName: o.judge_name,
      divisionMemberId: o.division_member_id,
      participantName: o.participant_name,
      score: o.score,
      panelMean: o.panel_mean,
      deviation: o.deviation,
      isSubmitted: o.is_submitted,
      judgeType: j?.judge_type ?? 'unknown',
      currentlyIncluded: j?.scores_included_in_leaderboard !== false,
      decision,
      confidence,
      probabilities,
      severity,
      severityConfidence,
      looksLikeMistake,
      canAutoExclude,
      needsConfirmToExclude,
    }
  })

  return { configured: true, items, thresholds }
}

/** Short-lived apply authorization from evaluate (HMAC). Avoids re-calling Jev on mutate. */
export interface ExcludeApplyPayload {
  divisionId: string
  judgeId: string
  decision: 'exclude'
  confidence: number
  exp: number
}

function applySecret(): string {
  const key = process.env.TYPESAFE_API_KEY?.trim()
  if (!key) throw new Error('Missing TYPESAFE_API_KEY')
  return key
}

export function mintExcludeApplyToken(
  divisionId: string,
  item: Pick<OutlierTriageItem, 'judgeId' | 'decision' | 'confidence'>,
  ttlMs = 10 * 60 * 1000
): string | null {
  if (item.decision !== 'exclude') return null
  if (item.confidence < ACT_CONFIDENCE_FLOOR) return null
  const payload: ExcludeApplyPayload = {
    divisionId,
    judgeId: item.judgeId,
    decision: 'exclude',
    confidence: item.confidence,
    exp: Date.now() + ttlMs,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', applySecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyExcludeApplyToken(
  token: string,
  divisionId: string,
  judgeId: string
): { ok: true; payload: ExcludeApplyPayload } | { ok: false; error: string } {
  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, error: 'Invalid apply token' }
  const [body, sig] = parts
  const expected = createHmac('sha256', applySecret()).update(body).digest('base64url')
  if (sig !== expected) return { ok: false, error: 'Invalid apply token' }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ExcludeApplyPayload
    if (payload.divisionId !== divisionId || payload.judgeId !== judgeId) {
      return { ok: false, error: 'Apply token mismatch' }
    }
    if (payload.decision !== 'exclude') {
      return { ok: false, error: 'Apply token is not an exclude grant' }
    }
    if (typeof payload.confidence !== 'number') {
      return { ok: false, error: 'Apply token missing confidence' }
    }
    if (payload.exp < Date.now()) {
      return { ok: false, error: 'Apply token expired — run Suggest triage again' }
    }
    return { ok: true, payload }
  } catch {
    return { ok: false, error: 'Invalid apply token' }
  }
}

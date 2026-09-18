/**
 * Judge analytics: panel stats, deviations, outlier detection
 */
import type {
  VisualiserScore,
  ParticipantPanelStats,
  OutlierInfo,
  JudgeScoreSummary,
} from '@/lib/types/visualiser'

const OUTLIER_STDDEV_MULTIPLIER = 1.5
const OUTLIER_FIXED_THRESHOLD = 2.0

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const squaredDiffs = values.map((v) => (v - mean) ** 2)
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Per-participant panel stats: mean and stdDev of total_score (2+ scores)
 */
export function computeParticipantPanelStats(
  scores: VisualiserScore[]
): Map<string, ParticipantPanelStats> {
  const byParticipant = new Map<string, VisualiserScore[]>()
  for (const s of scores) {
    const list = byParticipant.get(s.division_member_id) ?? []
    list.push(s)
    byParticipant.set(s.division_member_id, list)
  }

  const result = new Map<string, ParticipantPanelStats>()
  for (const [divisionMemberId, list] of byParticipant) {
    if (list.length < 2) continue
    const values = list.map((s) => s.total_score)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const roundedMean = Math.round(mean * 100) / 100
    result.set(divisionMemberId, {
      division_member_id: divisionMemberId,
      mean: roundedMean,
      stdDev: Math.round(stdDev(values, mean) * 100) / 100,
      scoreCount: list.length,
    })
  }
  return result
}

/**
 * Deviation from panel mean (panel includes all judges for that participant).
 * Outlier when |deviation| > max(1.5 * stdDev, 2.0)
 */
export function computeOutliers(
  scores: VisualiserScore[],
  panelStats: Map<string, ParticipantPanelStats>,
  participantNames: Map<string, string>
): OutlierInfo[] {
  const outliers: OutlierInfo[] = []
  for (const s of scores) {
    const stats = panelStats.get(s.division_member_id)
    if (!stats || stats.scoreCount < 2) continue
    const deviation = Math.round((s.total_score - stats.mean) * 100) / 100
    const threshold = Math.max(
      OUTLIER_STDDEV_MULTIPLIER * stats.stdDev,
      OUTLIER_FIXED_THRESHOLD
    )
    if (Math.abs(deviation) > threshold) {
      outliers.push({
        judge_id: s.judge_id,
        judge_name: s.judge_name,
        division_member_id: s.division_member_id,
        participant_name: participantNames.get(s.division_member_id) ?? 'Unknown',
        score: s.total_score,
        panel_mean: stats.mean,
        deviation,
        is_submitted: s.is_submitted,
      })
    }
  }
  return outliers
}

/**
 * Per-judge summary: avg absolute deviation from panel mean, outlier count
 */
export function computeJudgeSummaries(
  scores: VisualiserScore[],
  panelStats: Map<string, ParticipantPanelStats>
): JudgeScoreSummary[] {
  const byJudge = new Map<
    string,
    { name: string; deviations: number[]; outlierCount: number }
  >()

  for (const s of scores) {
    const stats = panelStats.get(s.division_member_id)
    if (!stats || stats.scoreCount < 2) continue
    const deviation = s.total_score - stats.mean
    const threshold = Math.max(
      OUTLIER_STDDEV_MULTIPLIER * stats.stdDev,
      OUTLIER_FIXED_THRESHOLD
    )
    const isOutlier = Math.abs(deviation) > threshold

    let entry = byJudge.get(s.judge_id)
    if (!entry) {
      entry = { name: s.judge_name, deviations: [], outlierCount: 0 }
      byJudge.set(s.judge_id, entry)
    }
    entry.deviations.push(deviation)
    if (isOutlier) entry.outlierCount += 1
  }

  return Array.from(byJudge.entries()).map(([judge_id, { name, deviations, outlierCount }]) => {
    const avgDeviation =
      deviations.length === 0
        ? 0
        : Math.round(
            (deviations.reduce((a, b) => a + b, 0) / deviations.length) * 100
          ) / 100
    return {
      judge_id,
      judge_name: name,
      scoreCount: deviations.length,
      avgDeviation,
      outlierCount,
    }
  })
}

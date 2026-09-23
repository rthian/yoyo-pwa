/**
 * Smoke-check TypeSafe outlier triage with synthetic panel state.
 * Run: npx tsx --env-file=.env.local scripts/smoke-outlier-triage.ts
 * Imports: lib/typesafe/outlier-triage.ts
 * User: "Lets start" (outlier triage)
 */
import { triageOutliers } from '../lib/typesafe/outlier-triage'
import type { OutlierInfo, JudgeScoreSummary, VisualiserJudge } from '../lib/types/visualiser'

async function main() {
  const judges: VisualiserJudge[] = [
    { id: 'j-alice', full_name: 'Alice', judge_type: 'counting', scores_included_in_leaderboard: true },
    { id: 'j-bob', full_name: 'Bob', judge_type: 'counting', scores_included_in_leaderboard: true },
    { id: 'j-cara', full_name: 'Cara', judge_type: 'counting', scores_included_in_leaderboard: true },
  ]

  const outliers: OutlierInfo[] = [
    {
      judge_id: 'j-bob',
      judge_name: 'Bob',
      division_member_id: 'dm-1',
      participant_name: 'Player One',
      score: 92,
      panel_mean: 68,
      deviation: 24,
      is_submitted: true,
    },
    {
      judge_id: 'j-bob',
      judge_name: 'Bob',
      division_member_id: 'dm-2',
      participant_name: 'Player Two',
      score: 88,
      panel_mean: 65,
      deviation: 23,
      is_submitted: true,
    },
  ]

  const judgeSummaries: JudgeScoreSummary[] = [
    { judge_id: 'j-alice', judge_name: 'Alice', scoreCount: 4, avgDeviation: 0.4, outlierCount: 0 },
    { judge_id: 'j-bob', judge_name: 'Bob', scoreCount: 4, avgDeviation: 18.5, outlierCount: 2 },
    { judge_id: 'j-cara', judge_name: 'Cara', scoreCount: 4, avgDeviation: -0.8, outlierCount: 0 },
  ]

  const result = await triageOutliers({
    divisionName: '1A Open (smoke)',
    outliers,
    judgeSummaries,
    judges,
  })

  console.log(
    JSON.stringify(
      {
        configured: result.configured,
        thresholds: result.thresholds,
        items: result.items.map((i) => ({
          key: i.key,
          decision: i.decision,
          confidence: i.confidence,
          severity: i.severity,
          looksLikeMistake: i.looksLikeMistake,
          canAutoExclude: i.canAutoExclude,
          needsConfirmToExclude: i.needsConfirmToExclude,
        })),
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

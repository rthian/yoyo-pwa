/**
 * Smoke-check soft lock readiness.
 * Run: npx tsx --env-file=.env.local scripts/smoke-lock-readiness.ts
 * Callers: manual / CI smoke (not imported by app).
 * Glob: scripts/smoke-outlier-triage.ts exists; no prior smoke-lock-readiness.
 * Synthetic facts only — no DB. User: "yes please"
 */
import { assessLockReadiness, assessFinalizeReadiness } from '../lib/typesafe/lock-readiness'

async function main() {
  const incomplete = await assessLockReadiness({
    divisionName: '1A Open (smoke incomplete)',
    scoringLocked: false,
    participantCount: 10,
    countingJudgeCount: 3,
    expectedScoreCells: 30,
    submittedScoreCount: 18,
    draftScoreCount: 4,
    missingScoreCount: 8,
    outlierCount: 1,
    excludedJudgeCount: 0,
    submittedRatio: 0.6,
  })

  const nearly = await assessLockReadiness({
    divisionName: '1A Open (smoke nearly complete)',
    scoringLocked: false,
    participantCount: 10,
    countingJudgeCount: 3,
    expectedScoreCells: 30,
    submittedScoreCount: 29,
    draftScoreCount: 1,
    missingScoreCount: 0,
    outlierCount: 2,
    excludedJudgeCount: 0,
    submittedRatio: 0.967,
  })

  const finalize = await assessFinalizeReadiness({
    eventName: 'Smoke Cup',
    divisionCount: 2,
    lockedDivisionCount: 2,
    unlockedDivisionNames: [],
    totalOutliersAcrossLocked: 3,
    excludedJudgeCount: 1,
    hardBlockers: [],
  })

  console.log(
    JSON.stringify(
      {
        incomplete: {
          configured: incomplete.configured,
          cue: incomplete.cue,
          headline: incomplete.headline,
          reasons: incomplete.reasons,
        },
        nearly: {
          configured: nearly.configured,
          cue: nearly.cue,
          headline: nearly.headline,
          confidence: nearly.confidence,
        },
        finalize: {
          configured: finalize.configured,
          cue: finalize.cue,
          headline: finalize.headline,
        },
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

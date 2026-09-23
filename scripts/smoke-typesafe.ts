/**
 * Smoke-check TypeSafe connectivity.
 * Run: npx tsx --env-file=.env.local scripts/smoke-typesafe.ts
 * Caller: manual / CI smoke. Imports lib/typesafe/client.ts.
 * User: "install for me i have api key"
 */
import { choice, noul } from '@typesafe-ai/sdk'
import { getTypeSafeClient } from '../lib/typesafe/client'

async function main() {
  const client = getTypeSafeClient()
  const response = await client.systemOne({
    model: 'jev-latest',
    state: {
      note: 'YoYo League connectivity check for panel-ready decisions.',
    },
    questions: {
      aboutContestOps: noul(
        'Is this note about contest operations rather than billing?'
      ),
      surface: choice('Which product surface does this note relate to?', {
        judging: 'Floor judging, panels, scores',
        rankings: 'Season points and race boards',
        other: 'Something else',
      }),
    },
  })

  console.log(
    JSON.stringify(
      {
        aboutContestOps: response.answers.aboutContestOps.noul,
        surface: response.answers.surface.choice,
        surfaceConfidence: response.answers.surface.confidence,
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

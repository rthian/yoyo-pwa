/**
 * Offline smoke: judge analytics thresholds (no env / DB).
 * Invoked by `npm test` / CI.
 */
import {
  computeOutliers,
  computeParticipantPanelStats,
} from '../lib/utils/judge-analytics'
import type { VisualiserScore } from '../lib/types/visualiser'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const scores: VisualiserScore[] = [
  {
    id: '1',
    division_member_id: 'p1',
    judge_id: 'j1',
    judge_name: 'A',
    total_score: 40,
    technical_score: 20,
    performance_score: 20,
    is_submitted: true,
  },
  {
    id: '2',
    division_member_id: 'p1',
    judge_id: 'j2',
    judge_name: 'B',
    total_score: 41,
    technical_score: 20,
    performance_score: 21,
    is_submitted: true,
  },
  {
    id: '3',
    division_member_id: 'p1',
    judge_id: 'j3',
    judge_name: 'C',
    total_score: 42,
    technical_score: 21,
    performance_score: 21,
    is_submitted: true,
  },
  {
    id: '4',
    division_member_id: 'p1',
    judge_id: 'j4',
    judge_name: 'D',
    total_score: 100,
    technical_score: 50,
    performance_score: 50,
    is_submitted: true,
  },
]

const stats = computeParticipantPanelStats(scores)
const panel = stats.get('p1')
assert(panel, 'expected panel stats for p1')
assert(panel.scoreCount === 4, `scoreCount ${panel.scoreCount}`)

const names = new Map([['p1', 'Demo']])
const outliers = computeOutliers(scores, stats, names)
assert(outliers.length >= 1, `expected outlier(s), got ${outliers.length}`)
assert(
  outliers.some((o) => o.judge_id === 'j4'),
  'expected judge j4 as outlier'
)

console.log('smoke-judge-analytics: ok')

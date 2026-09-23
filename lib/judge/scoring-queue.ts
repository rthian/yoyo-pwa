/**
 * Floor-judge scoring queue ordered by play_order (run order).
 * Callers: app/(judge)/judge/queue/page.tsx, divisions/[id]/page.tsx, score page.
 * User: "ok lets start" (queue = play_order)
 */

export type QueueItemStatus = 'pending' | 'draft' | 'submitted'

export interface ScoringQueueItem {
  divisionId: string
  divisionName: string
  eventName: string
  eventDate: string | null
  divisionMemberId: string
  participantName: string
  nickname: string | null
  playOrder: number | null
  status: QueueItemStatus
  totalScore: number | null
  scoringLocked: boolean
}

/** Sort for stage use: event date → division name → play_order (nulls last). */
export function sortScoringQueue(items: ScoringQueueItem[]): ScoringQueueItem[] {
  return [...items].sort((a, b) => {
    const da = a.eventDate ?? ''
    const db = b.eventDate ?? ''
    if (da !== db) return da.localeCompare(db)
    const dn = a.divisionName.localeCompare(b.divisionName)
    if (dn !== 0) return dn
    const pa = a.playOrder ?? Number.MAX_SAFE_INTEGER
    const pb = b.playOrder ?? Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return a.participantName.localeCompare(b.participantName)
  })
}

/** Next person to score: earliest unfinished (pending or draft), skip locked. */
export function nextInQueue(items: ScoringQueueItem[]): ScoringQueueItem | null {
  const sorted = sortScoringQueue(items)
  return (
    sorted.find(
      (i) => !i.scoringLocked && (i.status === 'pending' || i.status === 'draft')
    ) ?? null
  )
}

/** Within one division: next unfinished after current (by play_order). */
export function nextInDivision(
  items: ScoringQueueItem[],
  currentDivisionMemberId: string
): ScoringQueueItem | null {
  const inDiv = sortScoringQueue(
    items.filter((i) => !i.scoringLocked && i.status !== 'submitted')
  )
  if (inDiv.length === 0) return null
  const idx = inDiv.findIndex((i) => i.divisionMemberId === currentDivisionMemberId)
  if (idx === -1) return inDiv[0] ?? null
  return inDiv[idx + 1] ?? null
}

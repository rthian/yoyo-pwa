/**
 * Judge Score Queue — run order by play_order (not only drafts).
 * Callers: JudgeBottomNav (/judge/queue), judge home Continue/Open queue links.
 * Replaces draft-only queue. User: "ok lets start" (queue = play_order)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, ChevronRight, Inbox, Gavel, CheckCircle2 } from 'lucide-react'
import {
  nextInQueue,
  sortScoringQueue,
  type ScoringQueueItem,
  type QueueItemStatus,
} from '@/lib/judge/scoring-queue'

export default async function JudgeQueuePage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: assignments } = await supabaseAdmin
    .from('division_judges')
    .select(`
      division_id,
      division:divisions(
        id,
        name,
        scoring_locked,
        event:events(id, name, status, event_date)
      )
    `)
    .eq('member_id', user.id)

  type AssignmentRow = {
    division_id: string
    division: {
      id: string
      name: string
      scoring_locked?: boolean
      event:
        | { id: string; name: string; status: string; event_date: string | null }
        | { id: string; name: string; status: string; event_date: string | null }[]
        | null
    } | null
  }

  const divisions = ((assignments as AssignmentRow[] | null) ?? [])
    .map((a) => {
      if (!a.division) return null
      const event = Array.isArray(a.division.event)
        ? a.division.event[0]
        : a.division.event
      return {
        id: a.division.id,
        name: a.division.name,
        scoringLocked: a.division.scoring_locked === true,
        eventName: event?.name ?? 'Event',
        eventDate: event?.event_date ?? null,
        eventStatus: event?.status ?? '',
      }
    })
    .filter((d): d is NonNullable<typeof d> => d != null)
    .filter((d) => d.eventStatus === 'active' || d.eventStatus === 'upcoming')

  const divisionIds = divisions.map((d) => d.id)
  const items: ScoringQueueItem[] = []

  if (divisionIds.length > 0) {
    const { data: members } = await supabaseAdmin
      .from('division_members')
      .select(`
        id,
        division_id,
        play_order,
        member:members(full_name, nickname)
      `)
      .in('division_id', divisionIds)
      .order('play_order', { ascending: true })

    const memberIds = (members ?? []).map((m) => m.id)
    const { data: scores } = memberIds.length
      ? await supabaseAdmin
          .from('scores')
          .select('division_member_id, is_submitted, total_score')
          .eq('judge_id', user.id)
          .in('division_member_id', memberIds)
      : {
          data: [] as {
            division_member_id: string
            is_submitted: boolean
            total_score: number
          }[],
        }

    const scoreByMember = new Map(
      (scores ?? []).map((s) => [s.division_member_id, s])
    )
    const divisionById = new Map(divisions.map((d) => [d.id, d]))

    for (const row of members ?? []) {
      const div = divisionById.get(row.division_id)
      if (!div) continue
      const rawMember = row.member as
        | { full_name: string; nickname: string | null }
        | { full_name: string; nickname: string | null }[]
        | null
      const member = Array.isArray(rawMember) ? rawMember[0] : rawMember
      const score = scoreByMember.get(row.id)
      let status: QueueItemStatus = 'pending'
      if (score?.is_submitted) status = 'submitted'
      else if (score) status = 'draft'

      items.push({
        divisionId: div.id,
        divisionName: div.name,
        eventName: div.eventName,
        eventDate: div.eventDate,
        divisionMemberId: row.id,
        participantName: member?.full_name ?? 'Unknown',
        nickname: member?.nickname ?? null,
        playOrder: row.play_order,
        status,
        totalScore: score?.total_score != null ? Number(score.total_score) : null,
        scoringLocked: div.scoringLocked,
      })
    }
  }

  const upNext = nextInQueue(items)
  const unfinished = sortScoringQueue(
    items.filter((i) => i.status === 'pending' || i.status === 'draft')
  )
  const doneCount = items.filter((i) => i.status === 'submitted').length

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-2xl font-bold">Score Queue</h1>
        <p className="text-muted-foreground">
          Next up by play order · {unfinished.length} left · {doneCount} done
        </p>
      </div>

      {upNext ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Up next
            </p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold tabular-nums">
                {upNext.playOrder ?? '—'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-lg truncate">{upNext.participantName}</p>
                {upNext.nickname && (
                  <p className="text-sm text-muted-foreground truncate">
                    &quot;{upNext.nickname}&quot;
                  </p>
                )}
                <p className="text-sm text-muted-foreground truncate">
                  {upNext.divisionName} · {upNext.eventName}
                </p>
              </div>
              {upNext.status === 'draft' && (
                <Badge variant="outline" className="text-yellow-600 shrink-0">
                  Draft
                </Badge>
              )}
            </div>
            <Button asChild className="w-full h-12 rounded-full">
              <Link
                href={`/judge/divisions/${upNext.divisionId}/score/${upNext.divisionMemberId}`}
              >
                <Gavel className="h-5 w-5 mr-2" />
                Score now
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {unfinished.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Run order
          </h2>
          {unfinished.map((item) => {
            const locked = item.scoringLocked
            const href = `/judge/divisions/${item.divisionId}/score/${item.divisionMemberId}`
            const isUpNext = upNext?.divisionMemberId === item.divisionMemberId
            const card = (
              <Card
                className={`transition-colors ${
                  isUpNext ? 'border-primary ring-1 ring-primary/40' : ''
                } ${!locked ? 'hover:bg-accent active:scale-[0.98]' : 'opacity-70'}`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-bold tabular-nums">
                    {item.playOrder ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.participantName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.divisionName}
                      {locked ? ' · locked' : ''}
                    </p>
                  </div>
                  {item.status === 'draft' ? (
                    <Badge variant="outline" className="text-yellow-600 shrink-0">
                      Draft
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      Score
                    </Badge>
                  )}
                  {!locked && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </CardContent>
              </Card>
            )
            return locked ? (
              <div key={item.divisionMemberId}>{card}</div>
            ) : (
              <Link key={item.divisionMemberId} href={href}>
                {card}
              </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            {items.length > 0 ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="font-semibold mb-2">All caught up</h3>
                <p className="text-sm text-muted-foreground">
                  Every assigned participant is submitted.
                </p>
              </>
            ) : (
              <>
                <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Queue empty</h3>
                <p className="text-sm text-muted-foreground">
                  No active or upcoming divisions assigned to you.
                </p>
              </>
            )}
            <Link
              href="/judge/divisions"
              className="text-primary text-sm mt-2 hover:underline"
            >
              Go to divisions
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

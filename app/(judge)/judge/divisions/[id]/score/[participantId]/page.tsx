/**
 * Scoring Page
 * Mobile-optimized scoring form for a participant
 * Callers: Links from /judge/divisions/[id], /judge/queue
 * User: "ok lets start" (queue = play_order — next after submit)
 */
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ScoringForm from '@/components/judge/ScoringForm'
import { nextInDivision } from '@/lib/judge/scoring-queue'

interface ScoringPageProps {
  params: Promise<{ id: string; participantId: string }>
}

export default async function ScoringPage({ params }: ScoringPageProps) {
  const { id: divisionId, participantId } = await params
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: assignment } = await supabaseAdmin
    .from('division_judges')
    .select('*')
    .eq('division_id', divisionId)
    .eq('member_id', user.id)
    .single()

  if (!assignment) {
    notFound()
  }

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select(`
      *,
      event:events(
        id,
        name,
        status,
        ruleset_id,
        ruleset:rulesets(
          id,
          name,
          code,
          version,
          source_url,
          rules_content,
          scoring_config
        )
      )
    `)
    .eq('id', divisionId)
    .single()

  if (!division) {
    notFound()
  }

  if (division.scoring_locked) {
    redirect(`/judge/divisions/${divisionId}?locked=1`)
  }

  const { data: participant } = await supabaseAdmin
    .from('division_members')
    .select(`
      *,
      competitor:competitors(id, full_name, nickname, country, public_id)
    `)
    .eq('id', participantId)
    .eq('division_id', divisionId)
    .single()

  if (!participant) {
    notFound()
  }

  const { data: existingScore } = await supabaseAdmin
    .from('scores')
    .select('*')
    .eq('division_member_id', participantId)
    .eq('judge_id', user.id)
    .single()

  const { data: allMembers } = await supabaseAdmin
    .from('division_members')
    .select(`
      id,
      play_order,
      competitor:competitors(id, full_name, nickname, country, public_id)
    `)
    .eq('division_id', divisionId)
    .order('play_order', { ascending: true })

  const allIds = (allMembers ?? []).map((m) => m.id)
  const { data: myScores } = allIds.length
    ? await supabaseAdmin
        .from('scores')
        .select('division_member_id, is_submitted')
        .eq('judge_id', user.id)
        .in('division_member_id', allIds)
    : { data: [] as { division_member_id: string; is_submitted: boolean }[] }

  const submittedIds = new Set(
    (myScores ?? []).filter((s) => s.is_submitted).map((s) => s.division_member_id)
  )

  const queueItems = (allMembers ?? []).map((m) => {
    const raw = m.competitor as
      | { full_name: string }
      | { full_name: string }[]
      | null
    const competitor = Array.isArray(raw) ? raw[0] : raw
    const hasScore = (myScores ?? []).some((s) => s.division_member_id === m.id)
    const status = submittedIds.has(m.id)
      ? ('submitted' as const)
      : hasScore
        ? ('draft' as const)
        : ('pending' as const)
    return {
      divisionId,
      divisionName: division.name,
      eventName: '',
      eventDate: null,
      divisionMemberId: m.id,
      participantName: competitor?.full_name ?? 'Unknown',
      nickname: null,
      playOrder: m.play_order,
      status,
      totalScore: null,
      scoringLocked: false,
    }
  })

  const nextItem = nextInDivision(queueItems, participantId)
  const nextParticipant = nextItem
    ? {
        id: nextItem.divisionMemberId,
        fullName: nextItem.participantName,
        playOrder: nextItem.playOrder,
      }
    : null

  return (
    <ScoringForm
      division={division}
      participant={participant}
      existingScore={existingScore}
      judgeId={user.id}
      nextParticipant={nextParticipant}
    />
  )
}

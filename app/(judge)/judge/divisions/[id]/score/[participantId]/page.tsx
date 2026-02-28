/**
 * Scoring Page
 * Mobile-optimized scoring form for a participant
 */
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ScoringForm from '@/components/judge/ScoringForm'

interface ScoringPageProps {
  params: Promise<{ id: string; participantId: string }>
}

export default async function ScoringPage({ params }: ScoringPageProps) {
  const { id: divisionId, participantId } = await params
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Verify judge is assigned to this division (admin client to bypass RLS)
  const { data: assignment } = await supabaseAdmin
    .from('division_judges')
    .select('*')
    .eq('division_id', divisionId)
    .eq('member_id', user.id)
    .single()

  if (!assignment) {
    notFound()
  }

  // Get division info
  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select(`
      *,
      event:events(id, name, status)
    `)
    .eq('id', divisionId)
    .single()

  if (!division) {
    notFound()
  }

  if (division.scoring_locked) {
    redirect(`/judge/divisions/${divisionId}?locked=1`)
  }

  // Get participant
  const { data: participant } = await supabaseAdmin
    .from('division_members')
    .select(`
      *,
      member:members(id, full_name, nickname, country)
    `)
    .eq('id', participantId)
    .eq('division_id', divisionId)
    .single()

  if (!participant) {
    notFound()
  }

  // Get existing score if any
  const { data: existingScore } = await supabaseAdmin
    .from('scores')
    .select('*')
    .eq('division_member_id', participantId)
    .eq('judge_id', user.id)
    .single()

  return (
    <ScoringForm
      division={division}
      participant={participant}
      existingScore={existingScore}
      judgeId={user.id}
    />
  )
}

/**
 * Judge Division Detail Page
 * Shows participants to score in a division
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  User, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Trophy,
  Lock
} from 'lucide-react'
import LockDivisionButton from '@/components/judge/LockDivisionButton'
import DivisionPageTabs from '@/components/judge/DivisionPageTabs'

interface DivisionPageProps {
  params: Promise<{ id: string }>
}

export default async function JudgeDivisionPage({ params }: DivisionPageProps) {
  const { id: divisionId } = await params
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

  const { data: currentMember } = await supabaseAdmin
    .from('members')
    .select('role')
    .eq('id', user.id)
    .single()

  // Get division with event info
  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select(`
      *,
      event:events(id, name, status, event_date)
    `)
    .eq('id', divisionId)
    .single()

  if (!division) {
    notFound()
  }

  // Get participants with their scores from this judge
  const { data: participants } = await supabaseAdmin
    .from('division_members')
    .select(`
      *,
      member:members(id, full_name, nickname, country)
    `)
    .eq('division_id', divisionId)
    .order('play_order', { ascending: true })

  // Get scores from this judge for these participants
  const participantIds = participants?.map(p => p.id) || []
  const { data: scores } = await supabaseAdmin
    .from('scores')
    .select('division_member_id, is_submitted, total_score')
    .eq('judge_id', user.id)
    .in('division_member_id', participantIds.length > 0 ? participantIds : [''])

  // Create a map of scores
  const scoresMap = scores?.reduce((acc, s) => {
    acc[s.division_member_id] = s
    return acc
  }, {} as Record<string, typeof scores[0]>) || {}

  // Count completed scores
  const completedCount = scores?.filter(s => s.is_submitted).length || 0
  const totalParticipants = participants?.length || 0
  const scoringLocked = division.scoring_locked === true
  const isHeadJudgeOrAdmin = assignment.judge_type === 'head' || currentMember?.role === 'admin'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/judge/divisions">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{division.name}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {division.event?.name}
          </p>
        </div>
        <LockDivisionButton
          divisionId={divisionId}
          scoringLocked={scoringLocked}
          isHeadJudgeOrAdmin={isHeadJudgeOrAdmin}
        />
      </div>

      {/* Locked Banner */}
      {scoringLocked && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="flex items-center gap-2 p-4">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Division locked — no new scores can be submitted or updated.
            </p>
          </CardContent>
        </Card>
      )}

      <DivisionPageTabs divisionId={divisionId} isHeadJudgeOrAdmin={isHeadJudgeOrAdmin}>
        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount} / {totalParticipants}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ 
                  width: totalParticipants > 0 
                    ? `${(completedCount / totalParticipants) * 100}%` 
                    : '0%' 
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Participants List */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Participants
          </h2>
          
          {participants && participants.length > 0 ? (
            <div className="space-y-2">
              {participants.map((participant, index) => {
                const score = scoresMap[participant.id]
                const isScored = score?.is_submitted

                const cardContent = (
                    <Card className={`transition-colors ${!scoringLocked && 'hover:bg-accent active:scale-[0.98]'} ${scoringLocked && 'opacity-75'} ${isScored ? 'border-green-500/50' : ''}`}>
                      <CardContent className="flex items-center gap-4 p-4">
                        {/* Order number */}
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold">
                            {participant.play_order || index + 1}
                          </span>
                        </div>

                        {/* Participant info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            {participant.member?.full_name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {participant.member?.nickname && (
                              <span>"{participant.member.nickname}"</span>
                            )}
                            {participant.member?.country && (
                              <span>• {participant.member.country}</span>
                            )}
                          </div>
                        </div>

                        {/* Score status */}
                        {isScored ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              {score.total_score?.toFixed(1)}
                            </span>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          </div>
                        ) : score ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-yellow-600">
                              <Clock className="h-3 w-3 mr-1" />
                              Draft
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="secondary">Score</Badge>
                        )}

                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                )

                return scoringLocked ? (
                  <div key={participant.id}>{cardContent}</div>
                ) : (
                  <Link key={participant.id} href={`/judge/divisions/${divisionId}/score/${participant.id}`}>
                    {cardContent}
                  </Link>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Participants</h3>
                <p className="text-sm text-muted-foreground">
                  No participants have been added to this division yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DivisionPageTabs>
    </div>
  )
}

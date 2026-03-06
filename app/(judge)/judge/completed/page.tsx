/**
 * Judge Completed Scores Page
 * Shows all submitted scores
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, ChevronRight, Trophy } from 'lucide-react'

export default async function JudgeCompletedPage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  // Get submitted scores (admin client to bypass RLS)
  const { data: completedScores } = await supabaseAdmin
    .from('scores')
    .select(`
      *,
      division_member:division_members(
        id,
        member:members(full_name, nickname)
      ),
      division:divisions(
        id,
        name,
        event:events(name, event_date)
      )
    `)
    .eq('judge_id', user.id)
    .eq('is_submitted', true)
    .order('submitted_at', { ascending: false })
    .limit(50)

  // Group by event
  type ScoreWithRelations = NonNullable<typeof completedScores>[number]
  const scoresByEvent = completedScores?.reduce((acc, score) => {
    const eventName = score.division?.event?.name || 'Unknown Event'
    if (!acc[eventName]) {
      acc[eventName] = []
    }
    acc[eventName].push(score)
    return acc
  }, {} as Record<string, ScoreWithRelations[]>) || {}

  const eventNames = Object.keys(scoresByEvent)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Completed Scores</h1>
        <p className="text-muted-foreground">
          {completedScores?.length || 0} scores submitted
        </p>
      </div>

      {eventNames.length > 0 ? (
        eventNames.map((eventName) => (
          <div key={eventName} className="space-y-2">
            <h2 className="text-lg font-semibold">{eventName}</h2>
            
            {scoresByEvent[eventName].map((score: ScoreWithRelations) => (
              <Link
                key={score.id}
                href={`/judge/divisions/${score.division?.id}/score/${score.division_member?.id}`}
              >
                <Card className="hover:bg-accent transition-colors active:scale-[0.98] border-green-500/30">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {score.division_member?.member?.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {score.division?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {score.submitted_at 
                          ? new Date(score.submitted_at).toLocaleString() 
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {score.total_score?.toFixed(1)}
                      </span>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ))
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Scores Yet</h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t submitted any scores yet.
            </p>
            <Link 
              href="/judge/divisions" 
              className="text-primary text-sm mt-2 hover:underline"
            >
              Start scoring
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

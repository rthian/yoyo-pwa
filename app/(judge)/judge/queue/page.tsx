/**
 * Judge Score Queue Page
 * Shows pending/draft scores
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, ChevronRight, Inbox } from 'lucide-react'

export default async function JudgeQueuePage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  // Get draft scores (admin client to bypass RLS)
  const { data: draftScores } = await supabaseAdmin
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
        event:events(name)
      )
    `)
    .eq('judge_id', user.id)
    .eq('is_submitted', false)
    .order('updated_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Score Queue</h1>
        <p className="text-muted-foreground">
          Drafts and pending scores
        </p>
      </div>

      {draftScores && draftScores.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Draft Scores ({draftScores.length})
          </h2>
          
          {draftScores.map((score) => (
            <Link
              key={score.id}
              href={`/judge/divisions/${score.division?.id}/score/${score.division_member?.id}`}
            >
              <Card className="hover:bg-accent transition-colors active:scale-[0.98]">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {score.division_member?.member?.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {score.division?.name} • {score.division?.event?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last edited: {new Date(score.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-yellow-600">
                    Draft
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Queue Empty</h3>
            <p className="text-sm text-muted-foreground">
              No draft scores waiting to be submitted.
            </p>
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

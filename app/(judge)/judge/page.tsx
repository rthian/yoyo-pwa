/**
 * Judge Home Page
 * Mobile-optimized dashboard for judges showing assigned divisions
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Clock, CheckCircle2, AlertCircle, ChevronRight, Gavel } from 'lucide-react'
import Link from 'next/link'

export default async function JudgeHomePage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  // Fetch divisions assigned to this judge (use admin client to bypass RLS)
  const { data: assignments } = await supabaseAdmin
    .from('division_judges')
    .select(`
      *,
      division:divisions(
        *,
        event:events(name, status, event_date)
      )
    `)
    .eq('member_id', user.id)

  // Count pending scores (division members without submitted score from this judge)
  const { data: pendingScores } = await supabaseAdmin
    .from('scores')
    .select('id')
    .eq('judge_id', user.id)
    .eq('is_submitted', false)

  const pendingCount = pendingScores?.length || 0

  // Count completed scores
  const { count: completedCount } = await supabaseAdmin
    .from('scores')
    .select('*', { count: 'exact', head: true })
    .eq('judge_id', user.id)
    .eq('is_submitted', true)

  return (
    <div className="space-y-4 pb-4">
      {/* Pending hero */}
      <Card className="border-primary/20 bg-primary/5 overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pending drafts
              </p>
              <p className="text-4xl font-bold tabular-nums tracking-tight">{pendingCount}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold tabular-nums">{completedCount || 0}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild className="flex-1 h-12 rounded-full">
              <Link href="/judge/queue">
                <Gavel className="h-5 w-5 mr-2" />
                {pendingCount > 0 ? 'Continue scoring' : 'Open queue'}
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-12 rounded-full px-4">
              <Link href="/judge/queue" aria-label="Scoring queue">
                <Clock className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/judge/queue" className="block">
          <Card className="active:bg-accent/80 transition-colors h-full">
            <CardContent className="flex items-center gap-3 p-4 min-h-16">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">In queue</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/judge/completed" className="block">
          <Card className="active:bg-accent/80 transition-colors h-full">
            <CardContent className="flex items-center gap-3 p-4 min-h-16">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">{completedCount || 0}</p>
                <p className="text-xs text-muted-foreground">Done</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your Divisions</CardTitle>
          <CardDescription>Tap a division to score participants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 p-2 pt-0">
          {assignments && assignments.length > 0 ? (
            assignments.map((assignment) => {
              const division = assignment.division
              const event = division?.event
              const isActive = event?.status === 'active'

              return (
                <Link
                  key={assignment.id}
                  href={`/judge/divisions/${division?.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 active:bg-accent transition-colors tap-highlight-none"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{division?.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{event?.name}</p>
                  </div>
                  <Badge variant={isActive ? 'default' : 'secondary'} className="rounded-full shrink-0">
                    {event?.status || 'draft'}
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </Link>
              )
            })
          ) : (
            <div className="text-center py-8 px-4">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No divisions assigned yet.</p>
              <p className="text-sm text-muted-foreground">
                Contact an admin to get assigned to a division.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

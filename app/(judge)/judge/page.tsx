/**
 * Judge Home Page
 * Mobile-optimized dashboard for judges showing assigned divisions
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
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
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount || 0}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Divisions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your Divisions</CardTitle>
          <CardDescription>
            Tap a division to start scoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {assignments && assignments.length > 0 ? (
            assignments.map((assignment) => {
              const division = assignment.division
              const event = division?.event
              const isActive = event?.status === 'active'
              
              return (
                <Link
                  key={assignment.id}
                  href={`/judge/divisions/${division?.id}`}
                  className="block"
                >
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
                    <Users className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{division?.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {event?.name}
                      </p>
                    </div>
                    <Badge variant={isActive ? 'default' : 'secondary'}>
                      {event?.status || 'draft'}
                    </Badge>
                  </div>
                </Link>
              )
            })
          ) : (
            <div className="text-center py-8">
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

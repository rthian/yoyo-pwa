/**
 * Judge Divisions List Page
 * Mobile-optimized list of assigned divisions
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Calendar, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default async function JudgeDivisionsPage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  // Fetch divisions assigned to this judge with event info (admin client to bypass RLS)
  const { data: assignments } = await supabaseAdmin
    .from('division_judges')
    .select(`
      *,
      division:divisions(
        *,
        event:events(id, name, status, event_date, location)
      )
    `)
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })

  // Get participant counts for each division
  const divisionIds = assignments?.map(a => a.division?.id).filter(Boolean) || []
  
  const { data: participantCounts } = await supabaseAdmin
    .from('division_members')
    .select('division_id')
    .in('division_id', divisionIds.length > 0 ? divisionIds : [''])

  // Count participants per division
  const countsByDivision = participantCounts?.reduce((acc, p) => {
    acc[p.division_id] = (acc[p.division_id] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  // Group by event status
  const activeAssignments = assignments?.filter(a => a.division?.event?.status === 'active') || []
  const otherAssignments = assignments?.filter(a => a.division?.event?.status !== 'active') || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Divisions</h1>
        <p className="text-muted-foreground">
          Select a division to start scoring
        </p>
      </div>

      {/* Active Events */}
      {activeAssignments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Active Events
          </h2>
          <div className="space-y-2">
            {activeAssignments.map((assignment) => {
              const division = assignment.division
              const event = division?.event
              const participantCount = countsByDivision[division?.id] || 0

              return (
                <Link
                  key={assignment.id}
                  href={`/judge/divisions/${division?.id}`}
                >
                  <Card className="hover:bg-accent transition-colors active:scale-[0.98]">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{division?.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {event?.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {participantCount} participants
                          </span>
                          {event?.event_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(event.event_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Active
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Other Events */}
      {otherAssignments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Other Assignments
          </h2>
          <div className="space-y-2">
            {otherAssignments.map((assignment) => {
              const division = assignment.division
              const event = division?.event
              const participantCount = countsByDivision[division?.id] || 0

              return (
                <Link
                  key={assignment.id}
                  href={`/judge/divisions/${division?.id}`}
                >
                  <Card className="hover:bg-accent transition-colors active:scale-[0.98] opacity-75">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{division?.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {event?.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {participantCount}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline">{event?.status}</Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!assignments || assignments.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Divisions Assigned</h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t been assigned to any divisions yet.
              <br />
              Contact an administrator to get assigned.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

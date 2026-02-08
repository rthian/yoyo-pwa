/**
 * Admin Reports Page
 * Event statistics and reporting
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Calendar, Users, Trophy, TrendingUp } from 'lucide-react'

export default async function ReportsPage() {
  const supabase = createAdminClient()

  // Get overall statistics
  const [eventsResult, membersResult, divisionsResult, scoresResult] = await Promise.all([
    supabase.from('events').select('status', { count: 'exact' }),
    supabase.from('members').select('role', { count: 'exact' }),
    supabase.from('divisions').select('id', { count: 'exact' }),
    supabase.from('scores').select('id', { count: 'exact' }).eq('is_submitted', true),
  ])

  // Count events by status
  const eventStats = {
    total: eventsResult.data?.length || 0,
    draft: eventsResult.data?.filter(e => e.status === 'draft').length || 0,
    published: eventsResult.data?.filter(e => e.status === 'published').length || 0,
    active: eventsResult.data?.filter(e => e.status === 'active').length || 0,
    completed: eventsResult.data?.filter(e => e.status === 'completed').length || 0,
  }

  // Count members by role
  const memberStats = {
    total: membersResult.data?.length || 0,
    members: membersResult.data?.filter(m => m.role === 'member').length || 0,
    judges: membersResult.data?.filter(m => m.role === 'judge').length || 0,
    admins: membersResult.data?.filter(m => m.role === 'admin').length || 0,
  }

  // Get recent events
  const { data: recentEvents } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Overview of system statistics and event performance
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventStats.total}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{eventStats.draft} draft</Badge>
              <Badge variant="outline">{eventStats.active} active</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberStats.total}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{memberStats.members} participants</Badge>
              <Badge>{memberStats.judges} judges</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Divisions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{divisionsResult.count || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Across all events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Scores Submitted</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scoresResult.count || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total submitted scores
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Event Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Event Status Breakdown</CardTitle>
          <CardDescription>
            Distribution of events by their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Draft</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{eventStats.draft}</span>
                <span className="text-muted-foreground">
                  ({eventStats.total > 0 ? Math.round((eventStats.draft / eventStats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Published</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{eventStats.published}</span>
                <span className="text-muted-foreground">
                  ({eventStats.total > 0 ? Math.round((eventStats.published / eventStats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Active</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{eventStats.active}</span>
                <span className="text-muted-foreground">
                  ({eventStats.total > 0 ? Math.round((eventStats.active / eventStats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{eventStats.completed}</span>
                <span className="text-muted-foreground">
                  ({eventStats.total > 0 ? Math.round((eventStats.completed / eventStats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>
            Latest events in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents && recentEvents.length > 0 ? (
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.location} • {event.event_date || 'No date set'}
                    </p>
                  </div>
                  <Badge variant="outline">{event.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No events found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

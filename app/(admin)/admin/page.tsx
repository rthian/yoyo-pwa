/**
 * Admin Dashboard Page
 * Overview of events, members, and system status
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Users, Trophy, Activity, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = createAdminClient()

  // Fetch counts for dashboard stats
  const [eventsResult, membersResult, judgesResult] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('role', 'judge'),
  ])

  const stats = [
    {
      title: 'Total Events',
      value: eventsResult.count || 0,
      icon: Calendar,
      href: '/admin/events',
      description: 'All events in the system',
    },
    {
      title: 'Active Members',
      value: membersResult.count || 0,
      icon: Users,
      href: '/admin/members',
      description: 'Registered participants',
    },
    {
      title: 'Judges',
      value: judgesResult.count || 0,
      icon: Trophy,
      href: '/admin/judges',
      description: 'Available judges',
    },
  ]

  // Fetch recent events
  const { data: recentEvents } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to YoYo League</p>
        </div>
        <Button asChild className="rounded-full">
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} href={stat.href} className="group">
              <Card className="h-full transition-colors hover:bg-accent/60 focus-within:ring-2 focus-within:ring-ring">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tabular-nums tracking-tight">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Latest events in the system</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/events">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          {recentEvents && recentEvents.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-accent/60 transition-colors"
                >
                  <Activity className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {event.location} • {event.event_date || 'No date set'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                      event.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : event.status === 'published'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {event.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No events yet.</p>
              <Link href="/admin/events/new" className="text-primary hover:underline">
                Create your first event
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

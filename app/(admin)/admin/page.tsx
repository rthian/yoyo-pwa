/**
 * Admin Dashboard Page
 * Overview of events, members, and system status
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, Trophy, Activity } from 'lucide-react'
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
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to YoYo League
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:bg-accent transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>
            Latest events created in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents && recentEvents.length > 0 ? (
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <Activity className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.location} • {event.event_date || 'No date set'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    event.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                    event.status === 'published' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {event.status}
                  </span>
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

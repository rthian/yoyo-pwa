/**
 * Prompt 16: my events list for event staff.
 * Caller: /organize (layout header + dashboard links)
 * Glob: no prior organize list page
 * User: "ok continue next"
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import {
  isGlobalAdminAccount,
  listStaffEventsForAccount,
} from '@/lib/organize/access'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'
import { formatInTimeZone } from '@/lib/events/timing'

export default async function OrganizeHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/organize')

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const isAdmin = await isGlobalAdminAccount(admin, user.id)
  const events = await listStaffEventsForAccount(admin, user.id, { isAdmin })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">My events</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage events where you have a staff role
          {isAdmin ? ' (admin: all events)' : ''}.
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            You are not assigned to any events yet. Ask an owner or admin to grant
            you a staff role.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/organize/events/${e.id}`}>
                <Card className="hover:bg-accent/40 transition-colors">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">{e.name}</CardTitle>
                      <CardDescription className="flex flex-wrap gap-3 mt-1">
                        {(e.starts_at || e.event_date) && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {e.starts_at
                              ? formatInTimeZone(
                                  e.starts_at,
                                  e.timezone || 'UTC'
                                )
                              : new Date(e.event_date!).toLocaleDateString()}
                          </span>
                        )}
                        {(e.venue_name || e.location) && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {e.venue_name || e.location}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pt-0">
                    <Badge variant="outline" className="capitalize">
                      {e.status}
                    </Badge>
                    {e.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="capitalize">
                        {r.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

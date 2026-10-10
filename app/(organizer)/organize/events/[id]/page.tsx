/**
 * Prompt 16: event ops hub for staff (capability-filtered).
 * 1. Callers: OrganizeEntryCard → /organize/events/[id]
 * 2. Glob: no prior organize/events/[id]/page.tsx
 * 3. Caps sample: { view_ops: true, manage_registration: true }
 * 4. User: "ok let do Prompt 16"
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, Edit, MapPin, Plus, Users, Trophy } from 'lucide-react'
import DivisionsList from '@/components/admin/DivisionsList'
import EventStatusActions from '@/components/admin/EventStatusActions'
import ScheduleManager from '@/components/admin/ScheduleManager'
import PublishResultsPanel from '@/components/admin/PublishResultsPanel'
import EventStaffPanel from '@/components/admin/EventStaffPanel'
import EventRegistrationsPanel from '@/components/admin/EventRegistrationsPanel'
import EventTracksPanel from '@/components/admin/EventTracksPanel'
import EventMusicOpsPanel from '@/components/admin/EventMusicOpsPanel'
import EventMediaPanel from '@/components/admin/EventMediaPanel'
import { formatInTimeZone } from '@/lib/events/timing'
import { requireEventStaff } from '@/lib/organize/access'

const BASE = '/organize/events' as const

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function OrganizeEventPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab: tabParam } = await searchParams
  const { event, capabilities, roles, supabaseAdmin } = await requireEventStaff(
    id,
    'view_ops'
  )

  const allowedTabs = [
    capabilities.view_ops && 'divisions',
    capabilities.view_ops && 'tracks',
    capabilities.view_ops && 'music',
    capabilities.view_ops && 'media',
    capabilities.view_ops && 'schedule',
    capabilities.manage_registration && 'registrations',
    capabilities.view_ops && 'staff',
  ].filter(Boolean) as string[]

  const defaultTab =
    tabParam && allowedTabs.includes(tabParam) ? tabParam : allowedTabs[0] || 'divisions'

  const { data: divisions } = await supabaseAdmin
    .from('divisions')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true })

  const { count: participantCount } = await supabaseAdmin
    .from('division_members')
    .select('*', { count: 'exact', head: true })
    .in('division_id', divisions?.map((d) => d.id) || [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            href="/organize"
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to my events
          </Link>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
            {(event.starts_at || event.event_date) && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {event.starts_at
                  ? formatInTimeZone(event.starts_at, event.timezone || 'UTC')
                  : new Date(event.event_date!).toLocaleDateString()}
              </span>
            )}
            {(event.venue_name || event.location) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.venue_name || event.location}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {roles.map((role) => (
              <Badge key={role} variant="secondary" className="capitalize text-xs">
                {role.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
        {capabilities.manage_event && (
          <Link href={`${BASE}/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {capabilities.manage_event && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <EventStatusActions event={event} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{divisions?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Divisions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{participantCount || 0}</p>
              <p className="text-sm text-muted-foreground">Participants</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {capabilities.publish_results && <PublishResultsPanel eventId={id} />}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap h-auto">
          {capabilities.view_ops && <TabsTrigger value="divisions">Divisions</TabsTrigger>}
          {capabilities.view_ops && <TabsTrigger value="tracks">Tracks</TabsTrigger>}
          {capabilities.view_ops && <TabsTrigger value="music">Music ops</TabsTrigger>}
          {capabilities.view_ops && <TabsTrigger value="media">Media</TabsTrigger>}
          {capabilities.view_ops && <TabsTrigger value="schedule">Schedule</TabsTrigger>}
          {capabilities.manage_registration && (
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
          )}
          {capabilities.view_ops && <TabsTrigger value="staff">Staff</TabsTrigger>}
        </TabsList>

        {capabilities.view_ops && (
          <TabsContent value="divisions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Divisions</CardTitle>
                  <CardDescription>Competition divisions for this event</CardDescription>
                </div>
                {capabilities.manage_divisions && (
                  <Link href={`${BASE}/${id}/divisions/new`}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Division
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <DivisionsList
                  divisions={divisions || []}
                  eventId={id}
                  basePath={BASE}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {capabilities.view_ops && (
          <TabsContent value="tracks">
            <Card>
              <CardHeader>
                <CardTitle>Competition tracks</CardTitle>
                <CardDescription>
                  Stages (Qualifier → Semi → Final). No automatic advancement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventTracksPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {capabilities.view_ops && (
          <TabsContent value="music">
            <Card>
              <CardHeader>
                <CardTitle>Stage music operations</CardTitle>
              </CardHeader>
              <CardContent>
                <EventMusicOpsPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {capabilities.view_ops && (
          <TabsContent value="media">
            <Card>
              <CardHeader>
                <CardTitle>External media</CardTitle>
                <CardDescription>
                  Livestreams and highlights — embeds load on the public hub.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventMediaPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {capabilities.view_ops && (
          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Event schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleManager eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {capabilities.manage_registration && (
          <TabsContent value="registrations">
            <Card>
              <CardHeader>
                <CardTitle>Registrations</CardTitle>
              </CardHeader>
              <CardContent>
                <EventRegistrationsPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {capabilities.view_ops && (
          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <CardTitle>Event staff</CardTitle>
                <CardDescription>
                  {capabilities.manage_staff
                    ? 'Grant and revoke event-scoped roles'
                    : 'View-only — only the event owner can change staff'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventStaffPanel eventId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
